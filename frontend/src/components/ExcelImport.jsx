import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import * as XLSX from 'xlsx';

import api from '../services/api';
import { getExcelColumns, invalidateExcelColumnsCache } from '../services/excelColumnsCache';
import { matchExcelHeaders, matchByValues, remapRows } from '../utils/excelColumnMatcher';
import { buildIdentityKey, mergeBelongsToValues } from '../utils/recipientIdentity';
import ColumnMatchDialog, { IGNORE_VALUE } from './ColumnMatchDialog';

// הופכת אינדקס עמודה (0,1,2...) לאות עמודה כמו באקסל (A, B, ... Z, AA, AB...)
function columnLetterFromIndex(index) {
  let letter = '';
  let n = index;
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

// Object.keys מקדימה כותרות שהן מספרים טהורים (כמו "1") להתחלה, גם אם הן בפועל העמודה
// האחרונה בקובץ - קוראים את שורת הכותרות כמערך (ששומר על הסדר האמיתי מהקובץ) ובונים
// לפיו את אותם שמות "__EMPTY"/"__EMPTY_1" ש-sheet_to_json הרגיל היה מייצר, כדי לסדר נכון.
// לעמודות בלי כותרת בכלל, בונים שם פנימי ייחודי-לגליון (לא רק "__EMPTY" הגנרי - אחרת
// עמודה בלי כותרת בגליון אחד "מתנגשת" עם עמודה בלי כותרת בגליון אחר ונחשבות לאותה עמודה!),
// ותווית ידידותית (שם הגליון + אות העמודה) להצגה למשתמשת במסך ההתאמה הידנית
function getHeaderInfo(sheet, sheetName) {
  const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || [];
  let emptyCount = 0;
  const trueOrder = [];
  const labels = {};
  const renameMap = {}; // מהשם הגנרי ש-sheet_to_json ייצר בפועל, לשם הייחודי החדש
  headerRow.forEach((cell, index) => {
    const text = String(cell ?? '').trim();
    if (text) {
      trueOrder.push(text);
      return;
    }
    const genericKey = emptyCount === 0 ? '__EMPTY' : `__EMPTY_${emptyCount}`;
    emptyCount += 1;
    const uniqueKey = `__EMPTY__${sheetName}__${index}`;
    trueOrder.push(uniqueKey);
    labels[uniqueKey] = `גליון ${sheetName} ${columnLetterFromIndex(index)}`;
    renameMap[genericKey] = uniqueKey;
  });
  return { trueOrder, labels, renameMap };
}

// מחליפה בכל שורה את השמות הגנריים (__EMPTY וכו') בשמות הייחודיים-לגליון, כדי שנתונים
// מעמודות בלי כותרת בגליונות שונים לא יתערבבו זה בזה
function applyRenameMap(rows, renameMap) {
  if (Object.keys(renameMap).length === 0) return rows;
  return rows.map((row) => {
    const renamed = { ...row };
    Object.entries(renameMap).forEach(([genericKey, uniqueKey]) => {
      if (genericKey in renamed) {
        renamed[uniqueKey] = renamed[genericKey];
        delete renamed[genericKey];
      }
    });
    return renamed;
  });
}

// שורה שאין בה שום ערך אמיתי באף עמודה (לפעמים אקסל "זוכר" שורה כחלק מהגליון גם
// אחרי שהתוכן נמחק ממנה, למשל אם הייתה בה פעם עיצוב/גבול) - לא אמורה להיכנס לטבלה
// בכלל, לא בתור "מוזמן ריק"
function isBlankRow(row) {
  return Object.values(row).every((value) => String(value ?? '').trim() === '');
}

// שורה שאין בה כלום בעמודת מדינה - כנראה כי לא כתבו שם משהו במיוחד - מקבלת כברירת מחדל "ישראל"
function applyDefaultCountry(rows) {
  return rows.map((row) =>
    String(row.country ?? '').trim() ? row : { ...row, country: 'ישראל' }
  );
}

// עמודת "הדפסה" (print) חייבת בשרת להיות true/false אמיתי - אבל בקובץ אקסל אנשים כותבים
// חופשי (כן/לא, Y/N, 1/0) שהשרת לא יודע לפרש כ-boolean וזורק שגיאה - ממירים כאן מראש
function normalizePrintField(rows) {
  const truthyValues = new Set(['true', 'כן', 'y', 'yes', '1']);
  return rows.map((row) => {
    if (row.print === undefined) return row;
    const normalized = String(row.print ?? '').trim().toLowerCase();
    return { ...row, print: truthyValues.has(normalized) };
  });
}

// ממלאת "שייך ל" = שם הגליון עבור שורות שמגיעות מגליונות שהמשתמשת אישרה, ורק כשהשדה
// עדיין ריק (לא דורסת ערך אמיתי שכבר קיים בשורה עצמה מהקובץ)
function applyBelongsToFromSheet(rows, rowSheetNames, confirmedSheets) {
  if (!confirmedSheets || confirmedSheets.size === 0) return rows;
  return rows.map((row, index) => {
    const sheetName = rowSheetNames[index];
    if (!confirmedSheets.has(sheetName)) return row;
    if (String(row.belongsTo ?? '').trim()) return row;
    return { ...row, belongsTo: sheetName };
  });
}

// כשאותו נמען (לפי buildIdentityKey) מופיע כמה פעמים באותו ייבוא - למשל בשני גליונות
// שונים באותו קובץ - ממזגים לשורה אחת, עם כל ערכי "שייך ל" מכל המופעים ביחד, במקום
// ליצור שתי שורות נפרדות לאותו אדם בפועל. שורות ללא שום פרט זהות (כל השדות ריקים)
// לא ממוזגות זו עם זו - כל אחת נשארת שורה נפרדת משלה
function mergeDuplicateIdentities(rows) {
  const map = new Map();
  const order = [];
  rows.forEach((row, index) => {
    const key = buildIdentityKey(row);
    const mapKey = key.replace(/\|/g, '') === '' ? `__blank__${index}` : key;
    if (!map.has(mapKey)) {
      map.set(mapKey, { ...row });
      order.push(mapKey);
    } else {
      const existing = map.get(mapKey);
      existing.belongsTo = mergeBelongsToValues(existing.belongsTo, row.belongsTo);
    }
  });
  return order.map((mapKey) => map.get(mapKey));
}

export default function ExcelImport({ onImport, onFailure }) {
  const navigate = useNavigate();
  const [fileNames, setFileNames] = useState([]); // כל הקבצים שהועלו בסשן הזה (לא רק האחרון)
  const [matchError, setMatchError] = useState('');
  const [pending, setPending] = useState(null);
  const [belongsToPrompt, setBelongsToPrompt] = useState(null); // { matchingSheets, checked, resume }
  const [, setColumns] = useState([]);

  // אם חוזרים לכאן אחרי שנלחץ "להגדרות נוספות על העמודות" מתוך מסך התאמת העמודות
  // (ולא נכנסו להגדרות בדרך הרגילה) - פותחים מחדש בדיוק את אותו מסך עם אותו קובץ,
  // כדי שלא יצטרכו להתחיל את הייבוא מההתחלה
  useEffect(() => {
    if (sessionStorage.getItem('reopenColumnMatch') !== 'true') return;
    sessionStorage.removeItem('reopenColumnMatch');
    const saved = sessionStorage.getItem('excelImportPending');
    sessionStorage.removeItem('excelImportPending');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setPending({
        ...parsed,
        confirmedSheets: parsed.confirmedSheets ? new Set(parsed.confirmedSheets) : parsed.confirmedSheets,
      });
    } catch (err) {
      console.error('לא ניתן היה לשחזר את מסך התאמת העמודות:', err);
    }
  }, []);

  // שומרת את כל מצב הייבוא הנוכחי (הקובץ, ההתאמות) לפני המעבר להגדרות, כדי שהחזרה
  // משם תוכל לפתוח מחדש בדיוק את אותו מסך - Set לא נשמר כמו שהוא ב-JSON, ממירים למערך
  const handleOpenColumnSettings = () => {
    sessionStorage.setItem(
      'excelImportPending',
      JSON.stringify({
        ...pending,
        confirmedSheets: pending.confirmedSheets ? [...pending.confirmedSheets] : pending.confirmedSheets,
      })
    );
    sessionStorage.setItem('settingsReturnTo', 'columnMatch');
    navigate('/settings');
  };

  // ממשיכה את זרימת הייבוא הרגילה (התאמת עמודות אוטומטית / מסך ידני) - עוטפת כל אחת
  // מנקודות היציאה שלה (onImport) בהחלת "שייך ל" לפי הגליון, כדי שזה יחול תמיד,
  // גם אם היה צריך גם מסך התאמת עמודות וגם את השאלה על "שייך ל".
  // confirmedSheets === null אומר "עוד לא שאלנו" - אחרי שהמשתמשת עונה זה הופך ל-Set אמיתי
  const runColumnMatching = async (json, rowSheetNames, headerLabels, confirmedSheets, fileName) => {
    const finish = (rows) =>
      onImport(mergeDuplicateIdentities(applyBelongsToFromSheet(rows, rowSheetNames, confirmedSheets ?? new Set())));

    try {
      const loadedColumns = await getExcelColumns();
      setColumns(loadedColumns);

      // אם עוד לא שאלנו: שואלים תמיד, על כל גליון בקובץ (בלי קשר להתאמה לשום רשימה) -
      // אם למלא "שייך ל" = שם הגליון לכל הנמענים שמגיעים ממנו
      if (confirmedSheets === null) {
        const uniqueSheetNames = [...new Set(rowSheetNames)];

        if (uniqueSheetNames.length > 0) {
          setBelongsToPrompt({
            matchingSheets: uniqueSheetNames,
            checked: new Set(), // ברירת מחדל: לא מסומן - זו החלטה מפורשת (כן/לא), לא הנחה אוטומטית
            json,
            rowSheetNames,
            headerLabels,
            fileName,
          });
          return;
        }
      }

      const seenHeaders = new Set();
      const headers = [];
      json.forEach((row) => {
        Object.keys(row).forEach((header) => {
          if (!seenHeaders.has(header)) {
            seenHeaders.add(header);
            headers.push(header);
          }
        });
      });

      const { matched, unmatched } = matchExcelHeaders(headers, loadedColumns);
      const { matched: matchedByValues, unmatched: stillUnmatched } =
          matchByValues(unmatched, json, loadedColumns);

      Object.assign(matched, matchedByValues);

      // עמודות שאין בהן שום נתון בקובץ בכלל - אין טעם לשאול עליהן, פשוט מדלגים
      const unmatchedWithData = stillUnmatched.filter((header) =>
        json.some((row) => String(row[header] ?? '').trim() !== '')
      );

      if (unmatchedWithData.length > 0) {
        setPending({
          json,
          matched,
          unmatchedHeaders: unmatchedWithData,
          columns: loadedColumns,
          headerLabels,
          rowSheetNames,
          confirmedSheets,
          fileName,
        });
        return;
      }

      const mappedRows = applyDefaultCountry(remapRows(json, matched));
      finish(mappedRows);
    } catch (err) {
      console.error('לא ניתן היה לטעון את הגדרות השדות מהשרת:', err);
      setMatchError('לא ניתן היה להתאים עמודות אוטומטית (השרת לא זמין) - הקובץ יובא כמו שהוא.');
      onFailure?.('EXCEL_COLUMN_MATCH_FAILED', `Reason: ${err.message || 'Column matching failed'}`);
      finish(json);
    }
  };

  const handleFile = async (event) => {
    try {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileName = file.name;
    setFileNames((prev) => [...prev, fileName]);
    setMatchError('');

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

    // קוראים את כל הגליונות בקובץ (לא רק את הראשון) - כדי לא לפספס גליון נוסף
    // (למשל גליון של כתובות בארץ וגליון נפרד של כתובות בחו"ל) - כולם מיובאים לאותה טבלה
    const sheetsData = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const { trueOrder, labels, renameMap } = getHeaderInfo(sheet, name);
      const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      return {
        sheetName: name,
        json: applyRenameMap(rawJson, renameMap).filter((row) => !isBlankRow(row)),
        trueOrder,
        labels,
      };
    }).filter((s) => s.json.length > 0);

    // תוויות ידידותיות (שם גליון + אות עמודה) לעמודות בלי כותרת, ממוזגות מכל הגליונות
    const headerLabels = {};
    sheetsData.forEach(({ labels }) => Object.assign(headerLabels, labels));

    const json = sheetsData.flatMap((s) => s.json);
    // שם הגליון שממנו הגיעה כל שורה, באותו סדר בדיוק כמו json - כדי לדעת אחר כך (אחרי
    // remapRows, ששומר על אותו סדר/כמות שורות) איזו שורה שייכת לאיזה גליון
    const rowSheetNames = sheetsData.flatMap((s) => s.json.map(() => s.sheetName));

    if (json.length === 0) {
      onImport(json);
      return;
    }

      await runColumnMatching(json, rowSheetNames, headerLabels, null, fileName);
    } catch (err) {
      console.error('Excel import failed:', err);
      setMatchError('לא ניתן לקרוא את קובץ ה־Excel.');
      onFailure?.('EXCEL_IMPORT_FAILED', `Reason: ${err.message || 'File could not be read'}`);
    }
  };

  const handleBelongsToConfirm = async () => {
    const { json, rowSheetNames, headerLabels, checked, fileName } = belongsToPrompt;
    setBelongsToPrompt(null);
    await runColumnMatching(json, rowSheetNames, headerLabels, checked, fileName);
  };

  // ביטול אמיתי - שום שורה לא נכנסת לטבלה, וגם שם הקובץ יורד מהרשימה שמוצגת ליד
  // הכפתור, כדי שלא יראה כאילו הוא כן יובא
  const handleBelongsToCancel = () => {
    const { fileName } = belongsToPrompt;
    setBelongsToPrompt(null);
    setFileNames((prev) => {
      const index = prev.lastIndexOf(fileName);
      return index === -1 ? prev : [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  };

  const toggleBelongsToSheet = (sheetName, shouldFill) => {
    setBelongsToPrompt((prev) => {
      const checked = new Set(prev.checked);
      if (shouldFill) checked.add(sheetName);
      else checked.delete(sheetName);
      return { ...prev, checked };
    });
  };

  const handleDialogConfirm = async (choices) => {
    const { json, matched, unmatchedHeaders, headerLabels, rowSheetNames, confirmedSheets } = pending;
    setPending(null);

    const finalMatched = { ...matched };
    const aliasesToSave = [];
    unmatchedHeaders.forEach((header) => {
      const technicalName = choices[header];
      if (technicalName && technicalName !== IGNORE_VALUE) {
        finalMatched[header] = technicalName;
        // עמודות בלי כותרת אמיתית בקובץ (רק מיקום - "גליון X, עמודה Y") לא נשמרות ככינוי קבוע -
        // אותו מיקום בקובץ אחר לגמרי לא בהכרח אומר אותו דבר. שומרים כינוי רק לכותרת אמיתית
        // שהמשתמשת/מי שהכין את הקובץ כתבו בפועל
        if (!headerLabels?.[header]) {
          aliasesToSave.push({ header, technicalName });
        }
      }
    });

    // שומרים את הבחירה כ"כינוי" חדש בטבלה - כדי שבפעם הבאה זה יזוהה אוטומטית
    if (aliasesToSave.length > 0) {
      await Promise.all(
        aliasesToSave.map(({ header, technicalName }) =>
          api.addRecipientColumnAlias(technicalName, header).catch((err) => {
            console.error('לא ניתן היה לשמור את הכינוי החדש:', err);
            onFailure?.('EXCEL_ALIAS_SAVE_FAILED', `Reason: ${err.message || 'Column alias could not be saved'}`);
          })
        )
      );
      // מבטלים את המטמון כדי שהייבוא הבא (גם באותה טעינת דף) יכיר את הכינוי החדש מיד
      invalidateExcelColumnsCache();
    }

    const mappedRows = normalizePrintField(applyDefaultCountry(remapRows(json, finalMatched)));
    onImport(mergeDuplicateIdentities(applyBelongsToFromSheet(mappedRows, rowSheetNames, confirmedSheets)));
  };

  // ביטול אמיתי - בניגוד למה שהיה קודם, שום שורה לא נכנסת לטבלה (לא רק מדלגים על
  // העמודות שלא זוהו) - וגם שם הקובץ יורד מהרשימה שמוצגת ליד הכפתור
  const handleDialogCancel = () => {
    const { fileName } = pending;
    setPending(null);
    setFileNames((prev) => {
      const index = prev.lastIndexOf(fileName);
      return index === -1 ? prev : [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Button
        variant="outlined"
        component="label"
        size="small"
        sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          bgcolor: '#ffffff',
          color: '#1e293b',
          borderColor: '#60a5fa',
          py: 0.15,
          px: 1,
          fontSize: '0.75rem',
          '&:hover': { bgcolor: '#eff6ff', borderColor: '#60a5fa' },
        }}
      >
        ייבוא Excel
        <input hidden type="file" accept=".xlsx,.xls" onChange={handleFile} />
      </Button>
      {fileNames.length > 0 && (
        <Typography
          variant="caption"
          title={fileNames.join(', ')}
          sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {fileNames.join(', ')}
        </Typography>
      )}
      {matchError && (
        <Typography color="error" variant="caption">
          {matchError}
        </Typography>
      )}
      {belongsToPrompt && (
        <Dialog open onClose={handleBelongsToCancel} maxWidth="xs">
          <DialogTitle sx={{ pb: 0.5, pt: 1.5, fontSize: '1.05rem' }}>האם למלא את שדה "שייך ל" בשם הגליון?</DialogTitle>
          <DialogContent>
            <Stack spacing={0.5}>
              {belongsToPrompt.matchingSheets.map((sheetName) => (
                <Stack
                  key={sheetName}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 0.25, borderBottom: '1px solid #f1f5f9' }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {sheetName}
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={belongsToPrompt.checked.has(sheetName) ? 'yes' : 'no'}
                    onChange={(event, value) => {
                      if (value) toggleBelongsToSheet(sheetName, value === 'yes');
                    }}
                  >
                    <ToggleButton value="yes" sx={{ textTransform: 'none', px: 2 }}>
                      כן
                    </ToggleButton>
                    <ToggleButton value="no" sx={{ textTransform: 'none', px: 2 }}>
                      לא
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleBelongsToCancel}>ביטול</Button>
            <Button onClick={handleBelongsToConfirm} variant="contained">
              המשך
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {pending && (
        <ColumnMatchDialog
          open
          unmatchedHeaders={pending.unmatchedHeaders}
          headerLabels={pending.headerLabels}
          columns={pending.columns}
          rows={pending.json}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
          onOpenColumnSettings={handleOpenColumnSettings}
        />
      )}
    </Box>
  );
}
