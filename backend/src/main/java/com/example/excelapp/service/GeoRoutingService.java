package com.example.excelapp.service;

import com.example.excelapp.dto.DistributionRouteRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GeoRoutingService {
    private static final String STREETS_RESOURCE = "9ad3862c-8391-4b2f-84a4-2d4c68625f4b";
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, Location> locationCache = new ConcurrentHashMap<>();

    public Map<String, Object> optimize(DistributionRouteRequest request) {
        List<DistributionRouteRequest.Assignment> assignments = request.assignments() == null ? List.of() : request.assignments();
        List<String> streets = assignments.stream().flatMap(a -> (a.streets() == null ? List.<String>of() : a.streets()).stream()).filter(s -> s != null && !s.isBlank()).collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), ArrayList::new));
        List<String> citySample = streets.subList(0, Math.min(20, streets.size()));
        Map<String, List<String>> citiesByStreet = findCities(citySample);
        String city = chooseCity(citiesByStreet);
        Map<String, Location> locations = city.isBlank() ? Map.of() : findStreetLocations(city, streets);
        List<Map<String, Object>> plans = new ArrayList<>();
        for (DistributionRouteRequest.Assignment assignment : assignments) {
            List<String> source = assignment.streets() == null ? List.of() : assignment.streets();
            List<String> found = source.stream().filter(locations::containsKey).toList();
            List<String> ordered = nearestNeighbour(found, locations);
            List<String> unresolved = source.stream().filter(s -> !locations.containsKey(s)).toList();
            List<String> route = new ArrayList<>(ordered); route.addAll(unresolved);
            Map<String, Object> plan = new LinkedHashMap<>();
            plan.put("id", assignment.id()); plan.put("responsible", assignment.responsible()); plan.put("streets", route); plan.put("unresolvedStreets", unresolved); plan.put("distanceMeters", estimateDistance(ordered, locations)); plans.add(plan);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("city", city); result.put("plans", plans); result.put("geocodedStreetCount", locations.size()); return result;
    }

    // מאגר הרחובות הרשמי של GovData: כמה בקשות קצרות בלבד, גם לקובץ גדול.
    private Map<String, List<String>> findCities(List<String> streets) {
        Map<String, List<String>> result = new LinkedHashMap<>(); streets.forEach(s -> result.put(s, new ArrayList<>()));
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(8, Math.max(1, streets.size())));
        try {
            List<Future<?>> tasks = new ArrayList<>();
            for (String street : streets) tasks.add(pool.submit(() -> {
                try {
                    String filter = "{\"שם_רחוב\":\"" + street.replace("\"", "") + "\"}";
                    String url = "https://data.gov.il/api/3/action/datastore_search?resource_id=" + STREETS_RESOURCE + "&limit=100&filters=" + URLEncoder.encode(filter, StandardCharsets.UTF_8);
                    for (JsonNode row : request(url).path("result").path("records")) { String city = row.path("שם_ישוב").asText(); if (!city.isBlank() && !result.get(street).contains(city)) result.get(street).add(city); }
                } catch (Exception ignored) { }
            }));
            for (Future<?> task : tasks) task.get();
        } catch (Exception ignored) { } finally { pool.shutdownNow(); }
        return result;
    }

    // רחוב נפוץ (למשל "הרצל") קיים בערים רבות ואינו ראיה חזקה לעיר מסוימת.
    // לכן כל התאמה מקבלת משקל הפוך למספר הערים שבהן אותו רחוב קיים.
    private static String chooseCity(Map<String, List<String>> citiesByStreet) {
        Map<String, Double> score = new LinkedHashMap<>();
        citiesByStreet.values().forEach(cities -> {
            if (cities.isEmpty()) return;
            double weight = 1.0 / cities.size();
            cities.forEach(city -> score.merge(city, weight, Double::sum));
        });
        return score.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("");
    }

    // Photon הוא מנוע גיאוקודינג של OpenStreetMap. הוא מחזיר נקודה גם כאשר
    // גבול העיר או שם הרחוב אינם זמינים בשרת Overpass הציבורי.
    private Map<String, Location> findStreetLocations(String city, List<String> streets) {
        if (streets.isEmpty()) return Map.of();
        Map<String, Location> result = new ConcurrentHashMap<>();
        streets.forEach(street -> { Location cached = locationCache.get(city + "|" + street); if (cached != null) result.put(street, cached); });
        List<String> missing = streets.stream().filter(street -> !result.containsKey(street)).toList();
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(12, Math.max(1, missing.size())));
        try {
            List<Future<?>> tasks = new ArrayList<>();
            for (String street : missing) tasks.add(pool.submit(() -> {
                try {
                    String query = URLEncoder.encode(street + ", " + city + ", ישראל", StandardCharsets.UTF_8);
                    JsonNode feature = request("https://photon.komoot.io/api/?limit=1&q=" + query, Duration.ofSeconds(12)).path("features").path(0);
                    JsonNode coordinates = feature.path("geometry").path("coordinates");
                    if (coordinates.isArray() && coordinates.size() >= 2) { Location location = new Location(coordinates.get(1).asDouble(), coordinates.get(0).asDouble()); result.put(street, location); locationCache.put(city + "|" + street, location); }
                } catch (Exception ignored) { }
            }));
            for (Future<?> task : tasks) task.get();
        } catch (Exception ignored) { } finally { pool.shutdownNow(); }
        return result;
    }

    private JsonNode request(String url) throws Exception { return request(url, Duration.ofSeconds(30)); }
    private JsonNode request(String url, Duration timeout) throws Exception { HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).header("User-Agent", "eCvite-distribution-planner/1.0").GET().build(); return mapper.readTree(http.send(request, HttpResponse.BodyHandlers.ofString()).body()); }
    private static boolean sameStreet(String a, String b) { return a.replaceAll("[\\s׳'\"״-]", "").equalsIgnoreCase(b.replaceAll("[\\s׳'\"״-]", "")); }
    private static List<String> nearestNeighbour(List<String> streets, Map<String, Location> locations) { List<String> remaining = new ArrayList<>(streets), ordered = new ArrayList<>(); if (remaining.isEmpty()) return ordered; ordered.add(remaining.remove(0)); while (!remaining.isEmpty()) { String current = ordered.get(ordered.size() - 1); String next = remaining.stream().min(Comparator.comparingDouble(s -> distance(locations.get(current), locations.get(s)))).orElseThrow(); ordered.add(next); remaining.remove(next); } return ordered; }
    private static long estimateDistance(List<String> streets, Map<String, Location> locations) { double total = 0; for (int i = 1; i < streets.size(); i++) total += distance(locations.get(streets.get(i - 1)), locations.get(streets.get(i))); return Math.round(total); }
    private static double distance(Location a, Location b) { double dLat = Math.toRadians(b.lat - a.lat), dLon = Math.toRadians(b.lon - a.lon), h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(a.lat)) * Math.cos(Math.toRadians(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
    private record Location(double lat, double lon) {}
}
