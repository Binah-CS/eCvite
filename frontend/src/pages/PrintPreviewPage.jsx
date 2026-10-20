// src/pages/PrintPreviewPage.jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Paper, Stack } from '@mui/material';
import {
  REAL_LABEL_SIZES,
  getRealColumns,
  LABEL_FONT_BASE_PX,
  LABEL_LINE_HEIGHT,
  FONT_SCALE_DEFAULT,
  clampFontScale,
} from '../utils/labelSheetLayout';
import { parseColumnPreferences, PRINT_DEFAULT_FIELDS } from '../utils/columnPreferences';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// שדות נוספים (לא חלק מהתבנית הקבועה של שם/כתובת) שמופיעים במדבקה כשורה נפרדת רק
// אם סומנו להדפסה ב"ניהול עמודות" וגם יש להם ערך בפועל אצל הנמען הספציפי
const EXTRA_PRINT_FIELDS = [
  { field: 'phone', labels: { he: 'טלפון', en: 'Phone' } },
  { field: 'mail', labels: { he: 'מייל', en: 'Email' } },
  { field: 'fatherName', labels: { he: 'שם האב', en: "Father's name" } },
  { field: 'motherName', labels: { he: 'שם האם', en: "Mother's name" } },
  { field: 'belongsTo', labels: { he: 'שייך ל', en: 'Belongs to' } },
  { field: 'addressNote', labels: { he: 'הערת כתובת', en: 'Address note' } },
  { field: 'neighborhood', labels: { he: 'שכונה', en: 'Neighborhood' } },
];

// שורת "לכבוד ..." - קידומת/בעל/אישה/שם משפחה/סיום מתאחדים לשורה אחת, אבל כל חלק
// מופיע רק אם הוא מסומן להדפסה. אם row.display קיים (שם מותאם אישית) הוא משמש כמו
// שהיה קודם, ללא תלות בסימוני בעל/אישה/שם משפחה - קידומת/סיום עדיין חלים סביבו
function buildNameLine(row, getPrintFlag, printLanguage, englishSalutation) {
  const prefixPart = getPrintFlag('prefix') && row.prefix ? row.prefix : '';
  const suffixPart = getPrintFlag('suffix') && row.suffix ? row.suffix : '';

  let namePart;
  if (row.display) {
    namePart = row.display;
  } else {
    const manShown = getPrintFlag('man') && row.man;
    const womanShown = getPrintFlag('woman') && row.woman;
    const womanText = womanShown
      ? (manShown ? `${printLanguage === 'en' ? 'and ' : 'ו'}${row.woman}` : row.woman)
      : '';
    const lastNamePart = getPrintFlag('lastName') && row.lastName ? row.lastName : '';
    namePart = [manShown ? row.man : '', womanText, lastNamePart].filter(Boolean).join(' ');
  }

  const content = [prefixPart, namePart, suffixPart].filter(Boolean).join(' ');
  if (!content) return '';
  if (printLanguage !== 'en') return `לכבוד ${content}`;
  if (hasHebrewEnglishSalutation(englishSalutation)) return content;
  return englishSalutation ? `${englishSalutation} ${content}` : content;
}

// "לכבוד" לפי הבחירות בחלון ההדפסה - רק במדבקה בעברית (לאנגלית יש פנייה משלה,
// englishSalutation). מחזיר את שורת "לכבוד" הנפרדת (או ריק) ואת שורת השם בלעדיו
// או איתו, כמו קודם
const HEBREW_GREETING = 'לכבוד';
function splitHebrewGreeting(nameLine, printLanguage, greetingShow, greetingSeparateLine) {
  const prefix = `${HEBREW_GREETING} `;
  if (printLanguage === 'en' || !nameLine.startsWith(prefix)) return { greetingLine: '', nameLine };
  const nameOnly = nameLine.slice(prefix.length);
  if (!greetingShow) return { greetingLine: '', nameLine: nameOnly };
  if (greetingSeparateLine) return { greetingLine: HEBREW_GREETING, nameLine: nameOnly };
  return { greetingLine: '', nameLine };
}

function hasHebrewEnglishSalutation(salutation) {
  return /[\u0590-\u05FF]/.test(salutation);
}

function buildAddressLine1(row, getPrintFlag, printLanguage) {
  const street = getPrintFlag('street') && row.street ? row.street : '';
  const houseNo = getPrintFlag('houseNo') && row.houseNo ? row.houseNo : '';
  return (printLanguage === 'en' ? [houseNo, street] : [street, houseNo])
    .filter(Boolean)
    .join(' ');
}

function buildAddressLine2(row, getPrintFlag) {
  return getPrintFlag('city') && row.city ? row.city : '';
}

// ישראל היא ברירת המחדל (ייבוא אקסל ממלא "ישראל" לנמען בלי ארץ) - אין טעם להדפיס
// אותה על כל מדבקה. ארץ אחרת מודפסת בשורה נפרדת, מתחת לכל הכתובת
const DOMESTIC_COUNTRY_NAMES = new Set(['ישראל', 'israel', 'il', 'isr']);

function buildCountryLine(row, getPrintFlag) {
  const country = String(row.country ?? '').trim();
  if (!getPrintFlag('country') || !country) return '';
  return DOMESTIC_COUNTRY_NAMES.has(country.toLowerCase()) ? '' : country;
}

function countCharacters(text, pattern) {
  return (String(text ?? '').match(pattern) ?? []).length;
}

function detectPrintLanguage(row, getPrintFlag) {
  const addressText = ['street', 'city', 'country']
    .filter((field) => getPrintFlag(field))
    .map((field) => row[field])
    .join(' ');
  const addressLatin = countCharacters(addressText, /[A-Za-z]/g);
  const addressHebrew = countCharacters(addressText, /[\u0590-\u05FF]/g);
  if (addressLatin !== addressHebrew) return addressLatin > addressHebrew ? 'en' : 'he';

  const recipientText = ['display', 'prefix', 'man', 'woman', 'lastName', 'suffix']
    .filter((field) => field === 'display' || getPrintFlag(field))
    .map((field) => row[field])
    .join(' ');
  return countCharacters(recipientText, /[A-Za-z]/g) > countCharacters(recipientText, /[\u0590-\u05FF]/g)
    ? 'en'
    : 'he';
}

// פריסת רשת אמיתית לדף מדבקות - הגדלים ומספר העמודות מגיעים מאותו מקור אמת
// שמשמש גם את התצוגה הממוזערת במודאל, כדי ששניהם תמיד יתאימו
const LABEL_LAYOUT = {
  // המדבקה גבוהה רק 2.6 ס"מ בפועל - כתב גדול (h5/h6) לא נכנס בכלל, לכן כתב קטן ודחוס
  standard: { ...REAL_LABEL_SIZES.standard, columns: getRealColumns('standard'), nameVariant: 'body2', addrVariant: 'caption' },
  large: { ...REAL_LABEL_SIZES.large, columns: getRealColumns('large'), nameVariant: 'h4', addrVariant: 'h5' },
};

const SELECTED_ROW_IDS_STORAGE_KEY = 'dashboardSelectedIds';
const SELECTED_ROWS_STORAGE_KEY = 'dashboardSelectedRows';

function getSavedSelectedRows() {
  try {
    const saved = sessionStorage.getItem(SELECTED_ROWS_STORAGE_KEY);
    const rows = saved ? JSON.parse(saved) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveSelectedRows(rows) {
  sessionStorage.setItem(SELECTED_ROWS_STORAGE_KEY, JSON.stringify(rows));
  sessionStorage.setItem(
    SELECTED_ROW_IDS_STORAGE_KEY,
    JSON.stringify(rows.map((row) => row.id).filter((id) => id !== undefined && id !== null)),
  );
}

export default function PrintPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // חילוץ הנתונים עם תמיכה מלאה גם ב-selectedRows וגם ב-selectedItems של ראש הצוות
  const { selectedRows = [], selectedItems = [], labelSize = 'standard', printer = '', fontType = 'Arial, sans-serif', deliveryMethod = 'courier', fontScale = FONT_SCALE_DEFAULT, fontWeight = 'regular', englishSalutation = '', emptyLineWhenNoAddress = true, greetingShow = true, greetingSeparateLine = true, greetingAlign = 'center', autoPrint = false } = location.state || {};

  // קביעת הרשומות להצגה לפי מה שהתקבל
  const savedSelectedRows = getSavedSelectedRows();
  const actualRows = selectedRows.length > 0
    ? selectedRows
    : selectedItems.length > 0
      ? selectedItems
      : savedSelectedRows;
  const rowsToDisplay = actualRows;
  const layout = LABEL_LAYOUT[labelSize] || LABEL_LAYOUT.standard;
  const fontBase = LABEL_FONT_BASE_PX[labelSize] || LABEL_FONT_BASE_PX.standard;
  const fontFactor = clampFontScale(fontScale, labelSize) / 100;
  const labelFontWeight = fontWeight === 'bold' ? 'bold' : 'normal';
  // מטמון ה-RTL של MUI הופך left/right פיזיים. start/end נשארים לוגיים ביחס
  // לכיוון העברי של המדבקה: start הוא ימין ו-end הוא שמאל.
  const greetingTextAlign = greetingAlign === 'right'
    ? 'start'
    : greetingAlign === 'left'
      ? 'end'
      : 'center';
  const greetingInsetSx = greetingAlign === 'right'
    ? { marginInlineStart: '1mm' }
    : greetingAlign === 'left'
      ? { marginInlineEnd: '1mm' }
      : {};
  const nameLineSx = {
    fontWeight: labelFontWeight, mb: 0.25, color: '#000000', textAlign: 'center', fontFamily: 'inherit',
    lineHeight: LABEL_LINE_HEIGHT, fontSize: `${fontBase.name * fontFactor}px`, unicodeBidi: 'plaintext',
  };
  const detailLineSx = {
    color: '#333333', textAlign: 'center', fontFamily: 'inherit', lineHeight: LABEL_LINE_HEIGHT,
    fontSize: `${fontBase.line * fontFactor}px`, fontWeight: labelFontWeight, unicodeBidi: 'plaintext',
  };

  // גודל ועובי הכתב מחלון ההדפסה. הגודל עובר שוב דרך המקסימום של גודל המדבקה - גם
  // אם הגיע ערך חריג, הטקסט לא ייצא גדול ממה שנכנס. העובי חל על כל השורות, כולל השם
  /* Binah_CS: נוצרה פה כפילות של הגדרות שחוזרת על עצמה בכמה מקומות. עושה ביטול ידני לראות אם זה פותר את הבעיה. קשור לאיחוד הגרסאות בין רחלי לחני
  const fontBase = LABEL_FONT_BASE_PX[labelSize] || LABEL_FONT_BASE_PX.standard;
  const fontFactor = clampFontScale(fontScale, labelSize) / 100;
  const labelFontWeight = fontWeight === 'bold' ? 'bold' : 'normal';
  const nameLineSx = {
    fontWeight: labelFontWeight, mb: 0.25, color: '#000000', textAlign: 'center', fontFamily: 'inherit',
    lineHeight: LABEL_LINE_HEIGHT, fontSize: `${fontBase.name * fontFactor}px`, unicodeBidi: 'plaintext',
  };
  const detailLineSx = {
    color: '#333333', textAlign: 'center', fontFamily: 'inherit', lineHeight: LABEL_LINE_HEIGHT,
    fontSize: `${fontBase.line * fontFactor}px`, fontWeight: labelFontWeight, unicodeBidi: 'plaintext',
  };
   End Binah_CS edit */

  // "עמודות להדפסה" מ"ניהול עמודות" - אותה העדפה שנשמרה למשתמשת, נופלת חזרה
  // לברירת המחדל (השדות שהודפסו תמיד עד היום) אם עדיין לא נשמרה העדפה אישית
  const columnPreferences = parseColumnPreferences(getLoggedUser()?.columnPreferences);
  const getPrintFlag = (technicalName) => {
    const saved = columnPreferences[technicalName]?.print;
    return saved !== undefined ? saved : PRINT_DEFAULT_FIELDS.has(technicalName);
  };

  // כשמגיעים ישר מכפתור "הדפס" (לא מ"תצוגה מקדימה") - פותחים את חלון ההדפסה
  // של הדפדפן מיד, בלי לחכות שילחצו שוב על "הדפס מדבקות" כאן
  useEffect(() => {
    if (rowsToDisplay.length > 0) {
      saveSelectedRows(rowsToDisplay);
    }
  }, [rowsToDisplay]);

  useEffect(() => {
    if (autoPrint && rowsToDisplay.length > 0) {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, '@media print': { m: 0, maxWidth: 'none', p: 0 } }}>
      {/* לגיליון המדבקות יש שוליים של 1 ס"מ למעלה ולמטה בכל עמוד, ובצדדים 0 (3 מדבקות של 7 ס"מ = כל הרוחב) */}
      <style>{`@media print { @page { margin: 1cm 0; } }`}</style>
      <Paper
        sx={{
          p: 4,
          borderRadius: 2,
          bgcolor: '#f8f9fa',
          '@media print': { p: 0, boxShadow: 'none', bgcolor: 'transparent', borderRadius: 0 },
        }}
      >

        {/* סרגל עליון עם כל הכפתורים - מוסתר לגמרי בהדפסה, מוצג רק על המסך */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={4}
          borderBottom="1px solid #e0e0e0"
          pb={2}
          gap={2}
          sx={{ '@media print': { display: 'none' } }}
        >
          <Typography variant="h5" fontWeight="bold">תצוגה מקדימה</Typography>
          
          <Stack direction="row" spacing={2}>
          <Button 
            variant="outlined" 
            color="primary" 
           onClick={() => {
              //  שומרים את כל המצב הנוכחי בזיכרון לפני שחוזרים, כולל אילו שורות היו מסומנות
               sessionStorage.setItem('fromPreview', 'true');
               sessionStorage.setItem('savedLabelSize', labelSize);
               sessionStorage.setItem('savedPrinter', printer);
               sessionStorage.setItem('savedFontType', fontType);
               sessionStorage.setItem('savedDeliveryMethod', deliveryMethod);
               sessionStorage.setItem('savedFontScale', String(fontScale));
               sessionStorage.setItem('savedFontWeight', fontWeight);
               sessionStorage.setItem('savedEnglishSalutation', englishSalutation);
               sessionStorage.setItem('savedEmptyLineWhenNoAddress', String(emptyLineWhenNoAddress));
               sessionStorage.setItem('savedGreetingShow', String(greetingShow));
               sessionStorage.setItem('savedGreetingSeparateLine', String(greetingSeparateLine));
               sessionStorage.setItem('savedGreetingAlign', greetingAlign);
               saveSelectedRows(rowsToDisplay);
                navigate('/dashboard');
            }} 
>
              שינוי הגדרות הדפסה
         </Button>

            <Button 
              variant="contained" 
              color="success" 
              onClick={() => window.print()} 
              sx={{ fontWeight: 'bold' }}
            >
              הדפס מדבקות
            </Button>

            <Button variant="text" onClick={() => {
              saveSelectedRows(rowsToDisplay);
              navigate('/dashboard');
            }}>
              ביטול וחזרה
            </Button>
          </Stack>
        </Box>

        {/* אזור המדבקות - רשת אמיתית של מדבקות, בדיוק כמו שדף המדבקות המודפס ייראה */}
        {rowsToDisplay.length === 0 ? (
          <Typography color="error">לא נבחרו שורות להדפסה. חזרי לטבלה וסמני רשומות.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${layout.columns}, ${layout.width}px)`,
              justifyContent: 'center',
              // רווח אופקי קטן בין העמודות - רק במסך התצוגה, לנוחות הקריאה. בהדפסה
              // בפועל זה חוזר ל-0 (למטה) כי 3 מדבקות של 7 ס"מ תופסות בדיוק את כל רוחב
              // הדף, אין מקום לרווח בלי לקלקל את היישור הפיזי מול הגיליון האמיתי
              columnGap: 1,
              rowGap: 1,
              '@media print': { columnGap: 0 },
            }}
          >
            {rowsToDisplay.map((row, index) => {
              const printLanguage = detectPrintLanguage(row, getPrintFlag);
              const { greetingLine, nameLine } = splitHebrewGreeting(
                buildNameLine(row, getPrintFlag, printLanguage, englishSalutation), printLanguage, greetingShow, greetingSeparateLine);
              return (
                <Box
                key={row.id || index}
                sx={{
                  boxSizing: 'border-box',
                  width: layout.width,
                  height: layout.height,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  p: 0.5,
                  backgroundColor: '#ffffff',
                  pageBreakInside: 'avoid',
                  fontFamily: fontType,
                  direction: printLanguage === 'en' ? 'ltr' : 'rtl',
                }}
              >
                {/* פנייה עברית שנבחרה למדבקה באנגלית מודפסת מעל השם. */}
                {printLanguage === 'en' && hasHebrewEnglishSalutation(englishSalutation) && buildNameLine(row, getPrintFlag, printLanguage, englishSalutation) && (
                  <Typography
                    variant={layout.nameVariant}
                    sx={{ ...nameLineSx, mb: 0 }}
                  >
                    {englishSalutation}
                  </Typography>
                )}

                {/* "לכבוד" בשורה נפרדת מעל השם, בצד שנבחר בחלון ההדפסה - על כל רוחב המדבקה,
                    כדי שימין/שמאל יהיו ביחס למדבקה ולא רק לאורך השם */}
                {greetingLine && (
                  <Typography
                    variant={layout.nameVariant}
                    sx={{ ...nameLineSx, ...greetingInsetSx, mb: 0, alignSelf: 'stretch', textAlign: greetingTextAlign }}
                  >
                    {greetingLine}
                  </Typography>
                )}

                {/* שורת השם - רק אם יש בה בכלל תוכן לפי מה שסומן להדפסה */}
                {nameLine && (
                  <Typography
                    variant={layout.nameVariant}
                    sx={nameLineSx}
                  >
                    {nameLine}
                  </Typography>
                )}

                {/* שורת הרחוב. אם בחרו בחלון ההדפסה "השאר שורה ריקה כשאין כתובת" ואין
                    רחוב/מספר בית אבל יש עיר - משאירים במקומה שורה ריקה באותו גובה (רווח
                    קשיח, כדי שהשורה לא תתכווץ לאפס), כך שהעיר לא "קופצת" מיד מתחת לשם. בלי
                    עיר אין "בין השם לעיר", ולכן גם אין שורה ריקה. ורק אם רחוב/מספר בית בכלל
                    מסומנים להדפסה ב"ניהול עמודות" - כתובת שהוסתרה בכוונה היא לא "חסרה" */}
                {(buildAddressLine1(row, getPrintFlag, printLanguage)
                  || (emptyLineWhenNoAddress
                    && (getPrintFlag('street') || getPrintFlag('houseNo'))
                    && buildAddressLine2(row, getPrintFlag))) && (
                  <Typography
                    variant={layout.addrVariant}
                    sx={detailLineSx}
                  >
                    {buildAddressLine1(row, getPrintFlag, printLanguage) || ' '}
                  </Typography>
                )}

                {/* שורת העיר - מתחת לרחוב */}
                {buildAddressLine2(row, getPrintFlag) && (
                  <Typography
                    variant={layout.addrVariant}
                    sx={detailLineSx}
                  >
                    {buildAddressLine2(row, getPrintFlag)}
                  </Typography>
                )}

                {/* שורת הארץ - רק לנמען מחוץ לישראל, מתחת לכל הכתובת */}
                {buildCountryLine(row, getPrintFlag) && (
                  <Typography
                    variant={layout.addrVariant}
                    sx={detailLineSx}
                  >
                    {buildCountryLine(row, getPrintFlag)}
                  </Typography>
                )}

                {/* שדות נוספים - כל אחד בשורה משלו, רק אם סומן להדפסה ויש לו ערך */}
                {EXTRA_PRINT_FIELDS.map(({ field, labels }) =>
                  getPrintFlag(field) && row[field] ? (
                    <Typography
                      key={field}
                      variant={layout.addrVariant}
                      sx={detailLineSx}
                    >
                      {labels[printLanguage] ?? labels.he}: {row[field]}
                    </Typography>
                  ) : null
                )}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>
    </Container>
  );
}
