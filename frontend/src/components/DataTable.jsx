import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box,Button,Paper,Stack,Typography,TextField,Chip,Menu,MenuItem,IconButton,Popper,Dialog,DialogTitle,DialogContent,DialogContentText,DialogActions,} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { DataGrid, useGridApiRef } from '@mui/x-data-grid';
import { getExcelColumns } from '../services/excelColumnsCache';
import ExcelImport from './ExcelImport';
import ExcelJS from 'exceljs';
// מספר בית: ספרות, ואפשר אות אחת בסוף (כמו "12" או "12א")
const HOUSE_NO_PATTERN = /^\d+[a-zA-Zא-ת]?$/;

// שדות מערכת/ביקורת (לא "פרטי אורח") - לא מנוהלים דרך excel_columns, נשארים קבועים בקוד
const systemColumns = [
  { field: 'hashCode', headerName: 'מפתח', flex: 1, minWidth: 90, editable: false },
  { field: 'changed', headerName: 'שונה', flex: 0.6, minWidth: 70, editable: false, type: 'boolean' },
  { field: 'changeDate', headerName: 'תאריך שינוי', flex: 0.8, minWidth: 90, editable: false },
  { field: 'changeBy', headerName: 'שונה ע"י', flex: 0.8, minWidth: 90, editable: false },
  { field: 'createdBy', headerName: 'נוצר ע"י', flex: 0.8, minWidth: 90, editable: false },
];

const SYSTEM_FIELDS_HIDDEN_BY_DEFAULT = {
  hashCode: false,
  changed: false,
  changeDate: false,
  changeBy: false,
  createdBy: false,
};

// עמודות כתובת - מהן אפשר להעביר ערך שלא מתאים לעמודת "הערת כתובת" (קליק ימני על התא)
const ADDRESS_FIELDS = ['country', 'city', 'neighborhood', 'street', 'houseNo'];

// קוראת את "זיכרון המקור" (ר' moveValueToAddressNote) - JSON שנשמר בעמודה נפרדת
// (addressNoteSources, לא מוצג בטבלה בכלל) ומתאר אילו ערכים בהערת הכתובת הועברו
// מאיזה שדה. זה מה שמאפשר להציע "החזר ל-X" בלי שום סימן נראה בטקסט של ההערה עצמה
function parseAddressNoteTags(sourcesJson, fieldDefs) {
  let sources;
  try {
    sources = JSON.parse(sourcesJson || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(sources)) return [];
  return sources
    .map((entry) => {
      if (!entry || !ADDRESS_FIELDS.includes(entry.field) || !entry.value) return null;
      const label = fieldDefs.find((f) => f.technicalName === entry.field)?.displayName || entry.field;
      return { field: entry.field, value: entry.value, label };
    })
    .filter(Boolean);
}

// המיון המובנה של הטבלה (Intl.Collator() בלי locale) לא ממיין נכון לפי א'-ב' עברי -
// collator עם locale 'he' ממיין נכון, וגם numeric:true נותן סדר טבעי למספרים (כמו במספר בית)
const hebrewCollator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

// כשעמודה שממיינים בה שווה בין שתי שורות (לדוגמה שתי שורות עם אותו שם פרטי) - "תת המיון"
// שובר את השוויון לפי שרשרת עמודות נוספות שהמשתמשת בוחרת בעצמה (אפשר כמה, לפי סדר עדיפות),
// כל אחת לפי א'-ב'. ה-DataGrid בגרסה הזו (Community) תומך רק בעמודת מיון אחת בו-זמנית,
// אז זו הדרך היחידה לקבל בפועל "מיון בתוך מיון" בלי לשדרג לגרסת Pro בתשלום
function createTextSortComparator(field, secondaryFields) {
  return (value1, value2, param1, param2) => {
    const primary = hebrewCollator.compare(String(value1 ?? ''), String(value2 ?? ''));
    if (primary !== 0) return primary;

    const row1 = param1.api.getRow(param1.id);
    const row2 = param2.api.getRow(param2.id);
    for (const secondaryField of secondaryFields) {
      if (secondaryField === field) continue;
      const secondary = hebrewCollator.compare(
        String(row1?.[secondaryField] ?? ''),
        String(row2?.[secondaryField] ?? '')
      );
      if (secondary !== 0) return secondary;
    }
    return 0;
  };
}

// כותרת עמודה מותאמת אישית: מיון קורה רק בלחיצה על חץ המיון הקטן (לא בכל מקום
// בכותרת, כמו שהיה בברירת המחדל של הרכיב) - ודאבל-קליק על שם העמודה "משחרר" אותה
// לגרירה, כדי לסדר מחדש את מיקום העמודות. הרחבה/הצרה נעשית ע"י גרירת הקו הדק שבצד
// העמודה. שתי התכונות (גרירה וסידור, הרחבה) לא קיימות בגרסה החינמית של ה-DataGrid
// (הן פיצ'ר בתשלום, Pro) ולכן נבנו כאן ידנית מאפס
function ColumnHeader({
  headerName,
  field,
  sortDirection,
  onSortClick,
  isDragArmed,
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', position: 'relative', zIndex: 2, pr: '24px' }}>
      <Typography
        noWrap
        data-column-title="true"
        sx={{
          fontWeight: 700,
          color: '#4b5563',
          fontFamily: '"Rubik", "Segoe UI", Arial, sans-serif',
          letterSpacing: '0.01em',
          fontSize: 'inherit',
          cursor: isDragArmed ? 'grabbing' : 'grab',
          bgcolor: isDragArmed ? '#eff6ff' : 'transparent',
          borderRadius: 1,
          px: 0.5,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {headerName}
      </Typography>
      <IconButton
        size="small"
        data-sort-icon="true"
        onClick={(event) => {
          event.stopPropagation();
          onSortClick(field);
        }}
        sx={{ p: 0.25, flexShrink: 0 }}
      >
        {sortDirection === 'asc' ? (
          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
        ) : sortDirection === 'desc' ? (
          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
        ) : (
          <ArrowUpwardIcon sx={{ fontSize: 14, opacity: 0.25 }} />
        )}
      </IconButton>
    </Box>
  );
}

export default function DataTable({ records, loading, onSave, onAutoSave, onSelectionChange, onDeleteRows, initialSelectedIds, onImport, onOpenPrint, columnPreferences, profileMenu, onColumnOrderChange }) {
  const [rows, setRows] = useState(records);
  const [selectionModel, setSelectionModel] = useState(initialSelectedIds || []);
  const [sortModel, setSortModel] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [fieldDefs, setFieldDefs] = useState([]);

  const [problemQueue, setProblemQueue] = useState([]); // תורי תאים שצריך לתקן לפני שמירה - {id, field}
  const [pendingProblems, setPendingProblems] = useState([]); // תאים בעייתיים שממתינים להחלטה - לתקן או לשמור בכל זאת
  const [saveAnywayDialogOpen, setSaveAnywayDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY, id, field } - קליק ימני על תא כתובת
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null); // כפתור "יצוא" - תפריט הדפסת מדבקות / הורדת קובץ
  const [secondarySortFields, setSecondarySortFields] = useState([]); // תת-מיון: שרשרת עמודות לשבירת שוויון, לפי בחירת המשתמשת
  const [columnOrder, setColumnOrder] = useState(null); // null = סדר ברירת המחדל (defaultOrder) - אחרת מערך שמות שדות בסדר שהמשתמשת גררה
  const [columnWidths, setColumnWidths] = useState({}); // technicalName -> רוחב בפיקסלים, רק לעמודות שהורחבו/צומצמו ידנית
  const [dragArmedField, setDragArmedField] = useState(null); // איזו עמודה "משוחררת" לגרירה אחרי דאבל-קליק על הכותרת שלה
  const dragTrackingRef = useRef(null); // { field, startX, startY, moved } בזמן גרירת עמודה לסידור מחדש
  const resizingRef = useRef(null); // { field, startX, startWidth } בזמן גרירת קו ההרחבה
  const onColumnOrderChangeRef = useRef(onColumnOrderChange);
  useEffect(() => {
    onColumnOrderChangeRef.current = onColumnOrderChange;
  }, [onColumnOrderChange]);
  const appliedInitialSelection = useRef(false);
  const apiRef = useGridApiRef();
  // ה-columns מחושבות רק פעם אחת (memo תלוי ב-fieldDefs) והפעולות שבתוכן (renderCell)
  // צריכות תמיד את השורות העדכניות ביותר - לכן משתמשים ב-ref ולא סוגרים על rows ישירות
  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const gridContainerRef = useRef(null);
  // דגל שמסמן שהיציאה מהשדה (blur) הבאה נגרמה ע"י Enter (ולא ע"י לחיצת עכבר על שדה
  // אחר) - נקבע ממש לפני ה-blur() היזום, ונקרא/מתאפס ב-handleFocusOut. רק Enter אמור
  // לגרום לקפיצה האוטומטית לתיקון הבא; לחיצת עכבר על שדה אחר צריכה לתת לערוך אותו
  // בשקט, גם אם זה בטעות פותר תא תיקון קודם
  const blurredViaEnterRef = useRef(false);
  const suppressNextJumpRef = useRef(false);
  const problemQueueRef = useRef(problemQueue);
  useEffect(() => {
    problemQueueRef.current = problemQueue;
  }, [problemQueue]);

  // ל-DataGrid (בגרסה הזו) אין prop מובנה של onCellContextMenu - לכן מאזינים ישירות
  // לאירוע contextmenu הטבעי של הדפדפן על הקונטיינר, ומזהים את התא/שורה לפי data-field/data-id
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return undefined;

    const handleNativeContextMenu = (event) => {
      const cellEl = event.target.closest('.MuiDataGrid-cell');
      if (!cellEl) return;
      const field = cellEl.getAttribute('data-field');
      // עמודות כתובת - קליק ימני מעביר ערך להערת כתובת. עמודת הערת הכתובת עצמה -
      // קליק ימני מציע להחזיר ערכים שכבר הועברו אליה בעבר בחזרה לשדה המקורי שלהם
      if (!ADDRESS_FIELDS.includes(field) && field !== 'addressNote') return;
      const rowEl = event.target.closest('.MuiDataGrid-row');
      const id = rowEl ? rowEl.getAttribute('data-id') : null;
      if (!id) return;

      event.preventDefault();
      setContextMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6, id, field });
    };

    container.addEventListener('contextmenu', handleNativeContextMenu);
    return () => container.removeEventListener('contextmenu', handleNativeContextMenu);
  }, []);

  // כפתור מחיקה צף שנשאר תמיד באותו קצה קבוע של המסך (לא בתוך עמודה של הטבלה עצמה) -
  // כי ה-DataGrid בגרסה הזו ממקם את התאים שלו בעצמו (position אבסולוטי), וזה מתנגש עם
  // ניסיון להצמיד עמודה רגילה. במקום זה עוקבים אחרי מיקום השורה שבריחוף ומציירים מעליה.
  const [hoveredRow, setHoveredRow] = useState(null); // { id, top, height }

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return undefined;

    const handleMouseOver = (event) => {
      // אם העכבר עבר על כפתור המחיקה הצף עצמו - לא מאפסים, אחרת הוא נעלם ברגע שמנסים ללחוץ עליו
      if (event.target.closest('[data-row-delete-icon]')) return;
      const rowEl = event.target.closest('.MuiDataGrid-row');
      if (!rowEl) {
        setHoveredRow(null);
        return;
      }
      const id = rowEl.getAttribute('data-id');
      const containerRect = container.getBoundingClientRect();
      const rowRect = rowEl.getBoundingClientRect();
      setHoveredRow({ id, top: rowRect.top - containerRect.top, height: rowRect.height });
    };

    const handleMouseLeave = () => setHoveredRow(null);

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);


  // סדר העמודות ומה מוצג כברירת מחדל נקבעים ב-excel_columns (ב-Neon), לא בקוד -
  // נטען פעם אחת (getExcelColumns ממטמנת) ולא בכל טעינה מחדש
    useEffect(() => {
        getExcelColumns()
            .then((data) => {
                console.log("EXCEL COLUMNS:", data);
                setFieldDefs(data);
            })
            .catch((err) => {
                console.log("COLUMN ERROR:", err);
                setFieldDefs([]);
            });
    }, []);
  // ברשומות שמגיעות מהשרת החדש (Recipients) אין יותר שדה id מספרי - המזהה הייחודי
  // האמיתי הוא ה-hashCode (מפתח ראשי של הטבלה בפועל) - ה-DataGrid חייב שדה id ייחודי
  // לכל שורה, אז ממלאים אותו מה-hashCode כשהוא חסר
  useEffect(() => {
    setRows(records.map((r) => ({ ...r, id: r.id ?? r.hashCode })));
  }, [records]);

  // משחזרת פעם אחת בלבד את הבחירה שהייתה קיימת (חוזרים מתצוגה מקדימה), ברגע שהשורות נטענות
  useEffect(() => {
    if (!appliedInitialSelection.current && rows.length && initialSelectedIds && initialSelectedIds.length) {
      const matched = rows.filter((row) => initialSelectedIds.includes(row.id));
      if (matched.length) {
        onSelectionChange(matched);
      }
      appliedInitialSelection.current = true;
    }
  }, [rows, initialSelectedIds, onSelectionChange]);

 const handleSaveClick = () => {
    const problems = findProblemCells(rows);
    if (problems.length > 0) {
      // לא קופצים ישר לתיקון - שואלים קודם אם לשמור בכל זאת למרות השדות הבעייתיים
      setPendingProblems(problems);
      setSaveAnywayDialogOpen(true);
      return;
    }
    onSave(rows);
  };

  // "שמור בכל זאת" - מתעלמים מהשדות הבעייתיים ושומרים את הטבלה כמו שהיא
    const handleSaveAnyway = () => {
        console.log("נכנסתי לשמור ללא תיקון");
        console.log("rows:", rows);

        setSaveAnywayDialogOpen(false);
        onSave(rows);
    };

  // "לתקן עכשיו" - נכנסים לתהליך הקפיצה האוטומטית לתיקון השדות, כמו שהיה קודם
  const handleFixProblemsNow = () => {
    setSaveAnywayDialogOpen(false);
    // מנקים סינון/מיון כדי שכל השורות יהיו גלויות בסדר קבוע - כדי שאפשר יהיה לקפוץ ביניהן
    setActiveFilters([]);
    setInputValue('');
    setSortModel([]);
    setProblemQueue(pendingProblems);
  };

  const handlePrintLabels = () => {
    setExportMenuAnchor(null);
    if (onOpenPrint) onOpenPrint();
  };

    const handleDownloadExcel = async () => {
        setExportMenuAnchor(null);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('נתונים');

        // כותרות העמודות
        const visibleColumns = columns.filter(
            (column) => column.field && columnVisibilityModel[column.field] !== false
        );

        worksheet.columns = visibleColumns.map((column) => ({
            header: (column.headerName || column.field).replace(/\s*\*+\s*$/, ''),
            key: column.field,
            width: 20,
        }));

        // השורות שמוצגות כרגע
        filteredRows.forEach((row) => {
            const rowData = {};

            visibleColumns.forEach((column) => {
                rowData[column.field] = row[column.field] ?? '';
            });

            worksheet.addRow(rowData);
        });

        // הורדה למחשב
        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'רשימת מוזמנים.xlsx';
        link.click();

        URL.revokeObjectURL(url);
    };

  const handleAddRow = () => {
    // חלק מה-id-ים הם hashCode (מחרוזת, לא מספר) - מתעלמים מהם בחישוב המספר הבא
    const numericIds = rows.map((row) => Number(row.id)).filter((n) => Number.isFinite(n));
    const nextId = numericIds.length ? Math.max(...numericIds) + 1 : 1;
    const newRow = {
      id: nextId,
      prefix: '',
      man: '',
      woman: '',
      lastName: '',
      suffix: '',
      fatherName: '',
      motherName: '',
      phone: '',
      mail: '',
      country: 'ישראל',
      city: '',
      neighborhood: '',
      street: '',
      houseNo: '',
      addressNote: '',
      addressNoteSources: '',
      belongsTo: '',
      print: false,
    };
    setRows((prevRows) => [newRow, ...prevRows]);

    // גוללים לשורה החדשה (תמיד נוספת בראש הרשימה) - אם המשתמשת גוללה למטה בטבלה
    // לפני שהוסיפה שורה, שלא תצטרך לחפש ידנית איפה היא נוספה
    setTimeout(() => {
      apiRef.current?.scrollToIndexes({ rowIndex: 0, colIndex: 0 });
    }, 0);
  };

  const handleDeleteRows = () => {
    const updatedRows = rows.filter((row) => !selectionModel.includes(row.id));
    setRows(updatedRows);
    setSelectionModel([]);
    onSelectionChange([]);
    onAutoSave(updatedRows);
      console.log("ROWS AFTER DELETE:", updatedRows);
    // מחיקה מפורשת מיידית בשרת - רק השורות שבאמת סומנו ונלחצו עליהן "מחק", לא לפי השוואת רשימה
    if (onDeleteRows) {
      onDeleteRows(selectionModel);
    }
  };

  // מחיקת שורה בודדת - כפתור הפח שמופיע בריחוף על שורה, בלי צורך לסמן אותה קודם
  const handleDeleteSingleRow = useCallback((id) => {
    const updatedRows = rowsRef.current.filter((row) => String(row.id) !== String(id));
    setRows(updatedRows);
    setSelectionModel((prev) => prev.filter((selectedId) => String(selectedId) !== String(id)));
    onAutoSave(updatedRows);
    if (onDeleteRows) {
      onDeleteRows([id]);
    }
  }, [onAutoSave, onDeleteRows]);

  const handleCloseContextMenu = () => setContextMenu(null);

  // כל התאים בטבלה (חוץ מכתובת/בוליאני) עובדים ישירות על ה-state, בלי להסתמך על
  // "מצב עריכה" של ה-DataGrid (דאבל-קליק להיכנס לעריכה) - זה עוקף לגמרי בעיה שנתקלנו
  // בה שבה כניסה למצב עריכה לא תמיד עבדה בצורה עקבית. כל תא הוא קלט חי תמיד, שמעדכן
  // את השורה מיד עם כל הקשה
  const updateCellValue = useCallback((id, field, value) => {
    const updatedRows = rowsRef.current.map((row) =>
      String(row.id) === String(id) ? { ...row, [field]: value } : row
    );
    setRows(updatedRows);
    onAutoSave(updatedRows);

    // עדכון הצביעה האדומה על "בעל"/"אישה" תלוי בערך של השדה השני באותה שורה
    // (חובה זוגית - ראו isRequiredEmpty), אז כשמקלידים באחד מהם צריך שגם התא השני
    // "יתעורר" ויבדוק את עצמו מיד, בלי לחכות ל-blur - updateRows מודיע ל-DataGrid
    // במפורש על השורה המעודכנת, בניגוד להסתמכות בלבד על שינוי ה-prop rows. בכוונה
    // *לא* מוציאים כאן משהו מתור התיקונים (problemQueue) - זה עדיין קורה רק ב-blur
    // (handleFocusOut), אחרת כל הקשה בודדת הייתה מפעילה את אפקט "הקפיצה לבעיה הבאה"
    // וגונבת את הפוקוס מהשדה תוך כדי שעדיין מקלידים בו
    if (field === 'man' || field === 'woman') {
      const updatedRow = updatedRows.find((row) => String(row.id) === String(id));
      if (updatedRow && apiRef.current?.updateRows) {
        apiRef.current.updateRows([updatedRow]);
      }
    }
  }, [onAutoSave, apiRef]);

  // מעבירה את הערך מתא בעמודת כתובת (כשהוא לא מתאים) לעמודת "הערת כתובת" -
  // ומרוקנת את התא המקורי. אם כבר יש תוכן בהערת הכתובת, משרשרת אליו (מופרד ב-";")
  // במקום לדרוס - בלי שום תיוג נראה בטקסט עצמו. מאיזה שדה הערך הגיע נשמר בנפרד,
  // ב-addressNoteSources (JSON, עמודה נפרדת ב-DB שלא מוצגת בטבלה בכלל) - כך
  // שאפשר יהיה להחזיר אותו בעתיד גם אחרי רענון (ר' handleReturnFromAddressNote)
  const moveValueToAddressNote = useCallback((id, field) => {
    const updatedRows = rowsRef.current.map((row) => {
      if (String(row.id) !== String(id)) return row;
      const value = String(row[field] ?? '').trim();
      if (!value) return row;
      const existingNote = String(row.addressNote ?? '').trim();
      let sources;
      try {
        sources = JSON.parse(row.addressNoteSources || '[]');
      } catch {
        sources = [];
      }
      if (!Array.isArray(sources)) sources = [];
      sources.push({ field, value });
      return {
        ...row,
        [field]: '',
        addressNote: existingNote ? `${existingNote}; ${value}` : value,
        addressNoteSources: JSON.stringify(sources),
      };
    });
    setRows(updatedRows);
    onAutoSave(updatedRows);
  }, [onAutoSave]);

  const handleMoveToAddressNote = () => {
    if (!contextMenu) return;
    moveValueToAddressNote(contextMenu.id, contextMenu.field);
    setContextMenu(null);
  };

  // מחזירה ערך שהועבר בעבר (ר' למעלה) מהערת הכתובת בחזרה לשדה שממנו הוא הגיע -
  // מוציאה מופע אחד (הראשון התואם) מהטקסט של ההערה (שאר החלקים, כולל טקסט חופשי
  // שהוקלד ידנית, נשארים בדיוק כמו שהיו) ואת אותה רשומה מ-addressNoteSources
  const handleReturnFromAddressNote = (tag) => {
    if (!contextMenu) return;
    const { id } = contextMenu;
    const updatedRows = rowsRef.current.map((row) => {
      if (String(row.id) !== String(id)) return row;
      let removedFromNote = false;
      const remainingChunks = String(row.addressNote ?? '')
        .split(';')
        .map((chunk) => chunk.trim())
        .filter((chunk) => {
          if (!chunk) return false;
          if (!removedFromNote && chunk === tag.value) {
            removedFromNote = true;
            return false;
          }
          return true;
        });

      let sources;
      try {
        sources = JSON.parse(row.addressNoteSources || '[]');
      } catch {
        sources = [];
      }
      if (!Array.isArray(sources)) sources = [];
      let removedFromSources = false;
      sources = sources.filter((entry) => {
        if (!removedFromSources && entry?.field === tag.field && entry?.value === tag.value) {
          removedFromSources = true;
          return false;
        }
        return true;
      });

      return {
        ...row,
        [tag.field]: tag.value,
        addressNote: remainingChunks.join('; '),
        addressNoteSources: JSON.stringify(sources),
      };
    });
    setRows(updatedRows);
    onAutoSave(updatedRows);
    setContextMenu(null);
  };

  // אייקון קטן שמופיע כשעוברים עם העכבר על תא בעמודת כתובת - לחיצה עליו מעבירה
  // את הערך ישירות ל"הערת כתובת", כדי שהאפשרות תהיה גלויה ולא רק דרך קליק ימני
  const renderAddressCell = useCallback((params) => {
    const { id, field, value } = params;
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          px: 1,
        }}
      >
        <input
          value={value ?? ''}
          onChange={(event) => updateCellValue(id, field, event.target.value)}
          onClick={(event) => event.stopPropagation()}
          // בלי stopPropagation כאן ה-DataGrid תופס את מקש הרווח כקיצור מקלדת שלו
          // (למשל גלילה/בחירה) במקום לתת לו סתם להקליד תו רווח רגיל בתוך השדה.
          // Enter מבצע blur על השדה - זה מפעיל את בדיקת ה-focusout הקיימת, שאם השדה
          // תקין מסירה אותו מתור התיקונים וקופצת אוטומטית לתא הבעייתי הבא
          onKeyDown={(event) => {
            if (event.key === ' ') {
              event.stopPropagation();
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              blurredViaEnterRef.current = true;
              event.currentTarget.blur();
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            height: '100%',
            font: 'inherit',
            background: 'transparent',
          }}
        />
      </Box>
    );
  }, [updateCellValue]);

  // תא טקסט חי - קלט חופשי לגמרי תמיד, ואם יש pickListField (עמודות קידומת/סיום/
  // שייך ל) גם חץ קטן לצידו שפותח Menu לבחירה מהערכים הקיימים באותה עמודה. שתי
  // האפשרויות זמינות בו-זמנית. הרשימה מחושבת מ-rowsRef בזמן אמת כשפותחים אותה (לא
  // memo שתלוי ב-rows) - בכוונה, כי memo כזה היה יוצר מערך options חדש בכל הקשה,
  // מה שהיה מכריח את columns כולו להיווצר מחדש וגורם ל-DataGrid לאבד פוקוס מהקלט
  // אחרי כל אות (בדיוק הבאג שנתקלנו בו)
  const renderTextCell = useCallback((pickListField) => {
    const TextCell = (params) => {
      const { id, field, value } = params;
      const [menuOpen, setMenuOpen] = useState(false);
      const [menuOptions, setMenuOptions] = useState([]);
      const [expanded, setExpanded] = useState(false); // "שייך ל" עם כמה ערכים - הוצג במלואו ביוזמת המשתמשת
      const [isFocused, setIsFocused] = useState(false); // האם נמצאים בעריכה בפועל (לא רק "הצצה")
      const boxRef = useRef(null);

      // "שייך ל" יכול להכיל כמה ערכים מופרדים בפסיק (למשל נמען ששייך גם ל"עבודה"
      // וגם ל"שכנים") - כשזה ארוך, מציגים רק את הערך הראשון + תגית "+N", ורק לחיצה
      // על התגית (או כניסה לעריכה) חושפת את הכל. זה ויזואלי בלבד - הערך עצמו בתא
      // (ולכן גם החיפוש, שמסתמך עליו) לא משתנה כלל. "הצצה" (לחיצה על "+N" בלי להיכנס
      // בפועל לעריכה) לא סוגרת את עצמה לבד ב-blur (כי הפוקוס אף פעם לא עבר ל-input) -
      // לכן יש לה תגית "כווץ" נפרדת לחזרה מפורשת, בעוד שיציאה מעריכה אמיתית עדיין
      // מכווצת אוטומטית
      const valueParts = String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const isMultiValue = field === 'belongsTo' && valueParts.length > 1;
      const showCollapsed = isMultiValue && !expanded;
      const showExpandedPeek = isMultiValue && expanded && !isFocused;

      // בכוונה בלי MUI Menu כאן - ל-Menu יש "backdrop" בלתי נראה שמכסה את כל הדף
      // (כדי לזהות קליק-מחוץ-לתפריט) והוא תופס את הקליק השני של דאבל-קליק על אותו
      // input לפני שהוא מגיע אליו בכלל - זה מה ששבר את "בחירת מילה שלמה" בעמודות
      // האלה בלבד. הפתרון: Popper (לא Menu/Popover) - אותו מנוע מיקום חכם מול
      // עוגן (כולל RTL נכון), אבל בלי backdrop ובלי modal - ופורטל אוטומטי ל-body
      // כדי לא להיחתך ע"י overflow:hidden של התא
      const openMenu = () => {
        const values = Array.from(
          new Set(
            rowsRef.current
              .map((row) => row[pickListField])
              .filter((v) => v && String(v).trim())
          )
        );
        setMenuOptions(values);
        setMenuOpen(true);
      };
      const closeMenu = () => setMenuOpen(false);

      // מסננת את הרשימה תוך כדי הקלדה - רק ערכים שמתחילים במה שכבר הוקלד, כדי
      // שאפשר יהיה גם להקליד חופשי וגם לראות מיד אילו ערכים קיימים תואמים
      const typed = String(value ?? '').trim();
      const filteredOptions = typed
        ? menuOptions.filter((option) => option.startsWith(typed))
        : menuOptions;

      return (
        <Box ref={boxRef} sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', px: 1, position: 'relative' }}>
          <input
            value={value ?? ''}
            onChange={(event) => updateCellValue(id, field, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            // בלי stopPropagation כאן ה-DataGrid תופס את מקש הרווח כקיצור מקלדת שלו
            // (למשל גלילה/בחירה) במקום לתת לו סתם להקליד תו רווח רגיל בתוך השדה.
            // Enter מבצע blur על השדה - זה מפעיל את בדיקת ה-focusout הקיימת, שאם השדה
            // תקין מסירה אותו מתור התיקונים וקופצת אוטומטית לתא הבעייתי הבא
            onKeyDown={(event) => {
              if (event.key === ' ') {
                event.stopPropagation();
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                blurredViaEnterRef.current = true;
                event.currentTarget.blur();
              }
            }}
            // לחיצה/כניסה לתא בעמודות הבחירה פותחת את רשימת הערכים הקיימים, בלי צורך
            // ללחוץ בנפרד על חץ - אפשר עדיין להקליד חופשי במקביל. כניסה לעריכה תמיד
            // חושפת את הטקסט המלא (גם אם "שייך ל" מכווץ כרגע), ויציאה ממנה מכווצת שוב
            onFocus={() => {
              setIsFocused(true);
              setExpanded(true);
              if (pickListField) openMenu();
            }}
            onBlur={() => {
              setIsFocused(false);
              setExpanded(false);
              closeMenu();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              height: '100%',
              font: 'inherit',
              background: 'transparent',
              opacity: showCollapsed ? 0 : 1,
              // בהצצה (showExpandedPeek) יש תגית "כווץ" צפה מעל התא - משאירים לה מקום
              // פנוי מהטקסט כדי שלא תכסה חלק מהתוכן
              paddingInlineEnd: showExpandedPeek ? 40 : 0,
            }}
          />
          {showCollapsed && (
            <Box
              onClick={() => boxRef.current?.querySelector('input')?.focus()}
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                px: 1,
                gap: 0.5,
                cursor: 'text',
              }}
            >
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {valueParts[0]}
              </Typography>
              <Chip
                size="small"
                label={`+${valueParts.length - 1}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded(true);
                }}
                sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }}
              />
            </Box>
          )}
          {showExpandedPeek && (
            // בהצצה, הטקסט המלא מוצג ישירות דרך ה-input עצמו (בלי חיתוך/שלוש נקודות) -
            // רק תגית "כווץ" קטנה צפה מעליו בצד, לא מכסה את כל התא כמו במצב המכווץ
            <Chip
              size="small"
              label="כווץ"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(false);
              }}
              sx={{
                position: 'absolute',
                insetInlineEnd: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 20,
                fontSize: '0.7rem',
                bgcolor: '#ffffff',
                boxShadow: 1,
              }}
            />
          )}
          {pickListField && (
            <Popper
              open={menuOpen}
              anchorEl={boxRef.current}
              placement="bottom-start"
              style={{ zIndex: 1300 }}
            >
              <Paper
                elevation={0}
                sx={{
                  width: 'fit-content',
                  maxHeight: 220,
                  overflowY: 'auto',
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
                  border: '1px solid #93c5fd',
                  p: 0.25,
                }}
              >
                {filteredOptions.length ? (
                  filteredOptions.map((option) => (
                    <MenuItem
                      key={option}
                      // מונע מהלחיצה על אפשרות "לגזול" פוקוס מה-input לפני שה-onClick
                      // מספיק לרוץ - כך ה-input אף פעם לא מאבד פוקוס בזמן בחירה
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        updateCellValue(id, field, option);
                        closeMenu();
                      }}
                      sx={{
                        fontSize: '0.875rem',
                        minHeight: 26,
                        py: 0,
                        borderRadius: 1.5,
                        my: 0.15,
                        '&:hover': { bgcolor: '#eff6ff' },
                      }}
                    >
                      {option}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled sx={{ fontSize: '0.875rem', minHeight: 26, py: 0, borderRadius: 1.5 }}>
                    {menuOptions.length ? 'אין ערך קיים שמתחיל כך' : 'אין עדיין ערכים בעמודה הזו'}
                  </MenuItem>
                )}
              </Paper>
            </Popper>
          )}
        </Box>
      );
    };
    // עוטפים ב-JSX (לא מחזירים את הפונקציה עצמה) כדי שריאקט יתייחס לכל תא כרכיב
    // אמיתי עם fiber משלו - הכרחי כי יש כאן hooks (useState/useRef) בפנים. בלעדי זה
    // ריאקט "מבלבל" בין hooks של תאים שונים (בדיוק השגיאה "Rendered more hooks...")
    return (params) => <TextCell {...params} />;
  }, [updateCellValue]);

  // תא בוליאני חי (עמודת "הדפסה") - checkbox רגיל, בלי תלות במצב עריכה בכלל
  const renderBooleanCell = useCallback((params) => {
    const { id, field, value } = params;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => updateCellValue(id, field, event.target.checked)}
          onClick={(event) => event.stopPropagation()}
        />
      </Box>
    );
  }, [updateCellValue]);

    const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmedWord = inputValue.trim();
      
      if (trimmedWord && !activeFilters.includes(trimmedWord)) {
        setActiveFilters([...activeFilters, trimmedWord]);
      }
      setInputValue(''); 
    }
  };

  const handleRemoveChip = (chipToRemove) => {
    setActiveFilters(activeFilters.filter((c) => c !== chipToRemove));
  };

  const handleFullReset = () => {
    setActiveFilters([]);
    setInputValue('');
    setSortModel([]);
    setSecondarySortFields([]);
  };

  // שדות "פרטי אורח" בלבד (לא שדות מערכת/ביקורת כמו נוצר ע"י/שונה ע"י/מפתח) -
  // אלה השדות שהחיפוש המהיר אמור לבדוק, אחרת "מנחם" למשל היה תופס גם שורות
  // שרק "נוצר ע"י" מנחם, בלי שום קשר לתוכן האמיתי של השורה
  const searchableFieldNames = useMemo(
    () => fieldDefs.map((f) => f.technicalName),
    [fieldDefs]
  );

  // לוגיקת תת-הסינון והפילטור המשולב
  const filteredRows = useMemo(() => {
    const currentWord = inputValue.trim().toLowerCase();
    const allWords = [...activeFilters.map(f => f.toLowerCase())];
    if (currentWord) allWords.push(currentWord);

    if (allWords.length === 0) return rows;

    return rows.filter((row) => {
      return allWords.every((word) =>
        searchableFieldNames.some((field) => {
          const value = row[field];
          return value !== null && value !== undefined && String(value).toLowerCase().includes(word);
        })
      );
    });
  }, [rows, activeFilters, inputValue, searchableFieldNames]);

  // ref בנוסף למשתנה עצמו - כדי שאפקט "הקפיצה לתא הבעייתי" (ראו למטה) יוכל לקרוא
  // תמיד את השורות העדכניות ביותר, בלי להיות תלוי ב-filteredRows כ-dependency: אחרת
  // כל הקשה בכל שדה בטבלה (שמשנה rows ולכן filteredRows) הייתה מפעילה מחדש את
  // הקפיצה/פוקוס לבעיה הראשונה בתור - גם כשעורכים משהו אחר לגמרי, לא קשור לתיקונים
  const filteredRowsRef = useRef(filteredRows);
  useEffect(() => {
    filteredRowsRef.current = filteredRows;
  }, [filteredRows]);

  // גוללת אל תא בעייתי נתון וממקדת ישירות ב-input שבתוכו - פונקציה משותפת שנקראת
  // גם כש"תור התיקונים" משתנה מבחוץ (למשל נוצר מחדש בלחיצה על "שמור"), וגם ישירות
  // מ-Enter על שדה כלשהו (ר' handleFocusOut) - שם זה נחוץ גם אם התור עצמו לא השתנה
  // בפועל (Enter על שדה שלא היה בו תיקון בכלל, למשל שדה בשורה חדשה שמוסיפים)
  const jumpToProblem = (target) => {
    if (!target || !apiRef.current) return undefined;
    const rowIndex = filteredRowsRef.current.findIndex((row) => row.id === target.id);
    if (rowIndex === -1) return undefined;
    const colIndex = apiRef.current.getColumnIndex(target.field);
    apiRef.current.scrollToIndexes({ rowIndex, colIndex });
    // 300ms ולא 50 - כדי לוודא שזה קורה אחרי שאנימציית הסגירה של הפופ-אפ ("שמור בכל
    // זאת" / "לתקן עכשיו") מסתיימת לגמרי, אחרת הפופ-אפ "גונב" בחזרה את הפוקוס - מחזירה
    // את מזהה הטיימר כדי שקוראים במסגרת useEffect יוכלו לבטל אותו ב-cleanup אם צריך
    return setTimeout(() => {
      // אם בינתיים המשתמשת כבר הספיקה ללחוץ בעצמה על שדה אחר - לא גונבים ממנה את
      // הפוקוס בחזרה לתא הבעייתי
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT' && active !== document.body) return;
      const input = gridContainerRef.current?.querySelector(
        `[data-id="${target.id}"] [data-field="${target.field}"] input`
      );
      input?.focus();
    }, 300);
  };

 const requiredFields = useMemo(
    () => new Set(fieldDefs.filter((f) => f.isRequired).map((f) => f.technicalName)),
    [fieldDefs]
  );

  // "בעל" ו"אישה" הם לא שני שדות חובה נפרדים - מספיק שאחד מהם מלא. חסר נחשב בעיה
  // רק אם שניהם ריקים יחד. getFieldValue מביא את הערך של השדה השני (בעל/אישה) לפי
  // המקור הזמין בכל מקום שקוראים לזה (row מלא, או apiRef.getCellValue)
  const isRequiredEmpty = (field, value, getFieldValue) => {
    if (field === 'man' || field === 'woman') {
      if (!requiredFields.has('man') && !requiredFields.has('woman')) return false;
      const manVal = field === 'man' ? value : getFieldValue('man');
      const womanVal = field === 'woman' ? value : getFieldValue('woman');
      return !manVal && !womanVal;
    }
    return requiredFields.has(field) && !value;
  };

  // בדיקת מדינה/עיר מול ה-API החיצוני הוסרה - הרשימה שם רק באנגלית, בעוד הנתונים כאן
  // בעברית, כך שכל ערך אמיתי היה נפסל בטעות. נשארה רק בדיקת הפורמט של מספר בית.
  const isValueInvalid = (field, value) => {
    if (!value) return false;
    const text = String(value).trim();
    if (!text) return false;
    if (field === 'houseNo') return !HOUSE_NO_PATTERN.test(text);
    return false;
  };

  // ברמת שורה (editMode="row") השורה כולה נשארת פתוחה לעריכה עד שעוזבים אותה לגמרי -
  // כדי שהצביעה על שדה מסוים תיעלם ברגע שעוזבים אותו (גם עם העכבר, לא רק Enter/Tab),
  // מאזינים ישירות לאירוע focusout הטבעי של הדפדפן (לא תלוי באיך בדיוק עזבו את התא)
  // ובודקים מחדש רק את השדה הספציפי הזה שאיבד פוקוס
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container || problemQueue.length === 0) return undefined;

    const handleFocusOut = (event) => {
      const cellEl = event.target.closest('.MuiDataGrid-cell');
      if (!cellEl) return;
      const field = cellEl.getAttribute('data-field');
      const rowEl = cellEl.closest('.MuiDataGrid-row');
      const id = rowEl ? rowEl.getAttribute('data-id') : null;
      if (!id || !field) return;

      // ה-blur() הזה נגרם ע"י Enter או ע"י משהו אחר (לחיצת עכבר על שדה אחר וכו')?
      // נקרא ומיד מתאפס - שייך רק ל-blur הנוכחי הזה, לא ידלוף להבא
      const wasEnter = blurredViaEnterRef.current;
      blurredViaEnterRef.current = false;

      // ה-DataGrid מעדכן את הערך בפועל רק אחרי שה-focusout מסתיים. הבדיקה קורית
      // רק כשעוזבים את השדה (לא בכל הקשה) - כדי לא לקפוץ לתא הבא באמצע הקלדה,
      // רק אחרי שבאמת סיימו לערוך אותו
      setTimeout(() => {
        const value = apiRef.current.getCellValue(id, field);
        const stillInvalid =
          isRequiredEmpty(field, value, (f) => apiRef.current.getCellValue(id, f)) ||
          isValueInvalid(field, value);
        if (stillInvalid) return;

        // עוזבים שדה מהזוג "בעל"/"אישה" כשהוא כבר לא בעיה (העדכון החי כבר וידא שזה
        // נבדק נכון) - מוציאים מהתור גם את השדה השני מהזוג, לא רק את זה שעזבנו,
        // אחרת הקפיצה הבאה עדיין הייתה מוצאת אותו ומדגישה אותו בטעות
        const prev = problemQueueRef.current;
        const remaining = prev.filter((p) => {
          if (String(p.id) !== String(id)) return true;
          if (p.field === field) return false;
          if ((field === 'man' || field === 'woman') && (p.field === 'man' || p.field === 'woman')) return false;
          return true;
        });

        if (remaining.length !== prev.length) {
          // התור באמת השתנה (תא תוקן) - מעדכנים אותו, ומדכאים את הקפיצה האוטומטית
          // של האפקט למטה: הקפיצה עצמה מטופלת כאן ישירות, רק כשיצאו עם Enter
          suppressNextJumpRef.current = true;
          if (remaining.length === 0 && prev.length > 0) {
            onSave(rowsRef.current);
          }
          setProblemQueue(remaining);
        }

        // Enter תמיד קופץ לתיקון הראשון שנשאר בתור - גם אם השדה שעזבו לא היה בכלל
        // חלק מהתיקונים (למשל שדה בשורה חדשה שמוסיפים תוך כדי שיש תיקונים ממתינים).
        // לחיצת עכבר על שדה אחר לא קופצת בכלל, נותנת לערוך בשקט
        if (wasEnter && remaining.length > 0) {
          jumpToProblem(remaining[0]);
        }
      }, 0);
    };

    container.addEventListener('focusout', handleFocusOut);
    return () => container.removeEventListener('focusout', handleFocusOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemQueue, requiredFields]);

  const orderedFieldDefs = useMemo(
      () =>
          fieldDefs
              .slice()
              .sort((a, b) => (a.defaultOrder ?? 999) - (b.defaultOrder ?? 999)),
      [fieldDefs]
  );
  const orderedFieldNames = useMemo(() => orderedFieldDefs.map((f) => f.technicalName), [orderedFieldDefs]);

  // הסדר החזותי בפועל של העמודות בטבלה: בפעם הראשונה - הסדר שהמשתמשת שמרה בעבר
  // (columnPreferences.__order), אם יש כזה, אחרת ברירת המחדל (orderedFieldNames).
  // מהפעם השנייה ואילך columnOrder (מה-state) גובר. משמש רק לבניית columns למטה -
  // לא נוגע בסדר שמשמש את "קפיצה לתא הבעייתי הבא" או את רשימת הבחירה בתיבת המיון,
  // כדי לא לשנות התנהגות קיימת של תכונות אחרות
  useEffect(() => {
    if (orderedFieldNames.length === 0) return;
    setColumnOrder((prev) => {
      const base = prev ?? columnPreferences?.__order ?? orderedFieldNames;
      const stillValid = base.filter((f) => orderedFieldNames.includes(f));
      const missing = orderedFieldNames.filter((f) => !stillValid.includes(f));
      if (prev && stillValid.length === prev.length && missing.length === 0) return prev;
      return [...stillValid, ...missing];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedFieldNames]);

  const displayFieldDefs = useMemo(() => {
    if (!columnOrder) return orderedFieldDefs;
    return columnOrder
      .map((name) => fieldDefs.find((f) => f.technicalName === name))
      .filter(Boolean);
  }, [columnOrder, fieldDefs, orderedFieldDefs]);

  // חץ המיון בכותרת: אם העמודה כבר המיון הראשי - מחזור רגיל (עולה -> יורד -> בטל).
  // אחרת, אותה לוגיקה בדיוק כמו בחירה מתיבת "מיון" (ר' handleAddSortField למטה) -
  // אם אין עדיין מיון ראשי זה הופך להיות הוא, אחרת מצטרף כתת-מיון (שובר שוויון)
  const handleHeaderSortClick = (field) => {
    if (sortModel[0]?.field === field) {
      setSortModel(sortModel[0].sort === 'asc' ? [{ field, sort: 'desc' }] : []);
      return;
    }
    handleAddSortField(field);
  };

  // גרירת עמודה לסידור מחדש - תנועה אחת רציפה (לוחצים, גוררים בלי לשחרר, משחררים
  // ביעד), בלי שלב "בחירה" נפרד קודם. לחיצה בלי תזוזה ממשית (מעל סף קטן) לא נחשבת
  // גרירה בכלל, כדי שקליק רגיל על הכותרת לא יזיז שום דבר בטעות.
  // מחוברת פעם אחת בלבד (useEffect עם [] תלות, ר' למטה) ישירות ל-document, ולא דרך
  // onMouseDown על הכותרת המותאמת אישית עצמה - כי כותרות ה-DataGrid מתחדשות (renderHeader
  // נקרא מחדש) בכל שינוי state, ולפעמים ה-listener על הכותרת לא הספיק להתחבר מחדש
  // בזמן ללחיצה הבאה, מה שגרם לפעמים שגרירה לא נתפסה בכלל
  const orderedFieldNamesRef = useRef(orderedFieldNames);
  useEffect(() => {
    orderedFieldNamesRef.current = orderedFieldNames;
  }, [orderedFieldNames]);

  useEffect(() => {
    const DRAG_MOVE_THRESHOLD_PX = 6;

    const handleGlobalMouseDown = (event) => {
      // תופסים את כל תא הכותרת כברירת מחדל לגרירה (לא רק את הטקסט של השם) - כדי לא
      // להיתקל בבעיות חפיפה עדינות בין רכיבים פנימיים של הרשת (למשל קו ההרחבה, שיש
      // לו z-index גבוה מאוד ברירת מחדל, MUI) - ומוציאים מזה במפורש רק את הבקרות
      // הידועות שכן צריכות להתנהג אחרת: חץ המיון, תפריט העמודה, וקו ההרחבה עצמו
      const headerEl = event.target.closest ? event.target.closest('.MuiDataGrid-columnHeader[data-field]') : null;
      if (!headerEl) return;
      const isExcluded = event.target.closest(
        '[data-sort-icon="true"], .MuiDataGrid-menuIcon, .MuiDataGrid-columnSeparator, .MuiDataGrid-checkboxInput'
      );
      if (isExcluded) return;
      const field = headerEl.getAttribute('data-field');
      if (!field) return;

      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      dragTrackingRef.current = { field, startX, startY, moved: false };

      const handleMouseMove = (moveEvent) => {
        const tracking = dragTrackingRef.current;
        if (!tracking || tracking.moved) return;
        const dx = moveEvent.clientX - tracking.startX;
        const dy = moveEvent.clientY - tracking.startY;
        if (Math.abs(dx) > DRAG_MOVE_THRESHOLD_PX || Math.abs(dy) > DRAG_MOVE_THRESHOLD_PX) {
          tracking.moved = true;
          setDragArmedField(field);
        }
      };

      const handleMouseUp = (upEvent) => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        const tracking = dragTrackingRef.current;
        dragTrackingRef.current = null;
        setDragArmedField(null);
        if (!tracking || !tracking.moved) return; // לחיצה רגילה, לא גרירה בפועל - לא מזיזים כלום

        const sourceField = tracking.field;
        const targetEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const targetHeaderEl = targetEl?.closest('.MuiDataGrid-columnHeader');
        const targetField = targetHeaderEl?.getAttribute('data-field');
        if (!targetField || sourceField === targetField) return;

        // איפה בדיוק שחררו את העמודה ביחס לעמודת היעד קובע אם להכניס לפניה או אחריה -
        // כדי שאפשר יהיה להזיז לשני הכיוונים (כולל "להחזיר אחורה" עמודה שכבר הוזזה),
        // לא רק "תמיד לפני"
        const targetRect = targetHeaderEl.getBoundingClientRect();
        const dropInRightHalf = upEvent.clientX > targetRect.left + targetRect.width / 2;

        setColumnOrder((prev) => {
          const base = prev ?? orderedFieldNamesRef.current;
          const withoutSource = base.filter((f) => f !== sourceField);
          const targetIndex = withoutSource.indexOf(targetField);
          if (targetIndex === -1) return base;
          const insertIndex = dropInRightHalf ? targetIndex : targetIndex + 1;
          const newOrder = [...withoutSource.slice(0, insertIndex), sourceField, ...withoutSource.slice(insertIndex)];
          onColumnOrderChangeRef.current?.(newOrder);
          return newOrder;
        });
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // הרחבה/הצרה של עמודה - גוררים את הקו הדק שבצד העמודה. מתחילים מהרוחב האמיתי
  // הנוכחי (נקרא מה-DOM בפעם הראשונה, כי עד עכשיו הרוחב נקבע לפי flex ולא נשמר במקום
  // אחר) כדי שההרחבה הראשונה לא "תקפוץ" לרוחב אחר בטעות
  const handleResizeStart = (event, field) => {
    event.preventDefault();
    event.stopPropagation();
    const startWidth =
      columnWidths[field] ??
      document.querySelector(`.MuiDataGrid-columnHeader[data-field="${field}"]`)?.getBoundingClientRect().width ??
      120;
    resizingRef.current = { field, startX: event.clientX, startWidth };

    const handleMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const { field: f, startX, startWidth: sw } = resizingRef.current;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(60, sw - delta);
      setColumnWidths((prev) => ({ ...prev, [f]: newWidth }));
    };
    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // מחברים את ההרחבה לקו ההפרדה המובנה של הרשת עצמה (בין כותרות העמודות) - הוא
  // כבר ממוקם נכון בדיוק על הקו שרואים על המסך, בניגוד לניסיון קודם לבנות ידית
  // הרחבה עצמאית בתוך הכותרת המותאמת אישית, שיצא במיקום לא מדויק. columnSeparatorMouseDown
  // הוא אירוע פנימי שה-DataGrid כבר מפרסם על כל לחיצה על הקו הזה, גם בגרסה החינמית
  useEffect(() => {
    if (!apiRef.current?.subscribeEvent) return;
    return apiRef.current.subscribeEvent('columnSeparatorMouseDown', (params, event) => {
      handleResizeStart(event, params.field);
    });
    // תלוי רק בטעינה הראשונית - handleResizeStart תמיד קורא את הרוחב העדכני בפועל
    // מה-DOM (לא סוגר על ערך ישן), אז אין צורך לחבר מחדש בכל שינוי columnWidths
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // סורקת את כל השורות (לפי סדר השורות והעמודות בטבלה) ומחזירה רשימה מסודרת של
  // תאים שצריך לתקן - שדות חובה ריקים או ערכים לא תקינים - כדי לדעת לאיזה תא לקפוץ קודם
  const findProblemCells = (rowsToCheck) => {
    const problems = [];
    rowsToCheck.forEach((row) => {
      orderedFieldNames.forEach((field) => {
        const value = row[field];
        const requiredEmpty = isRequiredEmpty(field, value, (f) => row[f]);
        if (requiredEmpty || isValueInvalid(field, value)) {
          problems.push({ id: row.id, field });
        }
      });
    });
    return problems;
  };

  // סיכום קבוע לתחתית המסך - כמה שורות בסה"כ וכמה מהן דורשות תיקון כרגע,
  // לא רק בזמן תהליך הקפיצה האוטומטית אחרי לחיצה על "שמור"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allProblems = useMemo(() => findProblemCells(rows), [rows, requiredFields, orderedFieldNames]);
  const problemRowCount = useMemo(
    () => new Set(allProblems.map((p) => p.id)).size,
    [allProblems]
  );

  const columns = useMemo(() => {
    const dynamicColumns = displayFieldDefs.map((f) => {
      const isBoolean = f.technicalName === 'print';
      const pickListField = ['prefix', 'suffix', 'belongsTo'].includes(f.technicalName)
        ? f.technicalName
        : null;
      const showRequiredMark =
        f.isRequired ||
        ((f.technicalName === 'man' || f.technicalName === 'woman') &&
          (requiredFields.has('man') || requiredFields.has('woman')));
      const headerName = showRequiredMark ? `${f.displayName} *` : f.displayName;
      const customWidth = columnWidths[f.technicalName];
      return {
        field: f.technicalName,
        headerName,
        // flex במקום width קבוע - כל העמודות מתחלקות ברוחב שיש בפועל, כדי שהטבלה
        // תמיד תיכנס בלי גלילה אופקית (בשילוב עם עטיפת שורות במקום חיתוך טקסט) -
        // אלא אם המשתמשת הרחיבה/הצרה את העמודה הזו ידנית, ואז width מפורש גובר
        flex: customWidth ? undefined : (isBoolean ? 0.6 : 1),
        width: customWidth,
        minWidth: isBoolean ? 70 : 90,
        // העריכה עצמה מתבצעת דרך קלט חי בתוך renderCell (ראו renderTextCell/
        // renderBooleanCell/renderAddressCell) ולא דרך מצב העריכה של ה-DataGrid -
        // editable נשאר false בכוונה כדי שדאבל-קליק לא ינסה גם לפתוח את עורך ברירת
        // המחדל של הרשת מעל הקלט המותאם אישית שלנו
        editable: false,
        type: isBoolean ? 'boolean' : undefined,
        renderCell: isBoolean
          ? renderBooleanCell
          : ADDRESS_FIELDS.includes(f.technicalName)
          ? renderAddressCell
          : renderTextCell(pickListField),
        sortComparator: isBoolean ? undefined : createTextSortComparator(f.technicalName, secondarySortFields),
        // מיון קורה רק דרך חץ המיון הביתי (renderHeader למטה), לא בכל לחיצה על הכותרת
        sortable: false,
        renderHeader: () => (
          <ColumnHeader
            field={f.technicalName}
            headerName={headerName}
            sortDirection={sortModel[0]?.field === f.technicalName ? sortModel[0].sort : null}
            onSortClick={handleHeaderSortClick}
            isDragArmed={dragArmedField === f.technicalName}
          />
        ),
      };
    });

    return [...dynamicColumns, ...systemColumns];
    // handleHeaderSortClick תלוי רק ב-sortModel, שכבר ברשימת התלויות למטה - אין צורך
    // לחשב מחדש את כל העמודות בכל רינדור רק כי הפונקציה עצמה נוצרת מחדש בכל פעם
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayFieldDefs, renderAddressCell, renderBooleanCell, renderTextCell, secondarySortFields, requiredFields, columnWidths, sortModel, dragArmedField]);

  // אותה תיבת בחירה משמשת גם למיון הראשי וגם לתתי-המיון: אם עוד אין מיון ראשי (לא
  // לחצו על החץ בכותרת עמודה), הבחירה הראשונה כאן הופכת להיות המיון הראשי עצמו;
  // מהבחירה השנייה ואילך זה ממשיך כתת-מיון (שובר שוויון), כמו קודם
  const handleAddSortField = (field) => {
    if (!field) return;
    if (sortModel.length === 0) {
      setSortModel([{ field, sort: 'asc' }]);
      return;
    }
    if (field === sortModel[0]?.field || secondarySortFields.includes(field)) return;
    setSecondarySortFields((prev) => [...prev, field]);
  };

  const handleRemovePrimarySort = () => {
    setSortModel([]);
  };

  const handleRemoveSecondarySort = (field) => {
    setSecondarySortFields((prev) => prev.filter((f) => f !== field));
  };

  // ה-DataGrid לא מחשב מחדש את סדר השורות אם רק ה-sortComparator של העמודה השתנה בזמן
  // שה-sortModel עצמו (עמודת המיון הראשית) נשאר זהה - אז כשתת-המיון משתנה, "דוחפים"
  // מחדש את אותו sortModel (מערך חדש עם אותו תוכן) כדי לגרום לו לחשב מחדש בפועל
  useEffect(() => {
    setSortModel((prev) => (prev.length ? [...prev] : prev));
  }, [secondarySortFields]);

  // שדות עם סדר תצוגה 0 (או ללא סדר) מוסתרים כברירת מחדל, לפי ההגדרה ב-excel_columns
  const [columnVisibilityModel, setColumnVisibilityModel] = useState(SYSTEM_FIELDS_HIDDEN_BY_DEFAULT);

  useEffect(() => {
    if (fieldDefs.length === 0) return;
    const model = { ...SYSTEM_FIELDS_HIDDEN_BY_DEFAULT };
    fieldDefs.forEach((f) => {
      // העדפה אישית של המשתמשת (ניהול עמודות) גוברת על ברירת המחדל אם קיימת
      const userChoice = columnPreferences?.[f.technicalName]?.show;
      model[f.technicalName] = userChoice !== undefined ? userChoice : Boolean(f.defaultOrder);
    });
    setColumnVisibilityModel(model);
  }, [fieldDefs, columnPreferences]);

  // בכל פעם שתור התיקונים מתעדכן (שמירה נחסמה, או שתוקן תא אחד וקפצנו לבא) -
  // גוללים אל התא הראשון בתור וממקדים ישירות ב-input שבתוכו (התאים הם קלטים חיים
  // תמיד, לא מסתמכים על מצב עריכה של ה-DataGrid, אז אין צורך "לפתוח" עריכה בכלל)
  useEffect(() => {
    // חייב להתאפס תמיד בכל הרצה של האפקט הזה (גם אם התור יצא ריק לגמרי הפעם) - אחרת
    // אם התור התרוקן בדיוק בפעם שדוכאה קפיצה (למשל לחיצת עכבר, לא Enter), הדגל היה
    // נשאר "תקוע" true ומדכא בטעות גם את הקפיצה הבאה האמיתית (למשל אחרי Enter אמיתי).
    // handleFocusOut כבר מטפל בעצמו בקפיצה (jumpToProblem) כשיוצאים עם Enter - האפקט
    // הזה אחראי רק על המקרה שהתור מתעדכן מבחוץ (בעיקר בלחיצה על "שמור")
    const shouldSuppress = suppressNextJumpRef.current;
    suppressNextJumpRef.current = false;
    if (problemQueue.length === 0 || !apiRef.current || shouldSuppress) return undefined;
    const timer = jumpToProblem(problemQueue[0]);
    return () => clearTimeout(timer);
    // תלוי רק ב-problemQueue בכוונה (לא ב-filteredRows/rows) - אחרת כל הקשה בכל שדה
    // בטבלה (גם בשדה שלא קשור לתיקונים בכלל) הייתה מפעילה מחדש את הקפיצה/פוקוס
    // לתא הבעייתי הראשון, וגונבת פוקוס ממי שרצה לערוך משהו אחר תוך כדי שיש תיקונים
    // ממתינים - עכשיו הקפיצה קורית רק כשתור התיקונים עצמו באמת משתנה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemQueue]);

  return (
    <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        height: '100%',
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        boxShadow: 'none',
        bgcolor: '#f7f8fc',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.75,
          borderBottom: '1px solid #eef0f3',
          background: '#f7f8fc',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {profileMenu}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: '#0f172a', whiteSpace: 'nowrap' }}>
            ניהול רשימת מוזמנים
          </Typography>

          <TextField
            label="הקלידי ערך ולחצי Enter לנעילת סינון/פילטור..."
            size="small"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            sx={{
              width: 150,
              bgcolor: '#ffffff',
              '& .MuiOutlinedInput-root': { borderRadius: 2, height: '25px' },
              '& .MuiOutlinedInput-input': { padding: '4px 8px', boxSizing: 'border-box', height: '100%', fontSize: '0.75rem', fontWeight: 600 },
              '& .MuiInputLabel-root': { fontSize: '0.72rem' },
              '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': { top: '50%', transform: 'translate(14px, -50%) scale(1)' },
            }}
          />

          {/* תגיות סינון פעילות + איפוס - ליד תיבת החיפוש עצמה */}
          {activeFilters.map((filter, index) => (
            <Chip
              key={index}
              label={filter}
              onDelete={() => handleRemoveChip(filter)}
              color="primary"
              variant="outlined"
              size="small"
            />
          ))}

          {(activeFilters.length > 0 || inputValue.trim() !== '' || sortModel.length > 0 || secondarySortFields.length > 0) && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleFullReset}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: '#ffffff',
                color: '#1e293b',
                borderColor: '#60a5fa',
                whiteSpace: 'nowrap',
                py: 0.15,
                px: 1,
                fontSize: '0.75rem',
                '&:hover': { bgcolor: '#eff6ff', borderColor: '#60a5fa' },
              }}
            >
              בטל סינון/מיון
            </Button>
          )}

          {/* תיבת מיון אחת לכול: אם עוד אין מיון ראשי, הבחירה כאן קובעת אותו ישירות -
              בלי צורך ללחוץ קודם על החץ בכותרת של עמודה. ברגע שיש מיון ראשי (מכאן או
              מלחיצה על עמודה), אותה תיבה ממשיכה לשמש לתתי-מיון (שובר שוויון), לפי סדר
              הבחירה, ואפשר להוסיף כמה שרוצים */}
          <TextField
            select
            label={sortModel.length === 0 ? 'מיון' : 'תת-מיון'}
            size="small"
            value=""
            onChange={(e) => handleAddSortField(e.target.value)}
            sx={{
              width: 80,
              bgcolor: '#ffffff',
              '& .MuiOutlinedInput-root': { borderRadius: 2, height: '25px' },
              '& .MuiOutlinedInput-input': { padding: '4px 8px', boxSizing: 'border-box', height: '100%', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 },
              '& .MuiInputLabel-root': { fontSize: '0.72rem' },
              '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': { top: '50%', transform: 'translate(14px, -50%) scale(1)' },
            }}
          >
            {orderedFieldDefs
              .filter((f) => f.technicalName !== sortModel[0]?.field && !secondarySortFields.includes(f.technicalName))
              .map((f) => (
                <MenuItem key={f.technicalName} value={f.technicalName}>
                  {f.displayName}
                </MenuItem>
              ))}
          </TextField>

          {sortModel.length > 0 && (() => {
            const def = orderedFieldDefs.find((f) => f.technicalName === sortModel[0].field);
            return (
              <Chip
                label={`מיון: ${def ? def.displayName : sortModel[0].field}`}
                onDelete={handleRemovePrimarySort}
                color="primary"
                variant="outlined"
                size="small"
              />
            );
          })()}

          {secondarySortFields.map((field, index) => {
            const def = orderedFieldDefs.find((f) => f.technicalName === field);
            return (
              <Chip
                key={field}
                label={`${index + 1}. ${def ? def.displayName : field}`}
                onDelete={() => handleRemoveSecondarySort(field)}
                color="primary"
                variant="outlined"
                size="small"
              />
            );
          })}
        </Box>

        <Stack direction="row" spacing={1}>
          <ExcelImport onImport={onImport} />

          <Button
            variant="outlined"
            size="small"
            onClick={(event) => setExportMenuAnchor(event.currentTarget)}
            endIcon={<ArrowDropDownIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#ffffff',
              color: '#1e293b',
              borderColor: '#60a5fa',
              py: 0.15,
              px: 1,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: '#eff6ff', borderColor: '#60a5fa' },
            }}
          >
            יצוא
          </Button>

          <Button
            variant="outlined"
            size="small"
            onClick={handleAddRow}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#ffffff',
              color: '#1e293b',
              borderColor: '#60a5fa',
              whiteSpace: 'nowrap',
              py: 0.15,
              px: 1,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: '#eff6ff', borderColor: '#60a5fa' },
            }}
          >
            הוסף שורה
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSaveClick}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#ffffff',
              color: '#1e293b',
              borderColor: '#60a5fa',
              whiteSpace: 'nowrap',
              py: 0.15,
              px: 1,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: '#eff6ff', borderColor: '#60a5fa' },
            }}
          >
            שמור את כל המוזמנים
          </Button>
        </Stack>
      </Box>

   <Box ref={gridContainerRef} sx={{ px: 1.5, pb: 1, pt: 0.75, maxWidth: '100%', position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

   <DataGrid
        apiRef={apiRef}
        rows={filteredRows}
        getRowId={(row) => row.hashCode ?? row.id}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        disableColumnReorder
        density="compact"
        rowHeight={32}
        columnHeaderHeight={40}
        getCellClassName={(params) => {
          // התא שעליו נלחץ קליק ימני (בזמן שתפריט "העבר להערת כתובת" פתוח) - מודגש
          // כדי שיהיה ברור על איזה ערך מדובר. יורד אוטומטית כשהתפריט נסגר (contextMenu
          // חוזר ל-null), לא תלוי בכלל בתור התיקונים למטה
          if (
            contextMenu &&
            String(params.id) === String(contextMenu.id) &&
            params.field === contextMenu.field
          ) {
            return 'context-menu-target-cell';
          }

          // צביעה בכלל לא קורית לפני שהיה ניסיון שמירה שנחסם - שורה חדשה/ריקה לא נצבעת
          // מיד, רק אחרי שלוחצים "שמור את כל המוזמנים" ונמצאות בעיות בפועל
          if (problemQueue.length === 0) return '';

          // התא הספציפי שקפצנו אליו כרגע (הראשון בתור התיקונים) - מודגש הרבה יותר חזק
          // מכל שאר תאי הבעיה, כדי שיהיה ברור בבירור לאיפה קפצו
          if (
            String(params.id) === String(problemQueue[0].id) &&
            params.field === problemQueue[0].field
          ) {
            return 'current-problem-cell';
          }
          if (isRequiredEmpty(params.field, params.value, (f) => params.row[f])) return 'required-empty-cell';
          if (isValueInvalid(params.field, params.value)) return 'invalid-value-cell';
          return '';
        }}
        sx={{
          border: 'none',
          borderRadius: 2,
          flex: 1,
          minHeight: 0,
          fontSize: '0.875rem',
          fontFamily: '"Rubik", "Segoe UI", Arial, sans-serif',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#f8fafc',
            borderBottom: '2px solid #e2e8f0',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
            color: '#4b5563',
            fontFamily: '"Rubik", "Segoe UI", Arial, sans-serif',
            letterSpacing: '0.01em',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #f1f5f9',
          },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-row': {
            transition: 'background-color 0.15s ease',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: '#f8fafc',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '2px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          },
          // סמן עכבר של הרחבה (חץ כפול) על קו ההפרדה בין העמודות - נכפה ידנית כי
          // הסימון המובנה של הרכיב לא תמיד נדלק אוטומטית בהגדרה המותאמת אישית שלנו
          '& .MuiDataGrid-columnSeparator': {
            cursor: 'col-resize',
          },
          // בעמודות צרות (אחרי גרירה לסידור מחדש) האייקון של קו ההפרדה יכול לחפוף
          // חזותית לכותרת המותאמת אישית שלנו ולגנוב ממנה קליקים (לחיצה על הכותרת
          // הייתה "נופלת" על קו ההפרדה במקום על שם העמודה) - מעלים את מיכל הכותרת
          // מעל קו ההפרדה, שהוא אח (sibling) שלו ברמת ה-DOM, לא רק צאצא שלנו
          // אייקון קו ההפרדה (לא הקו עצמו, רק הצייור הקטן שבתוכו) לא אמור "לתפוס"
          // קליקים בכלל - הוא רק חזותי. הקליק על קו ההפרדה עצמו ממשיך לעבוד רגיל
          // (הרוחב שלו נשאר תקין), רק האייקון החופף לפעמים לכותרת בעמודות צרות
          // מפסיק לחטוף קליקים שמיועדים לשם העמודה
          '& .MuiDataGrid-iconSeparator': {
            pointerEvents: 'none',
          },
          '& .MuiDataGrid-columnHeaderDraggableContainer': {
            position: 'relative',
            zIndex: 101, // הקו של MUI עצמו z-index:100 - חייבים לעבור אותו
          },
          '& .required-empty-cell': {
            backgroundColor: '#fdecea !important',
            outline: '1.5px solid #e57373',
            outlineOffset: '-1.5px',
            borderRadius: '6px',
          },
          '& .invalid-value-cell': {
            backgroundColor: '#fef3e2 !important',
            outline: '1.5px solid #f0a860',
            outlineOffset: '-1.5px',
            borderRadius: '6px',
          },
          '& .context-menu-target-cell': {
            backgroundColor: '#eff6ff !important',
          },
          '& .current-problem-cell': {
            backgroundColor: '#ffe4e8 !important',
            outline: '2px solid #e11d48',
            outlineOffset: '-2px',
            borderRadius: '7px',
            fontWeight: 700,
            animation: 'current-problem-pulse 1.4s ease-in-out infinite',
          },
          '@keyframes current-problem-pulse': {
            '0%, 100%': { boxShadow: '0 0 0 4px rgba(225, 29, 72, 0.30)' },
            '50%': { boxShadow: '0 0 0 9px rgba(225, 29, 72, 0.06)' },
          },
        }}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={(model) => setColumnVisibilityModel(model)}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
        pageSizeOptions={[25, 50, 100]}
        localeText={{
          toolbarLabel: 'כלים',
          toolbarDensityLabel: 'צפיפות',
          toolbarDensityCompact: 'קומפקטי',
          toolbarDensityStandard: 'רגיל',
          toolbarDensityComfortable: 'נוח',
          toolbarColumns: 'עמודות',
          toolbarColumnsLabel: 'בחר עמודות',
          toolbarFilters: 'סנן',
          toolbarFiltersLabel: 'הראה מסננים',
          toolbarFiltersTooltipHide: 'הסתר מסננים',
          toolbarFiltersTooltipShow: 'הראה מסננים',
          toolbarQuickFilterPlaceholder: 'חיפוש...',
            noRowsLabel: 'לא נמצאו תוצאות',
            noResultsOverlayLabel: 'לא נמצאו תוצאות',
          toolbarExport: 'ייצוא',
          toolbarExportLabel: 'ייצוא',
          toolbarExportCSV: 'הורדה כ־CSV',
          toolbarExportPrint: 'הדפסה',
          columnHeaderFiltersTooltipActive: (count) => `מסננים פעילים: ${count}`,
          columnHeaderFiltersLabel: 'סנן',
          columnHeaderSortIconTooltip: 'מיין',
          columnHeaderSortIconDescription: 'מיין',
          booleanCellTrueLabel: 'כן',
          booleanCellFalseLabel: 'לא',
          columnMenuLabel: 'תפריט',
          columnMenuShowColumns: 'הראה עמודות',
          columnMenuHideColumn: 'הסתר',
          columnMenuUnsort: 'בטל מיון',
          columnMenuSort: 'מיין',
          columnMenuFilter: 'סנן',
          columnMenuManageColumns: 'ניהול עמודות',
          footerTotalRows: 'סה"כ שורות:',
          footerTotalVisibleRows: (visibleCount, totalCount) => `${visibleCount.toLocaleString()} מתוך ${totalCount.toLocaleString()}`,
          filterOperatorContains: 'מכיל',
          filterOperatorEquals: 'שווה',
          filterOperatorStartsWith: 'מתחיל ב',
          filterOperatorEndsWith: 'מסתיים ב',
          filterOperatorIs: 'הוא',
          filterOperatorNot: 'אינו',
          filterOperatorAfter: 'אחרי',
          filterOperatorOnOrAfter: 'בתאריך או אחריו',
          filterOperatorBefore: 'לפני',
          filterOperatorOnOrBefore: 'בתאריך או לפניו',
          filterOperatorIsEmpty: 'ריק',
          filterOperatorIsNotEmpty: 'לא ריק',
          filterOperatorIsAnyOf: 'הוא אחד מ',
          filterValueAny: 'כל אחד',
          filterValueTrue: 'כן',
          filterValueFalse: 'לא',
          columnPinningLeftAriaLabel: 'עמודה מוצמדת לשמאל',
          columnPinningRightAriaLabel: 'עמודה מוצמדת לימין',
          rowGroupingHeaderName: 'קבוצה',
          detailPanelExpandAriaLabel: 'הרחב',
          detailPanelCollapseAriaLabel: 'כווץ',
          pinnedToLeft: 'מוצמד לשמאל',
          pinnedToRight: 'מוצמד לימין',
          unpin: 'בטל הצמדה',
        }}
        editMode="row"
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={(newSelectionModel) => {
          setSelectionModel(newSelectionModel);
          const fullSelectedRows = rows.filter((row) => newSelectionModel.includes(row.id));
          onSelectionChange(fullSelectedRows);
        }}
        sortModel={sortModel}
        onSortModelChange={(model) => setSortModel(model)}
      />
      {hoveredRow && (
        <IconButton
          data-row-delete-icon="true"
          size="small"
          title="מחק שורה"
          onClick={() => handleDeleteSingleRow(hoveredRow.id)}
          sx={{
            position: 'absolute',
            top: hoveredRow.top + hoveredRow.height / 2 - 16,
            // 4 מספיק כשאין פס גלילה באזור הזה - עכשיו שהטבלה גוללת בתוך עצמה יש שם
            // גם פס גלילה אנכי, וצריך מרווח גדול יותר כדי שהאייקון לא יתנגש איתו
            insetInlineEnd: 22,
            zIndex: 5,
            bgcolor: 'transparent',
            boxShadow: 'none',
            '&:hover': { bgcolor: 'transparent' },
            '&:hover .row-delete-icon-svg': { color: '#ef4444' },
          }}
        >
          <DeleteOutlineIcon className="row-delete-icon-svg" fontSize="small" sx={{ color: '#94a3b8', transition: 'color 0.15s' }} />
        </IconButton>
      )}
   </Box>

      <Menu
        open={exportMenuAnchor !== null}
        anchorEl={exportMenuAnchor}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={handlePrintLabels} sx={{ gap: 1, py: 0.5, px: 1.25, fontSize: '0.75rem', fontWeight: 600, minHeight: 'unset' }}>
          <LocalPrintshopOutlinedIcon sx={{ color: '#475569', fontSize: '1rem' }} />
          הדפסת מדבקות
        </MenuItem>
        <MenuItem onClick={handleDownloadExcel} sx={{ gap: 1, py: 0.5, px: 1.25, fontSize: '0.75rem', fontWeight: 600, minHeight: 'unset' }}>
          <FileDownloadOutlinedIcon sx={{ color: '#475569', fontSize: '1rem' }} />
          הורדת קובץ אקסל למחשב
        </MenuItem>
      </Menu>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        transitionDuration={0}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
            minWidth: 'unset',
            bgcolor: '#eff6ff',
            border: '1px solid #93c5fd',
            overflow: 'hidden',
          },
        }}
        MenuListProps={{ sx: { py: 0 } }}
      >
        {contextMenu?.field === 'addressNote' ? (
          (() => {
            const row = rows.find((r) => String(r.id) === String(contextMenu.id));
            const tags = parseAddressNoteTags(row?.addressNoteSources, fieldDefs);
            if (tags.length === 0) {
              return (
                <MenuItem disabled sx={{ py: 0.5, px: 1, fontSize: '0.78rem', minHeight: 'unset' }}>
                  אין ערכים להחזיר
                </MenuItem>
              );
            }
            return tags.map((tag, index) => (
              <MenuItem
                key={`${tag.field}-${tag.value}-${index}`}
                onClick={() => handleReturnFromAddressNote(tag)}
                sx={{ py: 0.5, px: 1, fontSize: '0.78rem', minHeight: 'unset' }}
              >
                {`החזר ל${tag.label}`}
              </MenuItem>
            ));
          })()
        ) : (
          <MenuItem
            onClick={handleMoveToAddressNote}
            sx={{ py: 0.5, px: 1, fontSize: '0.78rem', minHeight: 'unset' }}
          >
            העבר להערת כתובת
          </MenuItem>
        )}
      </Menu>

      {/* disableRestoreFocus - בלי זה ה-Dialog "מחזיר" את הפוקוס לכפתור השמירה אחרי
          שהוא נסגר, וזה מתנגש עם הקפיצה האוטומטית לתא הבעייתי שקורית באותו רגע בדיוק */}
      <Dialog open={saveAnywayDialogOpen} onClose={handleFixProblemsNow} disableRestoreFocus>
        <DialogTitle>יש שדות שגויים או חסרים</DialogTitle>
        <DialogContent>
          <DialogContentText>
            נמצאו {pendingProblems.length} שדות שדורשים תיקון (חובה שריקים או ערכים לא תקינים).
            אפשר לתקן אותם עכשיו, או לשמור בכל זאת כמו שהטבלה נמצאת עכשיו.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFixProblemsNow} color="primary">
            לתקן עכשיו
          </Button>
          <Button onClick={handleSaveAnyway} color="error" variant="contained">
            שמור בכל זאת
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>

      {/* שורת בחירה - צפה מעל הכותרת, לא דוחפת את הטבלה למטה כשהיא נפתחת/נסגרת */}
      {selectionModel.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1,
            bgcolor: '#ffffff',
            borderRadius: 999,
            border: '1px solid #e6e8ec',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
          }}
        >
          <IconButton size="small" onClick={() => { setSelectionModel([]); onSelectionChange([]); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
            {selectionModel.length} נבחרו
          </Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleDeleteRows}
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            מחק שורות
          </Button>
        </Box>
      )}

      {/* סיכום קטן ומוצמד לתחתית המסך - נשאר גלוי כל הזמן, גם כשגוללים בטבלה */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 2,
          px: 2.5,
          py: 0.75,
          borderTop: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          fontSize: '0.75rem',
          boxShadow: '0 -2px 8px rgba(15, 23, 42, 0.05)',
        }}
      >
        {problemQueue.length > 0 && (
          <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, color: '#b45309' }}>
            מתקנים כעת - קופצים אוטומטית לשדה הבא עד שהכל יתוקן...
          </Typography>
        )}
        <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, color: '#334155' }}>
          סה"כ מוזמנים: {rows.length}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: 'inherit', fontWeight: 600, color: problemRowCount > 0 ? '#b45309' : '#15803d' }}
        >
          {problemRowCount > 0 ? `דרושים תיקון: ${problemRowCount} שורות` : 'הכל תקין ✓'}
        </Typography>
      </Box>
    </Box>
  );
}



