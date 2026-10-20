// src/components/PrintModal.jsx
import { useEffect, useState } from 'react';
import { Modal, Box, Typography, Button, RadioGroup, FormControlLabel, Radio, FormControl, InputLabel, Select, MenuItem, Stack, Divider, Snackbar, Alert, IconButton, Checkbox, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useNavigate } from 'react-router-dom';
import { loadLabelPrintSettings, saveLabelPrintSettings } from '../utils/labelPrintSettings';
import { orderLikeTable } from '../utils/printOrder';
// 🌟 ייבוא הקבועים החדשים מהעמוד הייעודי
import { MODAL_TEXTS, FONT_OPTIONS } from '../pages/HardCodePage';
import {
  getScaledLabelSizes,
  getColumns,
  getMaxFontScale,
  clampFontScale,
  FONT_SCALE_MIN,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_STEP,
} from '../utils/labelSheetLayout';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  // חלון גבוה מהמסך (הרבה אפשרויות, או מסך נמוך) לא נחתך: הכותרת והכפתורים נשארים
  // במקום, ורק האפשרויות שביניהם נגללות (ר' שלב 2)
  maxHeight: '96vh',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
};

// רוחב וגובה קבועים לאזור התצוגה - הם לא זזים/גדלים בעצמם, רק המדבקות בתוכם משתנות
const PREVIEW_PANEL_WIDTH = 260;
const PAGE_BOX_HEIGHT = 190;
const GRID_PADDING_PX = 16; // padding של 1 (8px) מכל צד

// "עמוד" וירטואלי בגודל קבוע - ככל שהמדבקה קטנה יותר, יותר מהן נכנסות באותו שטח בדיוק.
// הגדלים והמרווח מגיעים בקנה מידה מוקטן מאותו מקור אמת שדף ההדפסה האמיתי משתמש בו,
// כך שמספר העמודות שרואים כאן תמיד זהה למספר שיודפס בפועל.
const PAGE_CONTENT_WIDTH = PREVIEW_PANEL_WIDTH - GRID_PADDING_PX;
const PAGE_CONTENT_HEIGHT = PAGE_BOX_HEIGHT - GRID_PADDING_PX;
const { gap: MOCK_GAP_PX, sizes: MOCK_LABEL_SIZES } = getScaledLabelSizes(PAGE_CONTENT_WIDTH);
const SELECTED_ROW_IDS_STORAGE_KEY = 'dashboardSelectedIds';
const SELECTED_ROWS_STORAGE_KEY = 'dashboardSelectedRows';
const CUSTOM_ENGLISH_SALUTATION = '__custom__';
const PRESET_ENGLISH_SALUTATIONS = ['', 'To:', 'Dear'];
const GREETING_ALIGNMENTS = ['right', 'center', 'left'];

function saveSelectedRows(rows) {
  sessionStorage.setItem(SELECTED_ROWS_STORAGE_KEY, JSON.stringify(rows));
  sessionStorage.setItem(
    SELECTED_ROW_IDS_STORAGE_KEY,
    JSON.stringify(rows.map((row) => row.id).filter((id) => id !== undefined && id !== null)),
  );
}

function getLabelsPerPage(size) {
  const columns = getColumns(PAGE_CONTENT_WIDTH, size.width, MOCK_GAP_PX);
  const rows = Math.max(1, Math.floor((PAGE_CONTENT_HEIGHT + MOCK_GAP_PX) / (size.height + MOCK_GAP_PX)));
  return { columns, rows, count: columns * rows };
}

// מדבקה "ריקה" - ריבוע עם פסים במקום טקסט אמיתי, בדיוק כמו שהדבר נראה בתבניות מדבקות של Word
function MockLabel({ width, height }) {
  return (
    <Box
      sx={{
        width,
        height,
        border: '1px solid #999',
        borderRadius: 0.5,
        bgcolor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.5,
        p: 0.5,
      }}
    >
      <Box sx={{ height: 4, width: '80%', bgcolor: 'grey.500', borderRadius: 2 }} />
      <Box sx={{ height: 3, width: '60%', bgcolor: 'grey.400', borderRadius: 2 }} />
    </Box>
  );
}

// תצוגה קטנה בצד: מדבקה בודדת + רשת מדבקות שמדמה איך הדף המודפס ייראה.
// הרוחב הכולל של הפאנל קבוע (PREVIEW_PANEL_WIDTH) ולא משתנה - רק המדבקות עצמן גדלות/קטנות בתוכו.
function LabelSheetPreview({ labelSize }) {
  const size = MOCK_LABEL_SIZES[labelSize] || MOCK_LABEL_SIZES.standard;
  const { columns, count } = getLabelsPerPage(size);

  return (
    <Box sx={{ width: PREVIEW_PANEL_WIDTH, flexShrink: 0, flexGrow: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>מדבקה בודדת</Typography>
      <Box sx={{ width: '100%', height: 90, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <MockLabel {...size} />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1, mb: 0.5 }}>
        תצוגת דף ההדפסה ({count} מדבקות בעמוד)
      </Typography>
      <Box
        sx={{
          width: '100%',
          height: PAGE_BOX_HEIGHT,
          border: '1px solid #ccc',
          borderRadius: 1,
          p: 1,
          bgcolor: '#fafafa',
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, ${size.width}px)`,
          gridAutoRows: `${size.height}px`,
          justifyContent: 'center',
          alignContent: 'center',
          gap: `${MOCK_GAP_PX}px`,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <MockLabel key={i} {...size} />
        ))}
      </Box>
    </Box>
  );
}

export default function PrintModal({ open, onClose, selectedRows, records: allRecords = [], visibleRows = null }) {
  const navigate = useNavigate();
  // visibleRows - { rows, filtered } מהטבלה (ר' VisibleRowsContext). כשהטבלה מסוננת (חיפוש
  // או חלון "סינון") - "כולן" הן השורות שמוצגות בה, לא כל הרשימה
  const records = visibleRows?.filtered ? visibleRows.rows : allRecords;

  // אם לא סימנו אף שורה - מדפיסים את כולן, במקום לא להדפיס כלום. בכל מקרה - בסדר המיון
  // של הטבלה, גם שורות שסומנו (אחרת היו יוצאות בסדר שבו סימנו אותן)
  const rowsToPrint = orderLikeTable(selectedRows.length > 0 ? selectedRows : records, visibleRows?.rows)
    .filter((row) => row.printEnabled !== false);
  
  // 1. בדיקה בטוחה עבור השלב (Step)
  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('fromPreview') === 'true' ? 2 : 1;
    }
    return 1;
  });

  // הבחירות השמורות של המשתמשת המחוברת (בשרת אצלה, ר' labelPrintSettings.js) - אחרי
  // הפעם הראשונה אלה ברירות המחדל שלה. נקרא פעם אחת, כשהחלון נטען
  const [userLabelSettings] = useState(loadLabelPrintSettings);

  // ערך התחלתי לכל בחירה: קודם מה שנשמר בחזרה מהתצוגה המקדימה ("שינוי הגדרות
  // הדפסה"), אחר כך הבחירה השמורה של המשתמשת, ורק אז ברירת המחדל. ערך לא תקין
  // (כמו "printer1" מגרסה קודמת, או כתב שכבר לא ברשימה) מדולג
  const initialChoice = (sessionKey, prefKey, isValid, fallback) => {
    const fromPreview = typeof window !== 'undefined' ? sessionStorage.getItem(sessionKey) : null;
    if (fromPreview !== null && isValid(fromPreview)) return fromPreview;
    const fromUser = userLabelSettings[prefKey];
    if (fromUser !== undefined && fromUser !== null && isValid(String(fromUser))) return String(fromUser);
    return fallback;
  };
  const isLabelSize = (v) => v === 'standard' || v === 'large';
  const initialLabelSize = initialChoice('savedLabelSize', 'labelSize', isLabelSize, 'standard');

  // 2. גודל המדבקה
  const [labelSize, setLabelSize] = useState(initialLabelSize);

  // 3. המדפסת
  const [printer, setPrinter] = useState(() =>
    initialChoice('savedPrinter', 'printer', (v) => v === 'home' || v === 'office', 'home'));

  // 3.1 אופן קבלת ההדפסה (רלוונטי רק כשבוחרים במדפסת המשרד)
  const [deliveryMethod, setDeliveryMethod] = useState(() =>
    initialChoice('savedDeliveryMethod', 'deliveryMethod', (v) => v === 'courier' || v === 'pickup', 'courier'));

  // 4. סוג הכתב
  const [fontType, setFontType] = useState(() =>
    initialChoice('savedFontType', 'fontType', (v) => FONT_OPTIONS.some((f) => f.value === v), FONT_OPTIONS[0].value));

  // 5. גודל כתב (אחוז מהגודל הרגיל, 100 = כמו היום) - חופשי, אבל רק עד המקסימום
  // שנכנס בגודל המדבקה שנבחר (ר' getMaxFontScale)
  const [fontScale, setFontScale] = useState(() => clampFontScale(
    initialChoice('savedFontScale', 'fontScale', (v) => v.trim() !== '' && Number.isFinite(Number(v)), String(FONT_SCALE_DEFAULT)),
    initialLabelSize
  ));

  // 6. עובי כתב לכל המדבקה, כולל השם - "רגיל" או "מודגש"
  const [fontWeight, setFontWeight] = useState(() =>
    initialChoice('savedFontWeight', 'fontWeight', (v) => v === 'regular' || v === 'bold', 'regular'));

  const [englishSalutation, setEnglishSalutation] = useState(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('savedEnglishSalutation') || '' : '';
    return PRESET_ENGLISH_SALUTATIONS.includes(saved) ? saved : CUSTOM_ENGLISH_SALUTATION;
  });
  const [customEnglishSalutation, setCustomEnglishSalutation] = useState(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('savedEnglishSalutation') || '' : '';
    return PRESET_ENGLISH_SALUTATIONS.includes(saved) ? '' : saved;
  });
  const selectedEnglishSalutation = englishSalutation === CUSTOM_ENGLISH_SALUTATION
    ? customEnglishSalutation.trim()
    : englishSalutation;

  // 5. שורה ריקה במקום הכתובת כשלנמען אין רחוב/מספר בית - מסומן כברירת מחדל. ערך
  // שמור (חזרה מ"שינוי הגדרות" בתצוגה המקדימה) גובר, ואחריו הבחירה השמורה של
  // המשתמשת - כולל אם הורידו את הסימון
  const [emptyLineWhenNoAddress, setEmptyLineWhenNoAddress] = useState(() =>
    initialChoice('savedEmptyLineWhenNoAddress', 'emptyLineWhenNoAddress', (v) => v === 'true' || v === 'false', 'true') === 'true');

  // 7. "לכבוד" במדבקה בעברית - האם להדפיס אותו, האם בשורה נפרדת מעל השם (ברירת
  // המחדל), ואם כן באיזה צד. נשמר למשתמשת כמו שאר הבחירות
  const isBooleanString = (v) => v === 'true' || v === 'false';
  const [greetingShow, setGreetingShow] = useState(() =>
    initialChoice('savedGreetingShow', 'greetingShow', isBooleanString, 'true') === 'true');
  const [greetingSeparateLine, setGreetingSeparateLine] = useState(() =>
    initialChoice('savedGreetingSeparateLine', 'greetingSeparateLine', isBooleanString, 'true') === 'true');
  const [greetingAlign, setGreetingAlign] = useState(() =>
    initialChoice('savedGreetingAlign', 'greetingAlign', (v) => GREETING_ALIGNMENTS.includes(v), 'center'));

  // הערכים שנשמרו בחזרה מהתצוגה המקדימה ("שינוי הגדרות הדפסה") נקראים פעם אחת - כבר
  // נקלטו למעלה - ונמחקים מיד. בלי זה, ערך שנשאר (למשל אחרי הדפסה מהתצוגה המקדימה
  // עצמה, או אחרי התנתקות) היה גובר בפעם הבאה על הבחירות השמורות של המשתמשת - או
  // אפילו עובר למשתמשת אחרת שמתחברת באותה לשונית
  useEffect(() => {
    ['savedLabelSize', 'savedPrinter', 'savedFontType', 'savedDeliveryMethod', 'savedFontScale', 'savedFontWeight']
      .forEach((key) => sessionStorage.removeItem(key));
    sessionStorage.removeItem('savedEmptyLineWhenNoAddress');
    ['savedGreetingShow', 'savedGreetingSeparateLine', 'savedGreetingAlign'].forEach((key) => sessionStorage.removeItem(key));
  }, []);

  // נשמר אצל המשתמשת בשרת בכל מעבר לתצוגה המקדימה/להדפסה - כדי שבפעם הבאה החלון
  // ייפתח אצלה עם הבחירות האלה. לא מחכים לתשובה - ההדפסה לא תלויה בשמירה
  const rememberChoices = () => {
    saveLabelPrintSettings({ fontType, labelSize, printer, deliveryMethod, fontScale, fontWeight, emptyLineWhenNoAddress, greetingShow, greetingSeparateLine, greetingAlign });
  };

  // מעבר לגודל מדבקה קטן יותר מוריד גודל כתב שכבר לא נכנס בו למקסימום החדש
  const handleLabelSizeChange = (newSize) => {
    setLabelSize(newSize);
    setFontScale((current) => clampFontScale(current, newSize));
  };

  const [printType, setPrintType] = useState('labels');
  const [notification, setNotification] = useState('');

  // פונקציה שמטפלת במעבר משלב 1 לשלב 2
  const handleNextStep = () => {
    if (printType === 'labels') {
      setStep(2);
    } else {
      // 🌟 שימוש בפונקציית הטקסט הדינמית מהקבועים
      setNotification(MODAL_TEXTS.NOT_AVAILABLE_ALERT(printType));
    }
  };

  const handlePrint = () => {
    rememberChoices();
    // אותו דף הדפסה בדיוק כמו מה"תצוגה מקדימה" - רק עם דגל שגורם לו לפתוח את חלון
    // ההדפסה של הדפדפן מיד בכניסה, בלי לחכות שילחצו שוב על "הדפס" שם
    saveSelectedRows(rowsToPrint);
    navigate('/print-preview', {
      state: { selectedItems: rowsToPrint, labelSize, printer, fontType, deliveryMethod, fontScale, fontWeight, englishSalutation: selectedEnglishSalutation, emptyLineWhenNoAddress, greetingShow, greetingSeparateLine, greetingAlign, autoPrint: true },
    });

    sessionStorage.removeItem('fromPreview');
    sessionStorage.removeItem('savedLabelSize');
    sessionStorage.removeItem('savedPrinter');
    sessionStorage.removeItem('savedFontType');
    sessionStorage.removeItem('savedDeliveryMethod');
    sessionStorage.removeItem('savedFontScale');
    sessionStorage.removeItem('savedFontWeight');
    sessionStorage.removeItem('savedEnglishSalutation');
    sessionStorage.removeItem('savedEmptyLineWhenNoAddress');
    sessionStorage.removeItem('savedGreetingShow');
    sessionStorage.removeItem('savedGreetingSeparateLine');
    sessionStorage.removeItem('savedGreetingAlign');
    sessionStorage.removeItem('savedFontScale');
    sessionStorage.removeItem('savedFontWeight');

    onClose();
    setStep(1);
  };

  const handlePreview = () => {
    rememberChoices();
    saveSelectedRows(rowsToPrint);
    navigate('/print-preview', { state: { selectedItems: rowsToPrint, labelSize, printer, fontType, deliveryMethod, fontScale, fontWeight, englishSalutation: selectedEnglishSalutation, emptyLineWhenNoAddress, greetingShow, greetingSeparateLine, greetingAlign } });
  };

  return (
    <>
    <Modal open={open} onClose={onClose}>
      <Box sx={{ ...modalStyle, width: step === 2 ? 740 : 400 }}>
        
        {/* --- שלב 1: על מה תרצה להדפיס? --- */}
        {step === 1 && (
          <Box>
            <Typography variant="h6" mb={2}>{MODAL_TEXTS.STEP_1_TITLE}</Typography>
            {/* שתי עמודות שוות: "מדבקות לחלוקה" בעמודה השנייה מול "מדבקות", ומעטפות ורשימות
                מתחת ל"מדבקות". "מדבקות לחלוקה" עוד לא מחוברת להדפסה, כמו מעטפות ורשימות */}
            <RadioGroup value={printType} onChange={(e) => setPrintType(e.target.value)} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <FormControlLabel value="labels" control={<Radio />} label={MODAL_TEXTS.LABEL_OPTION} />
              <FormControlLabel value="distributionLabels" control={<Radio />} label={MODAL_TEXTS.DISTRIBUTION_LABELS_OPTION} />
              <FormControlLabel value="envelopes" control={<Radio />} label={MODAL_TEXTS.ENVELOPES_OPTION} sx={{ gridColumn: 1 }} />
              <FormControlLabel value="lists" control={<Radio />} label={MODAL_TEXTS.LISTS_OPTION} sx={{ gridColumn: 1 }} />
            </RadioGroup>
            
            <Stack direction="row" spacing={2} justifyContent="flex-end" mt={3}>
              <Button onClick={onClose} color="inherit">{MODAL_TEXTS.BUTTON_CANCEL}</Button>
              <Button variant="contained" onClick={handleNextStep}>{MODAL_TEXTS.BUTTON_NEXT}</Button>
            </Stack>
          </Box>
        )}

        {/* --- שלב 2: הגדרות מדבקה ומדפסת --- */}
        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Typography variant="h6" mb={3}>{MODAL_TEXTS.STEP_2_TITLE}</Typography>

            {/* רק האזור הזה נגלל כשהאפשרויות לא נכנסות. pt - כדי שהתווית של השדה העליון
                (שיושבת מעל המסגרת שלו) לא תיחתך בראש אזור הגלילה */}
            <Stack direction="row" spacing={3} alignItems="stretch" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pt: 1 }}>
              <Stack spacing={2} sx={{ flex: 1 }}>
                <FormControl fullWidth>
                  <InputLabel id="font-label">{MODAL_TEXTS.FONT_INPUT_LABEL}</InputLabel>
                  <Select
                    labelId="font-label"
                    value={fontType}
                    label={MODAL_TEXTS.FONT_INPUT_LABEL}
                    onChange={(e) => setFontType(e.target.value)}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <MenuItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* גודל ועובי כתב - מתחת לבחירת הכתב. ה-+ נעצר (מושבת) במקסימום שנכנס
                    בגודל המדבקה שנבחר, כך שאי אפשר לבחור גודל שנחתך */}
                {/* גודל ועובי - בלוק צפוף אחד, שורה לכל אחד (כותרת מימין, בחירה משמאל) */}
                <Box sx={{ mt: '8px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                    {MODAL_TEXTS.FONT_SIZE_INPUT_LABEL}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setFontScale((s) => clampFontScale(s - FONT_SCALE_STEP, labelSize))}
                    disabled={fontScale <= FONT_SCALE_MIN}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography sx={{ minWidth: 48, textAlign: 'center', fontWeight: 600 }}>
                    {fontScale}%
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setFontScale((s) => clampFontScale(s + FONT_SCALE_STEP, labelSize))}
                    disabled={fontScale >= getMaxFontScale(labelSize)}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                    {MODAL_TEXTS.FONT_WEIGHT_INPUT_LABEL}
                  </Typography>
                  <RadioGroup
                    row
                    value={fontWeight}
                    onChange={(e) => setFontWeight(e.target.value)}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                  >
                    <FormControlLabel value="regular" control={<Radio size="small" />} label={MODAL_TEXTS.FONT_WEIGHT_REGULAR} />
                    <FormControlLabel value="bold" control={<Radio size="small" />} label={MODAL_TEXTS.FONT_WEIGHT_BOLD} sx={{ mr: 0 }} />
                  </RadioGroup>
                </Stack>
                </Box>

                {/* "לכבוד" במדבקה בעברית - המיקום רלוונטי רק כשהוא בשורה נפרדת */}
                <Box sx={{ display: 'flex', flexDirection: 'column', '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={greetingShow} onChange={(e) => setGreetingShow(e.target.checked)} />}
                    label={MODAL_TEXTS.GREETING_SHOW}
                  />
                  {greetingShow && (
                    <FormControlLabel
                      control={<Checkbox size="small" checked={greetingSeparateLine} onChange={(e) => setGreetingSeparateLine(e.target.checked)} />}
                      label={MODAL_TEXTS.GREETING_SEPARATE_LINE}
                    />
                  )}
                  {greetingShow && greetingSeparateLine && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                        {MODAL_TEXTS.GREETING_ALIGN_LABEL}
                      </Typography>
                      <RadioGroup row value={greetingAlign} onChange={(e) => setGreetingAlign(e.target.value)}>
                        <FormControlLabel value="right" control={<Radio size="small" />} label={MODAL_TEXTS.GREETING_ALIGN_RIGHT} />
                        <FormControlLabel value="center" control={<Radio size="small" />} label={MODAL_TEXTS.GREETING_ALIGN_CENTER} />
                        <FormControlLabel value="left" control={<Radio size="small" />} label={MODAL_TEXTS.GREETING_ALIGN_LEFT} sx={{ mr: 0 }} />
                      </RadioGroup>
                    </Stack>
                  )}
                </Box>

                <FormControl fullWidth>
                  <InputLabel id="english-salutation-label">פנייה באנגלית</InputLabel>
                  <Select
                    labelId="english-salutation-label"
                    value={englishSalutation}
                    label="פנייה באנגלית"
                    onChange={(e) => setEnglishSalutation(e.target.value)}
                  >
                    <MenuItem value="">ללא פנייה</MenuItem>
                    <MenuItem value="To:">To:</MenuItem>
                    <MenuItem value="Dear">Dear</MenuItem>
                    <MenuItem value={CUSTOM_ENGLISH_SALUTATION}>פנייה מותאמת אישית</MenuItem>
                  </Select>
                </FormControl>

                {englishSalutation === CUSTOM_ENGLISH_SALUTATION && (
                  <TextField
                    fullWidth
                    label="פנייה מותאמת אישית באנגלית"
                    value={customEnglishSalutation}
                    onChange={(e) => setCustomEnglishSalutation(e.target.value)}
                    placeholder="למשל: Attention:"
                    inputProps={{ dir: 'ltr' }}
                  />
                )}

                <FormControl fullWidth>
                  <InputLabel id="size-label">{MODAL_TEXTS.SIZE_INPUT_LABEL}</InputLabel>
                  <Select
                    labelId="size-label"
                    value={labelSize}
                    label={MODAL_TEXTS.SIZE_INPUT_LABEL}
                    onChange={(e) => handleLabelSizeChange(e.target.value)}
                  >
                    <MenuItem value="standard">{MODAL_TEXTS.SIZE_STANDARD}</MenuItem>
                    <MenuItem value="large">{MODAL_TEXTS.SIZE_LARGE}</MenuItem>
                  </Select>
                </FormControl>

                {labelSize === 'large' && (
                  <Typography variant="body2" color="error">
                    {MODAL_TEXTS.SIZE_LARGE_UNAVAILABLE}
                  </Typography>
                )}

                <FormControl fullWidth>
                  <InputLabel id="printer-label">{MODAL_TEXTS.PRINTER_INPUT_LABEL}</InputLabel>
                  <Select
                    labelId="printer-label"
                    value={printer}
                    label={MODAL_TEXTS.PRINTER_INPUT_LABEL}
                    onChange={(e) => setPrinter(e.target.value)}
                  >
                    <MenuItem value="home">{MODAL_TEXTS.PRINTER_HOME}</MenuItem>
                    <MenuItem value="office">{MODAL_TEXTS.PRINTER_OFFICE}</MenuItem>
                  </Select>
                </FormControl>

                {/* מוצג רק כשבוחרים במדפסת המשרד - איך יגיע ההדפס אליה */}
                {printer === 'office' && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" mb={0.5}>
                      {MODAL_TEXTS.DELIVERY_INPUT_LABEL}
                    </Typography>
                    <RadioGroup value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
                      <FormControlLabel value="courier" control={<Radio />} label={MODAL_TEXTS.DELIVERY_COURIER} />
                      <FormControlLabel value="pickup" control={<Radio />} label={MODAL_TEXTS.DELIVERY_PICKUP} />
                    </RadioGroup>
                  </Box>
                )}

                <FormControlLabel
                  control={<Checkbox checked={emptyLineWhenNoAddress} onChange={(e) => setEmptyLineWhenNoAddress(e.target.checked)} />}
                  label={MODAL_TEXTS.EMPTY_LINE_NO_ADDRESS}
                />
              </Stack>

              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

              <LabelSheetPreview labelSize={labelSize} />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="space-between" mt={4}>
              <Button onClick={() => setStep(1)} color="inherit">{MODAL_TEXTS.BUTTON_BACK}</Button>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={handlePreview} disabled={labelSize === 'large'}>{MODAL_TEXTS.BUTTON_PREVIEW}</Button>
                <Button variant="contained" onClick={handlePrint} color="success" disabled={labelSize === 'large'}>{MODAL_TEXTS.BUTTON_PRINT}</Button>
              </Stack>
            </Stack>
          </Box>
        )}

      </Box>
    </Modal>
    <Snackbar
      open={Boolean(notification)}
      autoHideDuration={6000}
      onClose={() => setNotification('')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="info" variant="filled" onClose={() => setNotification('')}>
        {notification}
      </Alert>
    </Snackbar>
    </>
  );
}
