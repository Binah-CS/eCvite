// src/components/PrintModal.jsx
import { useEffect, useState } from 'react';
import { Modal, Box, Typography, Button, RadioGroup, FormControlLabel, Radio, FormControl, InputLabel, Select, MenuItem, Stack, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
// 🌟 ייבוא הקבועים החדשים מהעמוד הייעודי
import { MODAL_TEXTS, FONT_OPTIONS } from '../pages/HardCodePage';
import { getScaledLabelSizes, getColumns } from '../utils/labelSheetLayout';

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

export default function PrintModal({ open, onClose, selectedRows = [], filteredRows = [], records = [] }) {
  const navigate = useNavigate();

  const [printScope, setPrintScope] = useState('all');

  useEffect(() => {
    if (!open) return;
    setPrintScope(selectedRows.length > 0 ? 'selected' : filteredRows.length > 0 ? 'filtered' : 'all');
  }, [open, selectedRows.length, filteredRows.length]);

  const rowsToPrint = printScope === 'selected'
    ? selectedRows
    : printScope === 'filtered'
    ? filteredRows
    : records;
  
  // 1. בדיקה בטוחה עבור השלב (Step)
  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('fromPreview') === 'true' ? 2 : 1;
    }
    return 1;
  });

  // 2. בדיקה בטוחה עבור גודל המדבקה
  const [labelSize, setLabelSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('savedLabelSize') || 'standard';
    }
    return 'standard';
  });

  // 3. בדיקה בטוחה עבור המדפסת - מתעלמת מערך שמור ישן שכבר לא תקין (כמו "printer1" מגרסה קודמת)
  const [printer, setPrinter] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('savedPrinter');
      return saved === 'home' || saved === 'office' ? saved : 'home';
    }
    return 'home';
  });

  // 3.1 בדיקה בטוחה עבור אופן קבלת ההדפסה (רלוונטי רק כשבוחרים במדפסת המשרד)
  const [deliveryMethod, setDeliveryMethod] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('savedDeliveryMethod');
      return saved === 'courier' || saved === 'pickup' ? saved : 'courier';
    }
    return 'courier';
  });

  // 4. בדיקה בטוחה עבור סוג הכתב
  const [fontType, setFontType] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('savedFontType') || FONT_OPTIONS[0].value;
    }
    return FONT_OPTIONS[0].value;
  });

  const [printType, setPrintType] = useState('labels');
    const [errorMessage, setErrorMessage] = useState('');
  // פונקציה שמטפלת במעבר משלב 1 לשלב 2
  const handleNextStep = () => {
    if (printType === 'labels') {
      setStep(2);
    } else {
      // 🌟 שימוש בפונקציית הטקסט הדינמית מהקבועים
        setErrorMessage(MODAL_TEXTS.NOT_AVAILABLE_ALERT(printType));
    }
  };

  const handlePrint = () => {
    // אותו דף הדפסה בדיוק כמו מה"תצוגה מקדימה" - רק עם דגל שגורם לו לפתוח את חלון
    // ההדפסה של הדפדפן מיד בכניסה, בלי לחכות שילחצו שוב על "הדפס" שם

    navigate('/print-preview', {
      state: { selectedItems: rowsToPrint, labelSize, printer, fontType, deliveryMethod, autoPrint: true },
    });

    sessionStorage.removeItem('fromPreview');
    sessionStorage.removeItem('savedLabelSize');
    sessionStorage.removeItem('savedPrinter');
    sessionStorage.removeItem('savedFontType');
    sessionStorage.removeItem('savedDeliveryMethod');

    onClose();
    setStep(1);
  };

  const handlePreview = () => {
    navigate('/print-preview', { state: { selectedItems: rowsToPrint, labelSize, printer, fontType, deliveryMethod } });
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ ...modalStyle, width: step === 2 ? 740 : 400 }}>
        
        {/* --- שלב 1: על מה תרצה להדפיס? --- */}
        {step === 1 && (
          <Box>
            <Typography variant="h6" mb={2}>{MODAL_TEXTS.STEP_1_TITLE}</Typography>
            <RadioGroup value={printType} onChange={(e) => setPrintType(e.target.value)}>
              <FormControlLabel value="labels" control={<Radio />} label={MODAL_TEXTS.LABEL_OPTION} />
              <FormControlLabel value="envelopes" control={<Radio />} label={MODAL_TEXTS.ENVELOPES_OPTION} />
              <FormControlLabel value="lists" control={<Radio />} label={MODAL_TEXTS.LISTS_OPTION} />
            </RadioGroup>
              {errorMessage && (
                  <Typography color="error" sx={{ mt: 2 }}>
                      {errorMessage}
                  </Typography>
              )}
            <Stack direction="row" spacing={2} justifyContent="flex-end" mt={3}>
              <Button onClick={onClose} color="inherit">{MODAL_TEXTS.BUTTON_CANCEL}</Button>
              <Button variant="contained" onClick={handleNextStep}>{MODAL_TEXTS.BUTTON_NEXT}</Button>
            </Stack>
          </Box>
        )}

        {/* --- שלב 2: הגדרות מדבקה ומדפסת --- */}
        {step === 2 && (
          <Box>
            <Typography variant="h6" mb={3}>{MODAL_TEXTS.STEP_2_TITLE}</Typography>

            <Stack direction="row" spacing={3} alignItems="stretch">
              <Stack spacing={3} sx={{ flex: 1 }}>
                <FormControl fullWidth>
                  <InputLabel id="print-scope-label">רשומות להדפסה</InputLabel>
                  <Select
                    labelId="print-scope-label"
                    value={printScope}
                    label="רשומות להדפסה"
                    onChange={(event) => setPrintScope(event.target.value)}
                  >
                    <MenuItem value="selected" disabled={selectedRows.length === 0}>
                      רשומות שסומנו בטבלה ({selectedRows.length})
                    </MenuItem>
                    <MenuItem value="filtered" disabled={filteredRows.length === 0}>
                      רק הרשומות המוצגות לפי הסינון ({filteredRows.length})
                    </MenuItem>
                    <MenuItem value="all" disabled={records.length === 0}>
                      כל הרשומות ({records.length})
                    </MenuItem>
                  </Select>
                </FormControl>

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

                <FormControl fullWidth>
                  <InputLabel id="size-label">{MODAL_TEXTS.SIZE_INPUT_LABEL}</InputLabel>
                  <Select
                    labelId="size-label"
                    value={labelSize}
                    label={MODAL_TEXTS.SIZE_INPUT_LABEL}
                    onChange={(e) => setLabelSize(e.target.value)}
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
              </Stack>

              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

              <LabelSheetPreview labelSize={labelSize} />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="space-between" mt={4}>
              <Button onClick={() => setStep(1)} color="inherit">{MODAL_TEXTS.BUTTON_BACK}</Button>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={handlePreview} disabled={labelSize === 'large' || rowsToPrint.length === 0}>{MODAL_TEXTS.BUTTON_PREVIEW}</Button>
                <Button variant="contained" onClick={handlePrint} color="success" disabled={labelSize === 'large' || rowsToPrint.length === 0}>{MODAL_TEXTS.BUTTON_PRINT}</Button>
              </Stack>
            </Stack>
          </Box>
        )}

      </Box>
    </Modal>
  );
}
