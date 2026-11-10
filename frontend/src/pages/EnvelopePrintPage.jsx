// src/pages/EnvelopePrintPage.jsx
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import EnvelopeSheet, { createPrintFlagGetter } from '../components/EnvelopeSheet';
import { buildEnvelopeLayout } from '../utils/envelopeLayout';
import { loadEnvelopePrintSettings } from '../utils/envelopePrintSettings';
import { FONT_SCALE_DEFAULT } from '../utils/labelSheetLayout';
import { getSavedSelectedRows, saveSelectedRows } from './PrintPreviewPage';
import { MODAL_TEXTS } from './HardCodePage';

const SHEET_CLASS = 'envelope-print-sheet';

// margin: 0 כי הטקסט ממוקם ביחס לקצה המעטפה עצמה, והשוליים כבר חלק מהפריסה.
// ה-CSS כאן בתוך style רגיל, ולכן מטמון ה-RTL של MUI לא נוגע בו
function pageStyles(pass) {
  return `
    .${SHEET_CLASS} { margin: 0 auto 16px; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25); }
    @media print {
      @page { size: ${pass.pageWidthMm}mm ${pass.pageHeightMm}mm; margin: 0; }
      .${SHEET_CLASS} { margin: 0; box-shadow: none; }
      .envelope-guides { display: none; }
    }
  `;
}

export default function EnvelopePrintPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectedItems = [],
    envelopeSettings,
    fontType = 'Arial, sans-serif',
    fontScale = FONT_SCALE_DEFAULT,
    fontWeight = 'regular',
    englishSalutation = '',
    emptyLineWhenNoAddress = true,
    greetingShow = true,
    greetingSeparateLine = true,
    greetingAlign = 'center',
    autoPrint = false,
  } = location.state || {};

  const rows = selectedItems.length > 0 ? selectedItems : getSavedSelectedRows();
  const settings = envelopeSettings ?? loadEnvelopePrintSettings().settings;
  const layout = buildEnvelopeLayout(settings, { fontType, fontScale, fontWeight });
  const textOptions = { englishSalutation, emptyLineWhenNoAddress, greetingShow, greetingSeparateLine, greetingAlign };
  const getPrintFlag = createPrintFlagGetter();
  const canPrint = Boolean(layout) && rows.length > 0;
  const firstPass = layout?.passes[0];

  // ב-StrictMode בפיתוח אפקטים רצים פעמיים. בלי ה-ref חלון ההדפסה היה נפתח פעמיים
  const printStartedRef = useRef(false);
  useEffect(() => {
    if (autoPrint && canPrint && !printStartedRef.current) {
      printStartedRef.current = true;
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToDashboard = () => {
    saveSelectedRows(rows);
    navigate('/');
  };

  // אותם מפתחות שחלון ההדפסה קורא בחזרה, בנוסף לסוג ההדפסה. הגדרות המעטפה עצמן כבר
  // שמורות דרך envelopePrintSettings
  const backToSettings = () => {
    sessionStorage.setItem('fromPreview', 'true');
    sessionStorage.setItem('savedPrintType', 'envelopes');
    sessionStorage.setItem('savedFontType', fontType);
    sessionStorage.setItem('savedFontScale', String(fontScale));
    sessionStorage.setItem('savedFontWeight', fontWeight);
    sessionStorage.setItem('savedEnglishSalutation', englishSalutation);
    sessionStorage.setItem('savedEmptyLineWhenNoAddress', String(emptyLineWhenNoAddress));
    sessionStorage.setItem('savedGreetingShow', String(greetingShow));
    sessionStorage.setItem('savedGreetingSeparateLine', String(greetingSeparateLine));
    sessionStorage.setItem('savedGreetingAlign', greetingAlign);
    backToDashboard();
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3, '@media print': { maxWidth: 'none', m: 0, p: 0 } }}>
      {firstPass && <style>{pageStyles(firstPass)}</style>}

      <Box sx={{ '@media print': { display: 'none' } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} gap={2} borderBottom="1px solid #e0e0e0">
          <Typography variant="h5" fontWeight="bold">תצוגה מקדימה</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={backToSettings}>שינוי הגדרות הדפסה</Button>
            <Button variant="contained" color="success" onClick={() => window.print()} disabled={!canPrint} sx={{ fontWeight: 'bold' }}>
              {MODAL_TEXTS.ENVELOPE_PRINT_BUTTON}
            </Button>
            <Button variant="text" onClick={backToDashboard}>ביטול וחזרה</Button>
          </Stack>
        </Box>
        {firstPass && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {MODAL_TEXTS.ENVELOPE_PRINT_HINT(firstPass.pageWidthMm, firstPass.pageHeightMm, settings.senderMode === 'openFlap')}
          </Typography>
        )}
      </Box>

      {!canPrint ? (
        <Typography color="error">{MODAL_TEXTS.ENVELOPE_NOTHING_TO_PRINT}</Typography>
      ) : (
        rows.flatMap((row, rowIndex) => layout.passes.map((pass, passIndex) => (
          <EnvelopeSheet
            key={`${row.id ?? row.hashCode ?? rowIndex}-${pass.id}`}
            className={SHEET_CLASS}
            surface={pass}
            row={row}
            senders={settings.senders}
            typography={layout.typography}
            textOptions={textOptions}
            getPrintFlag={getPrintFlag}
            breakAfter={rowIndex < rows.length - 1 || passIndex < layout.passes.length - 1}
          />
        )))
      )}
    </Box>
  );
}
