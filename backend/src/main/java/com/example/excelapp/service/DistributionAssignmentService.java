package com.example.excelapp.service;

import com.example.excelapp.entity.Recipients;
import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.repository.UserRecipientsRepository;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.DistributionZoneService.Zone;
import com.example.excelapp.service.DistributionZoneService.ZoneStreet;
import com.example.excelapp.service.ZoneStreetTextParser.Side;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

// שיוך הנמענים של משתמשת לאזורי החלוקה (שקיות) ולמסלול בתוכם (#129) - טבלת הקשר בין
// נמען לשקית. בניסוי הראשון מחושבת בזמן אמת בכל בקשה (כשמבקשים מדבקות לחלוקה) ולא
// נשמרת ב-DB. רק קוראת את הנמענים - לא משנה בהם כלום.
// השיוך: עיר -> רחוב מנורמל -> הכלל של הרחוב שמכסה את מספר הבית (טווח, צד, בתים
// בודדים, חריגים). מי שלא שויך חוזר עם הסיבה
@Service
public class DistributionAssignmentService {

    // הסיבה שנמען לא שויך - קוד בלבד; הטקסט בעברית להצגה למשתמשת שייך לפרונט
    public enum UnassignedReason {
        MISSING_ADDRESS,       // אין רחוב או אין עיר
        OTHER_CITY,            // עיר שאינה העיר של הגמ"ח
        UNKNOWN_STREET,        // הרחוב לא מופיע באף אזור
        HOUSE_OUT_OF_RANGE,    // הרחוב מופיע, אבל מספר הבית לא באף טווח שלו
        MISSING_HOUSE_NUMBER   // הרחוב מפוצל בין כמה אזורים ואין מספר בית
    }

    // שורה בטבלת הקשר: הנמען, והשקית והמסלול שלו - כל מה שצריך כדי להדפיס את המדבקה.
    // routeCode = מספר הרחוב באזור ומספר הבית ("01-56"); routeSequence = המקום בשקית (1, 2, 3...)
    public record AssignmentRow(
            String recipientHash,
            Integer zoneNumber,
            String carrierName,
            String className,
            Integer streetOrder,
            Integer houseNumber,
            String houseSuffix,
            String routeCode,
            Integer routeSequence,
            UnassignedReason unassignedReason,
            Recipients recipient
    ) {
        private AssignmentRow withRouteSequence(int sequence) {
            return new AssignmentRow(recipientHash, zoneNumber, carrierName, className, streetOrder, houseNumber,
                    houseSuffix, routeCode, sequence, unassignedReason, recipient);
        }
    }

    public record AssignmentResult(int assigned, int unassigned, List<AssignmentRow> rows) {
    }

    // כלל רחוב אחד של אזור, מוכן להשוואה
    private record Rule(Zone zone, ZoneStreet street, Set<Integer> explicit, Set<Integer> except) {

        boolean wholeStreet() {
            return explicit.isEmpty() && street.fromNo() == null && street.toNo() == null && street.side() == Side.ALL;
        }

        boolean covers(int house) {
            if (!explicit.isEmpty()) return explicit.contains(house);
            if (street.fromNo() != null && house < street.fromNo()) return false;
            if (street.toNo() != null && house > street.toNo()) return false;
            if (street.side() == Side.ODD && house % 2 == 0) return false;
            if (street.side() == Side.EVEN && house % 2 != 0) return false;
            return !except.contains(house);
        }

        // כמה הכלל ספציפי - נמוך יותר = ספציפי יותר: בית מפורש, טווח עם צד, טווח, צד בלבד, רחוב שלם
        int rank() {
            boolean range = street.fromNo() != null || street.toNo() != null;
            boolean side = street.side() != Side.ALL;
            if (!explicit.isEmpty()) return 0;
            if (range && side) return 1;
            if (range) return 2;
            if (side) return 3;
            return 4;
        }

        int width() {
            return street.fromNo() == null || street.toNo() == null ? Integer.MAX_VALUE : street.toNo() - street.fromNo();
        }
    }

    private record ZoneIndex(Map<String, List<Rule>> rulesByStreet, Set<String> cities) {
    }

    // הסדר בתוך שקית: לפי הרחובות (הסדר ברשימת האזור), ובכל רחוב לפי מספר הבית מהנמוך
    // לגבוה ("12" לפני "12א"), ובלי מספר בית - בתחילת הרחוב
    private static final Comparator<AssignmentRow> ROUTE_ORDER = Comparator
            .comparing(AssignmentRow::streetOrder)
            .thenComparing(AssignmentRow::houseNumber, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(AssignmentRow::houseSuffix, Comparator.nullsFirst(Comparator.naturalOrder()));

    private final UserRepository userRepository;
    private final UserRecipientsRepository userRecipientsRepository;
    private final DistributionZoneService zoneService;

    public DistributionAssignmentService(UserRepository userRepository,
                                         UserRecipientsRepository userRecipientsRepository,
                                         DistributionZoneService zoneService) {
        this.userRepository = userRepository;
        this.userRecipientsRepository = userRecipientsRepository;
        this.zoneService = zoneService;
    }

    // משייכת את כל הנמענים של המשתמשת. התוצאה: קודם המשויכים לפי שקית וסדר בתוכה,
    // אחריהם הלא-משויכים לפי הסיבה
    @Transactional(readOnly = true)
    public AssignmentResult assignRecipients(String phone) {
        User user = userRepository.findByPhone(phone);
        if (user == null) throw new NoSuchElementException("User not found");

        Map<String, Recipients> recipients = new LinkedHashMap<>();
        for (UserRecipients link : userRecipientsRepository.findByUser(user)) {
            Recipients r = link.getRecipient();
            if (r != null && r.getHashCode() != null) recipients.putIfAbsent(r.getHashCode(), r);
        }

        ZoneIndex index = buildIndex(zoneService.getZones());
        List<AssignmentRow> rows = recipients.values().stream().map(r -> assign(r, index)).toList();

        List<AssignmentRow> result = new ArrayList<>();
        rows.stream()
                .filter(row -> row.zoneNumber() != null)
                .collect(Collectors.groupingBy(AssignmentRow::zoneNumber, TreeMap::new, Collectors.toList()))
                .values()
                .forEach(zone -> {
                    List<AssignmentRow> ordered = zone.stream().sorted(ROUTE_ORDER).toList();
                    for (int i = 0; i < ordered.size(); i++) result.add(ordered.get(i).withRouteSequence(i + 1));
                });
        rows.stream()
                .filter(row -> row.zoneNumber() == null)
                .sorted(Comparator.comparing(AssignmentRow::unassignedReason))
                .forEach(result::add);

        int assigned = (int) result.stream().filter(row -> row.zoneNumber() != null).count();
        return new AssignmentResult(assigned, result.size() - assigned, result);
    }

    private ZoneIndex buildIndex(List<Zone> zones) {
        Map<String, List<Rule>> rulesByStreet = new HashMap<>();
        Set<String> cities = new HashSet<>();
        for (Zone zone : zones) {
            cities.add(AddressNormalizer.streetKey(zone.city()));
            for (ZoneStreet street : zone.streets()) {
                Rule rule = new Rule(zone, street, Set.copyOf(street.explicitNumbers()), Set.copyOf(street.exceptNumbers()));
                rulesByStreet.computeIfAbsent(AddressNormalizer.streetKey(street.streetName()), k -> new ArrayList<>()).add(rule);
            }
        }
        return new ZoneIndex(rulesByStreet, cities);
    }

    private AssignmentRow assign(Recipients recipient, ZoneIndex index) {
        if (isBlank(recipient.getStreet()) || isBlank(recipient.getCity())) {
            return unassigned(recipient, UnassignedReason.MISSING_ADDRESS, null);
        }
        String cityKey = AddressNormalizer.streetKey(recipient.getCity());
        if (!index.cities().contains(cityKey)) {
            return unassigned(recipient, UnassignedReason.OTHER_CITY, null);
        }

        AddressNormalizer.ParsedAddress address = AddressNormalizer.parseAddress(recipient.getStreet(), recipient.getHouseNo());
        if (address.street().isBlank()) {
            return unassigned(recipient, UnassignedReason.MISSING_ADDRESS, null);
        }

        // רק כללים של אזורים באותה עיר - אותו שם רחוב בעיר אחרת הוא רחוב אחר
        List<Rule> rules = index.rulesByStreet().getOrDefault(AddressNormalizer.streetKey(address.street()), List.of()).stream()
                .filter(rule -> AddressNormalizer.streetKey(rule.zone().city()).equals(cityKey))
                .toList();
        if (rules.isEmpty()) {
            return unassigned(recipient, UnassignedReason.UNKNOWN_STREET, address);
        }

        Rule chosen;
        Integer house = address.houseNumber();
        if (house == null) {
            // בלי מספר בית אפשר לשייך רק כשכל הרחוב באזור אחד
            long zonesOfStreet = rules.stream().map(rule -> rule.zone().zoneNumber()).distinct().count();
            Optional<Rule> whole = rules.stream().filter(Rule::wholeStreet).findFirst();
            if (zonesOfStreet != 1 || whole.isEmpty()) {
                return unassigned(recipient, UnassignedReason.MISSING_HOUSE_NUMBER, address);
            }
            chosen = whole.get();
        } else {
            List<Rule> matching = rules.stream().filter(rule -> rule.covers(house)).toList();
            if (matching.isEmpty()) {
                return unassigned(recipient, UnassignedReason.HOUSE_OUT_OF_RANGE, address);
            }
            // כמה כללים מתאימים: הספציפי ביותר. בית על הגבול בין שני טווחים (למשל חזו"א 50
            // גם ב-30-50 וגם ב-50-60) - לטווח שמתחיל בו. זמני, עד שיוחלט אחרת (#129)
            chosen = matching.stream().min(Comparator
                    .comparingInt(Rule::rank)
                    .thenComparing(rule -> !Objects.equals(rule.street().fromNo(), house))
                    .thenComparingInt(Rule::width)
                    .thenComparingInt(rule -> rule.zone().zoneNumber())).orElseThrow();
        }

        Zone zone = chosen.zone();
        int streetOrder = chosen.street().streetOrder();
        return new AssignmentRow(recipient.getHashCode(), zone.zoneNumber(), zone.carrierName(), zone.className(),
                streetOrder, house, address.houseSuffix(), routeCode(streetOrder, house), null, null, recipient);
    }

    private static String routeCode(int streetOrder, Integer house) {
        return house == null ? String.format("%02d", streetOrder) : String.format("%02d-%02d", streetOrder, house);
    }

    private static AssignmentRow unassigned(Recipients recipient, UnassignedReason reason, AddressNormalizer.ParsedAddress address) {
        return new AssignmentRow(recipient.getHashCode(), null, null, null, null,
                address == null ? null : address.houseNumber(), address == null ? null : address.houseSuffix(),
                null, null, reason, recipient);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
