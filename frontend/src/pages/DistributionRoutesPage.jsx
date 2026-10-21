import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import * as XLSX from 'xlsx';
import api from '../services/api';
import PrintModal from '../components/PrintModal';

const normalize = (value) => String(value ?? '').replace(/[״"'׳]/g, '').replace(/^רחוב\s+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const findColumn = (row, names) => {
  const keys = Object.keys(row);
  return keys.find((key) => names.includes(normalize(key)))
    || keys.find((key) => names.some((name) => normalize(key).includes(name)));
};
function parseStreetSpec(value) {
  const original = String(value ?? '').trim();
  let street = original.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  let minHouse = null;
  let maxHouse = null;
  let houseNumbers = [];
  const range = street.match(/(?:\u05d1\u05ea\u05d9\u05dd?\s*)?(\d+)\s*(?:-|–|\u05e2\u05d3)\s*(\d+)/);
  const until = street.match(/\u05e2\u05d3\s*(?:\u05d1\u05d9\u05ea\s*)?(\d+)/);
  const from = street.match(/(?:\u05de\u05e2\u05dc|\u05de\u05d1\u05d9\u05ea|\u05de)\s*(?:\u05d1\u05d9\u05ea\s*)?(\d+)(?:\s*(?:\u05d5\u05de\u05e2\u05dc\u05d4|\u05d5\u05d4\u05dc\u05d0\u05d4|\u05d5\u05e2\u05d3\s+\u05e1\u05d5\u05e3))?/);
  if (range) { minHouse = Number(range[1]); maxHouse = Number(range[2]); }
  else if (until) maxHouse = Number(until[1]);
  else if (from) minHouse = Number(from[1]);
  else houseNumbers = [...street.matchAll(/\d+/g)].map((match) => Number(match[0]));
  street = street
    .replace(/(?:\u05d1\u05ea\u05d9\u05dd?\s*)?\d+\s*(?:-|–|\u05e2\u05d3)\s*\d+/g, '')
    .replace(/(?:\u05de\u05e2\u05dc|\u05de\u05d1\u05d9\u05ea|\u05de)\s*(?:\u05d1\u05d9\u05ea\s*)?\d+(?:\s*(?:\u05d5\u05de\u05e2\u05dc\u05d4|\u05d5\u05d4\u05dc\u05d0\u05d4|\u05d5\u05e2\u05d3\s+\u05e1\u05d5\u05e3))?/g, '')
    .replace(/\u05e2\u05d3\s*(?:\u05d1\u05d9\u05ea\s*)?\d+/g, '')
    .replace(/\d+/g, '')
    .replace(/[,;–-]+$/g, '')
    .trim();
  return street ? { street, label: original, minHouse, maxHouse, houseNumbers } : null;
}
const streetSpecsFrom = (value) => {
  const parts = String(value ?? '').split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  const grouped = [];
  parts.forEach((part) => {
    // A numeric item after a street belongs to that street: "Herzl 2, 4, 6".
    if (/^\d+(?:\s*(?:-|–)\s*\d+)?$/.test(part) && grouped.length) grouped[grouped.length - 1] += `, ${part}`;
    else grouped.push(part);
  });
  return grouped.map(parseStreetSpec).filter(Boolean);
};
const houseNumber = (value) => { const match = String(value ?? '').match(/\d+/); return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER; };
const cleanHouseNo = (value) => String(value ?? '').match(/\d+[א-ת]?/)?.[0] ?? '';
function cleanRecipientStreet(recipient) {
  const street = String(recipient.street ?? '').trim();
  const trailingHouse = street.match(/^(.*?)[,\s]+(\d+[א-ת]?)$/);
  const house = cleanHouseNo(recipient.houseNo);
  return trailingHouse && (!house || trailingHouse[2] === house) ? trailingHouse[1].trim() : street;
}
function labelHouseNo(recipient) {
  const fromColumn = cleanHouseNo(recipient.houseNo);
  if (fromColumn) return fromColumn;
  return String(recipient.street ?? '').match(/(?:^|[,\s])(\d+[\u0590-\u05FF]?)\s*$/)?.[1] ?? '';
}
function cleanLabelStreet(recipient) {
  const house = labelHouseNo(recipient);
  let street = String(recipient.street ?? '').trim();
  if (house) {
    const escapedHouse = house.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street.replace(new RegExp(`(?:^|\\s)${escapedHouse}(?=\\s|$)`, 'g'), ' ');
  }
  street = street.replace(/\s+/g, ' ').trim();

  // Some imports repeat the full street value, for example: "Street 3 Street 3".
  const words = street.split(' ').filter(Boolean);
  if (words.length > 1 && words.length % 2 === 0) {
    const halfway = words.length / 2;
    if (normalize(words.slice(0, halfway).join(' ')) === normalize(words.slice(halfway).join(' '))) {
      street = words.slice(0, halfway).join(' ');
    }
  }
  return street;
}
function recipientPeople(recipient) {
  const cleanName = (value) => {
    const name = String(value ?? '').trim();
    return name;
  };
  const man = cleanName(recipient.man);
  const woman = cleanName(recipient.woman);
  const lastName = cleanName(recipient.lastName);
  const firstNames = man && woman ? `${man} ו${woman}` : man || woman;
  return [firstNames, lastName].filter(Boolean).join(' ') || 'ללא שם';
}
const hasNumberInName = (recipient) => [recipient.man, recipient.woman, recipient.lastName].some((value) => /\d/.test(String(value ?? '')));
const hasEnglishInsideHebrewName = (recipient) => [recipient.man, recipient.woman, recipient.lastName]
  .some((value) => /[A-Za-z]/.test(String(value ?? '')) && /[\u0590-\u05FF]/.test(String(value ?? '')));
const hasTestName = (recipient) => [recipient.man, recipient.woman, recipient.lastName]
  .some((value) => /\bte(?:st\w*)?\b/i.test(String(value ?? '').trim()));
const houseRangeLabel = (spec) => spec.houseNumbers?.length ? `\u05d1\u05ea\u05d9\u05dd ${spec.houseNumbers.join(',')}` : spec.minHouse !== null && spec.maxHouse !== null ? `\u05d1\u05ea\u05d9\u05dd ${spec.minHouse}–${spec.maxHouse}` : spec.minHouse !== null ? `\u05de\u05d1\u05d9\u05ea ${spec.minHouse} \u05d5\u05de\u05e2\u05dc\u05d4` : spec.maxHouse !== null ? `\u05e2\u05d3 \u05d1\u05d9\u05ea ${spec.maxHouse}` : '\u05db\u05dc \u05de\u05e1\u05e4\u05e8\u05d9 \u05d4\u05d1\u05ea\u05d9\u05dd';
const sameStreet = (first, second) => {
  const a = normalize(first).replace(/[,.]/g, '');
  const b = normalize(second).replace(/[,.]/g, '');
  return Boolean(a && b) && (a === b || a.includes(b) || b.includes(a));
};
const sameCity = (first, second) => {
  const a = normalize(first);
  const b = normalize(second);
  return Boolean(a && b) && (a === b || a.includes(b) || b.includes(a));
};
const loadRouteSession = () => {
  try { return JSON.parse(sessionStorage.getItem('distribution-routes-session') || '{}'); } catch { return {}; }
};

async function readAssignments(file) {
  const workbook = XLSX.read(await file.arrayBuffer());
  return workbook.SheetNames.flatMap((sheetName) => XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })).map((row, index) => {
    const responsible = findColumn(row, ['האחראית', 'אחראי', 'מחלקת', 'שם', 'שם מלא']);
    const street = findColumn(row, ['רחובות', 'רחוב', 'כתובת']);
    const streetSpecs = streetSpecsFrom(row[street]);
    return { id: String(index), responsible: String(row[responsible] ?? '').trim(), streetSpecs };
  }).filter((assignment) => assignment.responsible && assignment.streetSpecs.length);
}

function getMainScreenRecipients(phone) {
  try {
    const rows = JSON.parse(localStorage.getItem(`records-${phone}`) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

export default function DistributionRoutesPage() {
  const navigate = useNavigate();
  const savedSession = useMemo(loadRouteSession, []);
  // Re-read saved street labels so older sessions also receive the current range rules.
  const [plans, setPlans] = useState(() => (savedSession.plans || []).map((plan) => ({
    ...plan,
    streetSpecs: (plan.streetSpecs || []).map((spec) => parseStreetSpec(spec.label || spec.street) || spec),
  })));
  const [recipients, setRecipients] = useState([]);
  const [city, setCity] = useState(() => savedSession.city || '');
  const [fileName, setFileName] = useState(() => savedSession.fileName || '');
  const [markedGuests, setMarkedGuests] = useState(() => savedSession.markedGuests || {});
  const [labelEdits, setLabelEdits] = useState(() => savedSession.labelEdits || {});
  const [removedLabelIds, setRemovedLabelIds] = useState(() => savedSession.removedLabelIds || {});
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);
  const [isLabelEditorOpen, setIsLabelEditorOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState('');
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [refreshingRecipients, setRefreshingRecipients] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('');
  const user = useMemo(() => { try { return JSON.parse(sessionStorage.getItem('user') || 'null'); } catch { return null; } }, []);
  const refreshRecipients = async () => {
    if (!user?.phone) return;
    setRefreshingRecipients(true);
    const localRecipients = getMainScreenRecipients(user.phone);
    if (localRecipients.length) {
      setRecipients(localRecipients);
      setLastRefresh('רשימת המוזמנים עודכנה מהמסך הראשי.');
      setRefreshingRecipients(false);
      return;
    }
    try {
      const { data } = await api.getRecipients(user.phone);
      setRecipients(Array.isArray(data) ? data : []);
      setLastRefresh('רשימת המוזמנים עודכנה.');
    } catch {
      setError('לא ניתן לרענן את רשימת המוזמנים.');
    } finally { setRefreshingRecipients(false); }
  };
  useEffect(() => {
    refreshRecipients();
    // טעינה ראשונית בלבד; לחצן הרענון קורא שוב את הרשימה העדכנית.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);
  useEffect(() => {
    sessionStorage.setItem('distribution-routes-session', JSON.stringify({ plans, city, fileName, markedGuests, labelEdits, removedLabelIds }));
  }, [plans, city, fileName, markedGuests, labelEdits, removedLabelIds]);
  const cityRecipients = useMemo(() => recipients.filter((recipient) => sameCity(recipient.city, city)), [recipients, city]);
  const allGuests = cityRecipients;
  const orderedPlans = useMemo(() => plans.map((plan) => {
    const seenGuests = new Set();
    const guests = [];
    plan.streetSpecs.forEach((spec, streetOrder) => {
      allGuests
        .filter((recipient) => !hasNumberInName(recipient))
        .filter((recipient) => !hasEnglishInsideHebrewName(recipient))
        .filter((recipient) => !hasTestName(recipient))
        .filter((recipient) => sameStreet(cleanRecipientStreet(recipient), spec.street))
        .filter((recipient) => {
          const number = houseNumber(recipient.houseNo);
          if (spec.houseNumbers?.length) return spec.houseNumbers.includes(number);
          return (spec.minHouse === null || number >= spec.minHouse) && (spec.maxHouse === null || number <= spec.maxHouse);
        })
        .sort((a, b) => houseNumber(a.houseNo) - houseNumber(b.houseNo) || recipientPeople(a).localeCompare(recipientPeople(b), 'he'))
        .forEach((recipient) => {
          // אותה משפחה יכולה להגיע מהמסך הראשי גם בשורה ישנה בלי מספר בית וגם בשורה מעודכנת.
          // מזהה השורה שונה, אבל מבחינת חלוקה זו אותה משפחה באותו רחוב.
          const key = `${normalize(cleanRecipientStreet(recipient))}|${normalize(recipientPeople(recipient))}`;
          if (!seenGuests.has(key)) { seenGuests.add(key); guests.push({ ...recipient, streetOrder }); }
        });
    });
    const addressGroups = new Map();
    guests.forEach((guest) => {
      const street = cleanRecipientStreet(guest);
      const houseNo = cleanHouseNo(guest.houseNo);
      const key = `${normalize(street)}|${houseNo}`;
      if (!addressGroups.has(key)) addressGroups.set(key, { street, houseNo, guests: [] });
      const group = addressGroups.get(key);
      const personKey = recipientPeople(guest);
      if (!group.guests.some((item) => recipientPeople(item) === personKey)) group.guests.push(guest);
    });
    return { ...plan, guests, addressGroups: [...addressGroups.values()] };
  }), [plans, allGuests]);
  const summary = useMemo(() => orderedPlans.reduce((count, plan) => count + plan.streetSpecs.length, 0), [orderedPlans]);
  const allRouteLabelRows = useMemo(() => orderedPlans.flatMap((plan, planIndex) => {
    // Street numbers on labels are compact: streets without matching guests do not receive a number.
    const usedStreetOrders = [...new Set(plan.guests.map((guest) => guest.streetOrder))].sort((a, b) => a - b);
    const compactStreetNumbers = new Map(usedStreetOrders.map((streetOrder, index) => [streetOrder, index + 1]));
    return plan.guests.map((guest, guestIndex) => {
      const id = `route-label-${plan.id}-${guestIndex}`;
      return {
        ...guest,
        // A unique id is required when the same recipient belongs to more than one route.
        id,
        hashCode: undefined,
        street: cleanLabelStreet(guest),
        houseNo: labelHouseNo(guest),
        city: guest.city || city,
        ...(labelEdits[id] || {}),
        printEnabled: true,
        routeAssignment: { bagNumber: planIndex + 1, streetNumber: compactStreetNumbers.get(guest.streetOrder) },
      };
    });
  }), [orderedPlans, city, labelEdits]);
  const routeLabelRows = useMemo(() => allRouteLabelRows.filter((row) => !removedLabelIds[row.id]), [allRouteLabelRows, removedLabelIds]);
  const routeAssignments = useMemo(() => Object.fromEntries(routeLabelRows.map((row) => [String(row.id), row.routeAssignment])), [routeLabelRows]);
  const editingLabel = useMemo(() => allRouteLabelRows.find((row) => row.id === editingLabelId) || null, [allRouteLabelRows, editingLabelId]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCalculating(true); setError(''); setLabelEdits({}); setRemovedLabelIds({});
    try {
      const assignments = await readAssignments(file);
      if (!assignments.length) throw new Error('missing-columns');
      const { data } = await api.optimizeDistributionRoutes(assignments.map(({ id, responsible, streetSpecs }) => ({ id, responsible, streets: streetSpecs.map((spec) => spec.street) })));
      if (!data.plans?.length) throw new Error('no-plans');
      const byId = new Map(assignments.map((assignment) => [assignment.id, assignment]));
      setPlans(data.plans.map((plan) => {
        const remaining = [...(byId.get(plan.id)?.streetSpecs || [])];
        const seenStreetSpecs = new Set();
        const streetSpecs = plan.streets.map((street) => {
          const index = remaining.findIndex((spec) => normalize(spec.street) === normalize(street));
          return index >= 0 ? remaining.splice(index, 1)[0] : { street, label: street, minHouse: null, maxHouse: null };
        }).filter((spec) => {
          const key = `${normalize(spec.street)}|${spec.minHouse ?? ''}|${spec.maxHouse ?? ''}`;
          if (seenStreetSpecs.has(key)) return false;
          seenStreetSpecs.add(key);
          return true;
        });
        return { ...plan, streetSpecs };
      })); setCity(data.city || 'לא זוהתה עיר'); setFileName(file.name);
    } catch (requestError) {
      setPlans([]); setCity('');
      setError(requestError?.response?.status === 404
        ? 'שרת המסלולים עדיין לא נטען. הפעילי מחדש את ה־backend ונסי שוב.'
        : 'לא ניתן לחשב את המסלולים. ודאי שקיימות עמודות אחראית ורחוב ונסי שוב.');
    } finally { setCalculating(false); event.target.value = ''; }
  };

  const guestKey = (plan, guest) => `${plan.id}|${normalize(cleanRecipientStreet(guest))}|${cleanHouseNo(guest.houseNo)}|${normalize(recipientPeople(guest))}`;
  const toggleGuest = (plan, guest) => {
    const key = guestKey(plan, guest);
    setMarkedGuests((current) => ({ ...current, [key]: !current[key] }));
  };
  const openLabelEditor = () => {
    setEditingLabelId((current) => current || allRouteLabelRows[0]?.id || '');
    setIsLabelEditorOpen(true);
  };
  const updateLabel = (field, value) => {
    if (!editingLabel) return;
    setLabelEdits((current) => ({
      ...current,
      [editingLabel.id]: { ...(current[editingLabel.id] || {}), [field]: value },
    }));
  };
  const toggleLabelRemoval = (labelId) => {
    setRemovedLabelIds((current) => ({ ...current, [labelId]: !current[labelId] }));
  };

  return <Container maxWidth="lg" sx={{ py: 3 }}>
    <style>{`@media print { .route-actions, .map-warning { display:none !important; } .instruction-card { break-after: page; box-shadow:none !important; border:0 !important; min-height:92vh; } }`}</style>
    <Stack className="route-actions" direction="row" justifyContent="space-between" alignItems="center" mb={3}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>חזרה לרשימת המוזמנים</Button>
      <Stack direction="row" spacing={1}><Button component="label" variant="outlined" disabled={calculating}>העלאת רשימת חלוקה<input hidden type="file" accept=".xlsx,.xls" onChange={handleFile} /></Button><Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshRecipients} disabled={refreshingRecipients}>{refreshingRecipients ? 'מרענן…' : 'רענון מוזמנים'}</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={() => setIsLabelPrintOpen(true)} disabled={!routeLabelRows.length}>{'\u05d4\u05d3\u05e4\u05e1\u05ea \u05de\u05d3\u05d1\u05e7\u05d5\u05ea'}</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!plans.length}>הדפסת דפי הוראות</Button></Stack>
    </Stack>
    <Typography variant="h4" fontWeight={700} mb={0.5}>מסלולי חלוקה חכמים</Typography>
    <Typography color="text.secondary" mb={1}>העלי קובץ עם עמודות אחראית ורחוב. העיר מזוהה אוטומטית מתוך הכתובות, והרחובות מסודרים לכל אחראית לפי קרבה גאוגרפית.</Typography>
    <Alert severity="info" className="route-actions" sx={{ mb: 3 }}>החיפוש במאגרי הרחובות ובמפה עלול להימשך מספר דקות, בהתאם לגודל הרשימה ולעומס בשירותים החיצוניים.</Alert>
    {calculating && <Box textAlign="center" py={7}><CircularProgress /><Typography mt={2}>מזהה עיר ומחשב סדר הליכה…</Typography></Box>}
    {error && <Alert severity="warning" className="route-actions" sx={{ mb: 2 }}>{error}</Alert>}
    {lastRefresh && <Alert severity="success" className="route-actions" sx={{ mb: 2 }} onClose={() => setLastRefresh('')}>{lastRefresh}</Alert>}
    {!calculating && !plans.length && !error && <Alert severity="info">העלי קובץ Excel כדי ליצור את המסלולים.</Alert>}
    {!calculating && orderedPlans.length > 0 && <><Card className="route-actions" variant="outlined" sx={{ mb: 3 }}><CardContent><Typography fontWeight={700}>עיר שזוהתה: {city}</Typography><Typography color="text.secondary">{fileName} · {orderedPlans.length} אחראיות · {summary} רחובות · {cityRecipients.length} מוזמנים מרשימת המוזמנים במסך הראשי בעיר זו</Typography></CardContent></Card><Stack spacing={2}>{orderedPlans.map((plan, index) => <Card className="instruction-card" key={plan.id} variant="outlined"><CardContent sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between" alignItems="start" mb={2}><Box><Typography variant="h5" fontWeight={700}>{plan.responsible}</Typography><Typography color="text.secondary">מסלול {index + 1} · {city}</Typography></Box><Chip label={`${plan.guests.length} מוזמנים`} color="primary" variant="outlined" /></Stack><Divider sx={{ mb: 2 }} /><Typography fontWeight={700} mb={0.5}>הוראות חלוקה</Typography><Typography sx={{ fontSize:'1.08rem', lineHeight:1.8 }}>{plan.streetSpecs.length ? `התחילי ב${plan.streetSpecs[0].label} והמשיכי לפי הסדר: ${plan.streetSpecs.map((spec) => spec.label).join(' ← ')}.` : 'לא נמצאו רחובות לחישוב.'}</Typography><Typography fontWeight={700} mt={3} mb={0.5}>רחובות ומספרי בתים שהוקצו</Typography><Stack spacing={0.25}>{plan.streetSpecs.map((spec, specIndex) => <Typography key={`${spec.street}-${specIndex}`} color="text.secondary">{spec.street}: {houseRangeLabel(spec)}</Typography>)}</Stack><Typography fontWeight={700} mt={3} mb={1}>מוזמנים לפי סדר החלוקה</Typography>{plan.addressGroups.length ? <Stack spacing={1}>{plan.addressGroups.map((group, groupIndex) => <Box key={`${group.street}-${group.houseNo}-${groupIndex}`}><Typography fontWeight={700}>{group.street} {group.houseNo || ''}</Typography>{group.guests.map((guest, guestIndex) => <Stack key={guest.hashCode || `${guest.id}-${guestIndex}`} direction="row" alignItems="center" spacing={0.25} sx={{ pr: 1 }}><Checkbox size="small" checked={Boolean(markedGuests[guestKey(plan, guest)])} onChange={() => toggleGuest(plan, guest)} inputProps={{ 'aria-label': `סימון ${recipientPeople(guest)}` }} /><Typography>{recipientPeople(guest)}</Typography></Stack>)}</Box>)}</Stack> : <Typography color="text.secondary">לא נמצאו מוזמנים התואמים לרחובות ולטווחי הבתים באזור זה.</Typography>}{plan.unresolvedStreets?.length > 0 && <Alert severity="info" className="map-warning" sx={{ mt: 2 }}>לא נמצאה נקודה במפה עבור: {plan.unresolvedStreets.join(', ')}. הרחובות הושארו בסוף המסלול.</Alert>}</CardContent></Card>)}</Stack></>}
    <Dialog open={isLabelEditorOpen} onClose={() => setIsLabelEditorOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>עריכת מדבקות למסלולי החלוקה</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ minHeight: 380 }}>
          <List dense sx={{ width: { xs: '100%', sm: '42%' }, maxHeight: 470, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {allRouteLabelRows.map((row) => <ListItemButton key={row.id} selected={editingLabelId === row.id} onClick={() => setEditingLabelId(row.id)}>
              <Checkbox
                size="small"
                checked={!removedLabelIds[row.id]}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleLabelRemoval(row.id)}
                inputProps={{ 'aria-label': `הדפסת המדבקה של ${recipientPeople(row)}` }}
              />
              <ListItemText primary={row.display ?? recipientPeople(row)} secondary={`${row.street || ''} ${row.houseNo || ''}`} />
            </ListItemButton>)}
          </List>
          <Stack spacing={2} flex={1}>
            {editingLabel ? <>
              <Typography color="text.secondary">שינוי כאן משפיע רק על המדבקה במסך המסלולים.</Typography>
              <FormControlLabel control={<Checkbox checked={!removedLabelIds[editingLabel.id]} onChange={() => toggleLabelRemoval(editingLabel.id)} />} label="כלול בהדפסה" />
              <TextField fullWidth label="שם על המדבקה" value={labelEdits[editingLabel.id]?.display ?? recipientPeople(editingLabel)} onChange={(event) => updateLabel('display', event.target.value)} />
              <TextField fullWidth label="רחוב" value={editingLabel.street || ''} onChange={(event) => updateLabel('street', event.target.value)} />
              <Stack direction="row" spacing={1}>
                <TextField fullWidth label="מספר בית" value={editingLabel.houseNo || ''} onChange={(event) => updateLabel('houseNo', event.target.value)} />
                <TextField fullWidth label="עיר" value={editingLabel.city || ''} onChange={(event) => updateLabel('city', event.target.value)} />
              </Stack>
            </> : <Typography color="text.secondary">אין מדבקות לעריכה.</Typography>}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setIsLabelEditorOpen(false)}>סיום</Button></DialogActions>
    </Dialog>
    <PrintModal
      open={isLabelPrintOpen}
      onClose={() => setIsLabelPrintOpen(false)}
      selectedRows={routeLabelRows}
      records={routeLabelRows}
      routeAssignments={routeAssignments}
      returnPath="/distribution-routes"
      onOpenLabelEditor={openLabelEditor}
    />
  </Container>;
}
