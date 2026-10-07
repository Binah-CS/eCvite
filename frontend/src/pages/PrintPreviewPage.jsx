// src/pages/PrintPreviewPage.jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Paper, Stack } from '@mui/material';
import { REAL_LABEL_SIZES, getRealColumns } from '../utils/labelSheetLayout';
import { parseColumnPreferences, PRINT_DEFAULT_FIELDS } from '../utils/columnPreferences';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// שדות נוספים (לא חלק מהתבנית הקבועה של שם/כתובת) שמופיעים במדבקה כשורה נפרדת רק
// אם סומנו להדפסה ב"ניהול עמודות" וגם יש להם ערך בפועל אצל הנמען הספציפי
const EXTRA_PRINT_FIELDS = [
  { field: 'phone', label: 'טלפון' },
  { field: 'mail', label: 'מייל' },
  { field: 'fatherName', label: 'שם האב' },
  { field: 'motherName', label: 'שם האם' },
  { field: 'belongsTo', label: 'שייך ל' },
  { field: 'addressNote', label: 'הערת כתובת' },
  { field: 'neighborhood', label: 'שכונה' },
];

// שורת "לכבוד ..." - קידומת/בעל/אישה/שם משפחה/סיום מתאחדים לשורה אחת, אבל כל חלק
// מופיע רק אם הוא מסומן להדפסה. אם row.display קיים (שם מותאם אישית) הוא משמש כמו
// שהיה קודם, ללא תלות בסימוני בעל/אישה/שם משפחה - קידומת/סיום עדיין חלים סביבו
function buildNameLine(row, getPrintFlag) {
  const prefixPart = getPrintFlag('prefix') && row.prefix ? row.prefix : '';
  const suffixPart = getPrintFlag('suffix') && row.suffix ? row.suffix : '';

  let namePart;
  if (row.display) {
    namePart = row.display;
  } else {
    const manShown = getPrintFlag('man') && row.man;
    const womanShown = getPrintFlag('woman') && row.woman;
    const womanText = womanShown ? (manShown ? `ו${row.woman}` : row.woman) : '';
    const lastNamePart = getPrintFlag('lastName') && row.lastName ? row.lastName : '';
    namePart = [manShown ? row.man : '', womanText, lastNamePart].filter(Boolean).join(' ');
  }

  const content = [prefixPart, namePart, suffixPart].filter(Boolean).join(' ');
  return content ? `לכבוד ${content}` : '';
}

function buildAddressLine1(row, getPrintFlag) {
  return [
    getPrintFlag('street') && row.street ? row.street : '',
    getPrintFlag('houseNo') && row.houseNo ? row.houseNo : '',
  ].filter(Boolean).join(' ');
}

function buildAddressLine2(row, getPrintFlag) {
  return [
    getPrintFlag('city') && row.city ? row.city : '',
    getPrintFlag('country') && row.country ? row.country : '',
  ].filter(Boolean).join(' ');
}

// פריסת רשת אמיתית לדף מדבקות - הגדלים ומספר העמודות מגיעים מאותו מקור אמת
// שמשמש גם את התצוגה הממוזערת במודאל, כדי ששניהם תמיד יתאימו
const LABEL_LAYOUT = {
  // המדבקה גבוהה רק 2.3 ס"מ בפועל - כתב גדול (h5/h6) לא נכנס בכלל, לכן כתב קטן ודחוס
  standard: { ...REAL_LABEL_SIZES.standard, columns: getRealColumns('standard'), nameVariant: 'body2', addrVariant: 'caption' },
  large: { ...REAL_LABEL_SIZES.large, columns: getRealColumns('large'), nameVariant: 'h4', addrVariant: 'h5' },
};

export default function PrintPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // חילוץ הנתונים עם תמיכה מלאה גם ב-selectedRows וגם ב-selectedItems של ראש הצוות
const { selectedRows = [], selectedItems = [], labelSize = 'standard', printer = '', fontType = 'Arial, sans-serif', deliveryMethod = 'courier', autoPrint = false } = location.state || {};

  // קביעת הרשומות להצגה לפי מה שהתקבל
  const actualRows = selectedRows.length > 0 ? selectedRows : selectedItems;
  const rowsToDisplay = actualRows;
  const layout = LABEL_LAYOUT[labelSize] || LABEL_LAYOUT.standard;

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
    if (autoPrint && rowsToDisplay.length > 0) {
      window.print();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, '@media print': { m: 0, maxWidth: 'none', p: 0 } }}>
      <style>{`@media print { @page { margin: 0; } }`}</style>
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
               sessionStorage.setItem('savedSelectedIds', JSON.stringify(rowsToDisplay.map((r) => r.id)));
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

              <Button
                  variant="text"
                  onClick={() => {
                      sessionStorage.setItem('returnFromPreview', 'true');
                      navigate('/dashboard');
                  }}
              >
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
            {rowsToDisplay.map((row, index) => (
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
                }}
              >
                {/* שורת השם המכובדת - רק אם יש בה בכלל תוכן לפי מה שסומן להדפסה */}
                {buildNameLine(row, getPrintFlag) && (
                  <Typography
                    variant={layout.nameVariant}
                    sx={{ fontWeight: 'bold', mb: 0.25, color: '#000000', textAlign: 'center', fontFamily: 'inherit', lineHeight: 1.2 }}
                  >
                    {buildNameLine(row, getPrintFlag)}
                  </Typography>
                )}

                {/* שורת הרחוב */}
                {buildAddressLine1(row, getPrintFlag) && (
                  <Typography
                    variant={layout.addrVariant}
                    sx={{ color: '#333333', textAlign: 'center', fontFamily: 'inherit', lineHeight: 1.2 }}
                  >
                    {buildAddressLine1(row, getPrintFlag)}
                  </Typography>
                )}

                {/* שורת עיר וארץ - מתחת לרחוב */}
                {buildAddressLine2(row, getPrintFlag) && (
                  <Typography
                    variant={layout.addrVariant}
                    sx={{ color: '#333333', textAlign: 'center', fontFamily: 'inherit', lineHeight: 1.2 }}
                  >
                    {buildAddressLine2(row, getPrintFlag)}
                  </Typography>
                )}

                {/* שדות נוספים - כל אחד בשורה משלו, רק אם סומן להדפסה ויש לו ערך */}
                {EXTRA_PRINT_FIELDS.map(({ field, label }) =>
                  getPrintFlag(field) && row[field] ? (
                    <Typography
                      key={field}
                      variant={layout.addrVariant}
                      sx={{ color: '#333333', textAlign: 'center', fontFamily: 'inherit', lineHeight: 1.2 }}
                    >
                      {label}: {row[field]}
                    </Typography>
                  ) : null
                )}
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Container>
  );
}