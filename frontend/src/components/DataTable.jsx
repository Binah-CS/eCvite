import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box,Button,Paper,Stack,Typography,TextField,Chip,Menu,MenuItem,IconButton,Popper,Dialog,DialogTitle,DialogContent,DialogContentText,DialogActions,} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
// Printing is opt-in: a recipient starts with no fields selected.
const DEFAULT_PRINTABLE_FIELDS = new Set();

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

function ColumnHeader({ headerName, field, sortDirection, onSortClick, isDragArmed }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', pr: '24px' }}>
      <Typography
        noWrap
        sx={{
          fontWeight: 700,
          color: '#4b5563',
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

export default function DataTable({ records, loading, onSave, onAutoSave, onSelectionChange, onDeleteRows, initialSelectedIds, onImport, onOpenPrint, onActivityFailure, columnPreferences, profileMenu, onColumnOrderChange }) {
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

  // ל-DataGrid (בגרסה הזו) אין prop מובנה של onCellContextMenu - לכן מאזינים ישירות
  // לאירוע contextmenu הטבעי של הדפדפן על הקונטיינר, ומזהים את התא/שורה לפי data-field/data-id
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return undefined;

    const handleNativeContextMenu = (event) => {
      const cellEl = event.target.closest('.MuiDataGrid-cell');
      if (!cellEl) return;
      const field = cellEl.getAttribute('data-field');
      if (!ADDRESS_FIELDS.includes(field)) return;
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
                onActivityFailure?.('RECIPIENT_COLUMNS_LOAD_FAILED', `Reason: ${err.message || 'Column definitions could not be loaded'}`);
            });
    }, [onActivityFailure]);
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
          onSelectionChange?.(matched);
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
    if (!onOpenPrint) return;

    const selectedRows = rows.filter((row) =>
      selectionModel.some((id) => String(id) === String(row.hashCode ?? row.id))
    );
    onOpenPrint({ selectedRows, filteredRows, allRows: rows });
  };

    const handleDownloadExcel = async () => {
        setExportMenuAnchor(null);
      try {

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
      } catch (err) {
        console.error('Excel export failed:', err);
        onActivityFailure?.('EXCEL_EXPORT_FAILED', `Reason: ${err.message || 'Export failed'}`);
      }
    };

  const handleAddRow = useCallback(() => {
    // חלק מה-id-ים הם hashCode (מחרוזת, לא מספר) - מתעלמים מהם בחישוב המספר הבא
    const currentRows = rowsRef.current;
    const numericIds = currentRows.map((row) => Number(row.id)).filter((n) => Number.isFinite(n));
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
      belongsTo: '',
      print: false,
    };
    const updatedRows = [newRow, ...currentRows];
    setRows(updatedRows);
    onAutoSave(updatedRows);


  }, [onAutoSave]);

  const handleDeleteRows = () => {
    const idsToDelete = selectionModel.map(String);
    const serverIdsToDelete = rows
      .filter((row) => idsToDelete.includes(String(row.id)) && row.hashCode !== undefined && row.hashCode !== null)
      .map((row) => String(row.hashCode));
    const updatedRows = rows.filter((row) => !idsToDelete.includes(String(row.id)));
    setRows(updatedRows);
    setSelectionModel([]);
    onSelectionChange?.([]);
    onAutoSave(updatedRows);
      console.log("ROWS AFTER DELETE:", updatedRows);
    // מחיקה מפורשת מיידית בשרת - רק השורות שבאמת סומנו ונלחצו עליהן "מחק", לא לפי השוואת רשימה
    if (onDeleteRows && serverIdsToDelete.length) {
      onDeleteRows(serverIdsToDelete);
    }
  };

  // מחיקת שורה בודדת - כפתור הפח שמופיע בריחוף על שורה, בלי צורך לסמן אותה קודם
  const handleDeleteSingleRow = useCallback((id) => {
    const rowToDelete = rowsRef.current.find((row) => String(row.id) === String(id));
    const updatedRows = rowsRef.current.filter((row) => String(row.id) !== String(id));
    setRows(updatedRows);
    setSelectionModel((prev) => prev.filter((selectedId) => String(selectedId) !== String(id)));
    onAutoSave(updatedRows);
    if (onDeleteRows && rowToDelete?.hashCode !== undefined && rowToDelete?.hashCode !== null) {
      onDeleteRows([String(rowToDelete.hashCode)]);
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
  }, [onAutoSave]);

  const toggleFieldPrint = useCallback((id, field) => {
    const updatedRows = rowsRef.current.map((row) => {
      if (String(row.id) !== String(id)) return row;
      const current = row.printFields?.[field] ?? DEFAULT_PRINTABLE_FIELDS.has(field);
      return { ...row, printFields: { ...row.printFields, [field]: !current } };
    });
    setRows(updatedRows);
    onAutoSave(updatedRows);
  }, [onAutoSave]);

  const renderFieldPrintToggle = useCallback((id, field, row) => (
    <input
      type="checkbox"
      checked={row.printFields?.[field] ?? DEFAULT_PRINTABLE_FIELDS.has(field)}
      aria-label={`הדפס את השדה ${field}`}
      title="הדפס שדה זה"
      onClick={(event) => event.stopPropagation()}
      onChange={() => toggleFieldPrint(id, field)}
      style={{ flexShrink: 0, marginInlineStart: 4 }}
    />
  ), [toggleFieldPrint]);

  // מעבירה את הערך מתא בעמודת כתובת (כשהוא לא מתאים) לעמודת "הערת כתובת" -
  // ומרוקנת את התא המקורי. אם כבר יש תוכן בהערת הכתובת, משרשרת אליו במקום לדרוס
  const moveValueToAddressNote = useCallback((id, field) => {
    const updatedRows = rowsRef.current.map((row) => {
      if (String(row.id) !== String(id)) return row;
      const value = String(row[field] ?? '').trim();
      if (!value) return row;
      const existingNote = String(row.addressNote ?? '').trim();
      return {
        ...row,
        [field]: '',
        addressNote: existingNote ? `${existingNote} ${value}` : value,
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

  // אייקון קטן שמופיע כשעוברים עם העכבר על תא בעמודת כתובת - לחיצה עליו מעבירה
  // את הערך ישירות ל"הערת כתובת", כדי שהאפשרות תהיה גלויה ולא רק דרך קליק ימני
  const renderAddressCell = useCallback((params) => {
    const { id, field, value, row } = params;
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          px: 1,
          '&:hover .move-to-note-icon': { opacity: 1 },
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
        {value && (
          <IconButton
            className="move-to-note-icon"
            size="small"
            tabIndex={-1}
            title="העבר להערת כתובת"
            sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, flexShrink: 0 }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              moveValueToAddressNote(id, field);
            }}
          >
            <SwapHorizIcon fontSize="inherit" />
          </IconButton>
        )}
        {renderFieldPrintToggle(id, field, row)}
      </Box>
    );
  }, [moveValueToAddressNote, renderFieldPrintToggle, updateCellValue]);

  // תא טקסט חי - קלט חופשי לגמרי תמיד, ואם יש pickListField (עמודות קידומת/סיום/
  // שייך ל) גם חץ קטן לצידו שפותח Menu לבחירה מהערכים הקיימים באותה עמודה. שתי
  // האפשרויות זמינות בו-זמנית. הרשימה מחושבת מ-rowsRef בזמן אמת כשפותחים אותה (לא
  // memo שתלוי ב-rows) - בכוונה, כי memo כזה היה יוצר מערך options חדש בכל הקשה,
  // מה שהיה מכריח את columns כולו להיווצר מחדש וגורם ל-DataGrid לאבד פוקוס מהקלט
  // אחרי כל אות (בדיוק הבאג שנתקלנו בו)
  const renderTextCell = useCallback((pickListField) => {
    const TextCell = (params) => {
      const { id, field, value, row } = params;
      const [menuOpen, setMenuOpen] = useState(false);
      const [menuOptions, setMenuOptions] = useState([]);
      const boxRef = useRef(null);

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

      return (
        <Box ref={boxRef} sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', px: 1 }}>
          <input
            value={value ?? ''}
            onChange={(event) => updateCellValue(id, field, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            // בלי זה ה-DataGrid תופס את מקש הרווח כקיצור מקלדת שלו (למשל גלילה/בחירה)
            // במקום לתת לו סתם להקליד תו רווח רגיל בתוך השדה
            onKeyDown={(event) => {
              if (event.key === ' ') event.stopPropagation();
            }}
            // לחיצה/כניסה לתא בעמודות הבחירה פותחת את רשימת הערכים הקיימים, בלי צורך
            // ללחוץ בנפרד על חץ - אפשר עדיין להקליד חופשי במקביל
            onFocus={() => {
              if (pickListField) openMenu();
            }}
            onBlur={closeMenu}
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
          {pickListField && (
            <Popper
              open={menuOpen}
              anchorEl={boxRef.current}
              placement="bottom-start"
              style={{ zIndex: 1300 }}
            >
              <Paper
                elevation={4}
                sx={{ minWidth: boxRef.current?.offsetWidth ?? 120, maxHeight: 220, overflowY: 'auto' }}
              >
                {menuOptions.length ? (
                  menuOptions.map((option) => (
                    <MenuItem
                      key={option}
                      // מונע מהלחיצה על אפשרות "לגזול" פוקוס מה-input לפני שה-onClick
                      // מספיק לרוץ - כך ה-input אף פעם לא מאבד פוקוס בזמן בחירה
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        updateCellValue(id, field, option);
                        closeMenu();
                      }}
                    >
                      {option}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>אין עדיין ערכים בעמודה הזו</MenuItem>
                )}
              </Paper>
            </Popper>
          )}
          {renderFieldPrintToggle(id, field, row)}
        </Box>
      );
    };
    // עוטפים ב-JSX (לא מחזירים את הפונקציה עצמה) כדי שריאקט יתייחס לכל תא כרכיב
    // אמיתי עם fiber משלו - הכרחי כי יש כאן hooks (useState/useRef) בפנים. בלעדי זה
    // ריאקט "מבלבל" בין hooks של תאים שונים (בדיוק השגיאה "Rendered more hooks...")
    return (params) => <TextCell {...params} />;
  }, [renderFieldPrintToggle, updateCellValue]);

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
 const requiredFields = useMemo(
    () => new Set(fieldDefs.filter((f) => f.isRequired).map((f) => f.technicalName)),
    [fieldDefs]
  );

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

      // ה-DataGrid מעדכן את הערך בפועל רק אחרי שה-focusout מסתיים. הבדיקה קורית
      // רק כשעוזבים את השדה (לא בכל הקשה) - כדי לא לקפוץ לתא הבא באמצע הקלדה,
      // רק אחרי שבאמת סיימו לערוך אותו
      setTimeout(() => {
        const value = apiRef.current.getCellValue(id, field);
        const stillInvalid = (requiredFields.has(field) && !value) || isValueInvalid(field, value);
        if (stillInvalid) return;
        setProblemQueue((prev) => {
          const remaining = prev.filter((p) => !(String(p.id) === String(id) && p.field === field));
          if (remaining.length === 0 && prev.length > 0) {
            onSave(rowsRef.current);
          }
          return remaining;
        });
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
  const printableFieldNames = useMemo(
    () => orderedFieldNames.filter((field) => field !== 'print'),
    [orderedFieldNames]
  );

  const toggleAllRowPrintFields = useCallback((id, row) => {
    const allSelected = printableFieldNames.every(
      (field) => row.printFields?.[field] ?? DEFAULT_PRINTABLE_FIELDS.has(field)
    );
    const updatedRows = rowsRef.current.map((currentRow) => {
      if (String(currentRow.id) !== String(id)) return currentRow;
      const printFields = { ...currentRow.printFields };
      printableFieldNames.forEach((field) => {
        printFields[field] = !allSelected;
      });
      return { ...currentRow, printFields };
    });
    setRows(updatedRows);
    onAutoSave(updatedRows);
  }, [onAutoSave, printableFieldNames]);

  const renderRowPrintSelection = useCallback((params) => {
    const { id, row } = params;
    const allSelected = printableFieldNames.length > 0 && printableFieldNames.every(
      (field) => row.printFields?.[field] ?? DEFAULT_PRINTABLE_FIELDS.has(field)
    );
    return (
      <Button
        size="small"
        variant="outlined"
        onClick={(event) => {
          event.stopPropagation();
          toggleAllRowPrintFields(id, row);
        }}
        sx={{ minWidth: 78, px: 0.5, fontSize: '0.7rem', whiteSpace: 'nowrap' }}
      >
        {allSelected ? 'בטל הכול' : 'בחר הכול'}
      </Button>
    );
  }, [printableFieldNames, toggleAllRowPrintFields]);

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
  // אחרת, אם כבר יש מיון ראשי, העמודה מצטרפת כתת-מיון (שובר שוויון).
  // אם אין עדיין מיון ראשי זה הופך להיות הוא, אחרת מצטרף כתת-מיון (שובר שוויון)
  const handleHeaderSortClick = useCallback((field) => {
    if (sortModel[0]?.field === field) {
      setSortModel(sortModel[0].sort === 'asc' ? [{ field, sort: 'desc' }] : []);
      return;
    }
    if (sortModel.length === 0) {
      setSortModel([{ field, sort: 'asc' }]);
      return;
    }
    if (!secondarySortFields.includes(field)) {
      setSecondarySortFields((currentSecondaryFields) => [...currentSecondaryFields, field]);
    }
  }, [secondarySortFields, sortModel]);

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
        const isRequiredEmpty = requiredFields.has(field) && !value;
        if (isRequiredEmpty || isValueInvalid(field, value)) {
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
      const customWidth = columnWidths[f.technicalName];
      const pickListField = ['prefix', 'suffix', 'belongsTo'].includes(f.technicalName)
        ? f.technicalName
        : null;
      return {
        field: f.technicalName,
        headerName: f.isRequired ? `${f.displayName} *` : f.displayName,
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
            headerName={f.isRequired ? `${f.displayName} *` : f.displayName}
            sortDirection={sortModel[0]?.field === f.technicalName ? sortModel[0].sort : null}
            onSortClick={handleHeaderSortClick}
            isDragArmed={dragArmedField === f.technicalName}
          />
        ),
      };
    });

    const printSelectionColumn = {
      field: 'printSelection',
      headerName: 'שדות להדפסה',
      width: 100,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: renderRowPrintSelection,
    };

    const addFirstRowColumn = {
      field: 'addRow',
      headerName: '',
      width: 44,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const firstRowId = params.api.getSortedRowIds()[0];
        if (String(params.id) !== String(firstRowId)) return null;
        return (
          <IconButton
            aria-label="הוסף שורה"
            title="הוסף שורה"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              handleAddRow();
            }}
            sx={{
              width: 32,
              height: 32,
              bgcolor: '#60a5fa',
              color: '#ffffff',
              '&:hover': { bgcolor: '#3b82f6' },
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        );
      },
    };

    return [addFirstRowColumn, printSelectionColumn, ...dynamicColumns, ...systemColumns];
  }, [columnWidths, displayFieldDefs, dragArmedField, handleAddRow, handleHeaderSortClick, renderAddressCell, renderBooleanCell, renderRowPrintSelection, renderTextCell, secondarySortFields, sortModel]);

  const handleAddSecondarySort = (field) => {
    if (!field || secondarySortFields.includes(field)) return;
    setSecondarySortFields((prev) => [...prev, field]);
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
      if (!f.defaultOrder) {
        model[f.technicalName] = false;
      }
    });
    setColumnVisibilityModel(model);
  }, [fieldDefs]);

  // בכל פעם שתור התיקונים מתעדכן (שמירה נחסמה, או שתוקן תא אחד וקפצנו לבא) -
  // גוללים אל התא הראשון בתור וממקדים ישירות ב-input שבתוכו (התאים הם קלטים חיים
  // תמיד, לא מסתמכים על מצב עריכה של ה-DataGrid, אז אין צורך "לפתוח" עריכה בכלל)
  useEffect(() => {
    if (problemQueue.length === 0 || !apiRef.current) return undefined;
    const target = problemQueue[0];
    const rowIndex = filteredRows.findIndex((row) => row.id === target.id);
    if (rowIndex === -1) return undefined;

    const colIndex = apiRef.current.getColumnIndex(target.field);
    apiRef.current.scrollToIndexes({ rowIndex, colIndex });
    // 300ms ולא 50 - כדי לוודא שזה קורה אחרי שאנימציית הסגירה של הפופ-אפ ("שמור בכל
    // זאת" / "לתקן עכשיו") מסתיימת לגמרי, אחרת הפופ-אפ "גונב" בחזרה את הפוקוס
    const timer = setTimeout(() => {
      const input = gridContainerRef.current?.querySelector(
        `[data-id="${target.id}"] [data-field="${target.field}"] input`
      );
      input?.focus();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemQueue, filteredRows]);

  return (
    <Box sx={{ position: 'relative' }}>
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        boxShadow: 'none',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.75,
          borderBottom: '1px solid #eef0f3',
          background: 'linear-gradient(180deg, #fbfcfe 0%, #ffffff 100%)',
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
              width: 190,
              bgcolor: '#ffffff',
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
              '& .MuiInputLabel-root': { fontSize: '0.72rem' },
            }}
          />

          {/* תגיות סינון פעילות + איפוס - ליד תיבת החיפוש עצמה */}
          {activeFilters.map((filter, index) => (
            <Chip
              key={index}
              label={filter}
              onDelete={() => handleRemoveChip(filter)}
              color="primary"
              variant="contained"
              size="small"
            />
          ))}

          {(activeFilters.length > 0 || inputValue.trim() !== '' || sortModel.length > 0 || secondarySortFields.length > 0) && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleFullReset}
              sx={{ fontWeight: 700, borderRadius: 2, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              בטל סינון/מיון
            </Button>
          )}

          {/* תת-מיון: כשממיינים לפי עמודה כלשהי (בלחיצה על החץ בכותרת), שורות ששוות בה
              יישברו לפי שרשרת העמודות הנוספות שנבחרות כאן, לפי סדר ההוספה - אפשר להוסיף
              כמה שרוצים, ואפשר לשנות את הבחירה גם אחרי שכבר ממויין */}
          <TextField
            select
            label="תת-מיון"
            size="small"
            value=""
            onChange={(e) => handleAddSecondarySort(e.target.value)}
            sx={{
              width: 100,
              bgcolor: '#ffffff',
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
              '& .MuiInputLabel-root': { fontSize: '0.72rem' },
            }}
          >
            {orderedFieldDefs
              .filter((f) => !secondarySortFields.includes(f.technicalName))
              .map((f) => (
                <MenuItem key={f.technicalName} value={f.technicalName}>
                  {f.displayName}
                </MenuItem>
              ))}
          </TextField>

          {secondarySortFields.map((field, index) => {
            const def = orderedFieldDefs.find((f) => f.technicalName === field);
            return (
              <Chip
                key={field}
                label={`${index + 1}. ${def ? def.displayName : field}`}
                onDelete={() => handleRemoveSecondarySort(field)}
                color="secondary"
                variant="outlined"
                size="small"
              />
            );
          })}
        </Box>

        <Stack direction="row" spacing={1}>
          <ExcelImport onImport={onImport} onFailure={onActivityFailure} />

          <Button
            variant="outlined"
            size="small"
            onClick={(event) => setExportMenuAnchor(event.currentTarget)}
            endIcon={<ArrowDropDownIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            ייצוא/הדפסה
          </Button>

          <Button
            variant="contained"
            size="small"
            onClick={handleAddRow}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              bgcolor: '#60a5fa',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#3b82f6', boxShadow: '0 6px 16px rgba(96, 165, 250, 0.35)' },
            }}
          >
            הוסף שורה
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveClick}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              bgcolor: '#60a5fa',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#3b82f6', boxShadow: '0 6px 16px rgba(96, 165, 250, 0.35)' },
            }}
          >
            שמור
          </Button>
        </Stack>
      </Box>

   <Box ref={gridContainerRef} sx={{ px: 1.5, pb: 1, pt: 0.75, maxWidth: '100%', overflowX: 'auto', position: 'relative' }}>
     <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
       תיבת הסימון לצד כל שדה קובעת אם ערכו יודפס במדבקה.
     </Typography>

   <DataGrid
        apiRef={apiRef}
        autoHeight
        rows={filteredRows}
        getRowId={(row) => row.hashCode ?? row.id}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        getCellClassName={(params) => {
          // התא הספציפי שקפצנו אליו כרגע (הראשון בתור התיקונים) - מודגש הרבה יותר חזק
          // מכל שאר תאי הבעיה, כדי שיהיה ברור בבירור לאיפה קפצו
          if (
            problemQueue.length > 0 &&
            String(params.id) === String(problemQueue[0].id) &&
            params.field === problemQueue[0].field
          ) {
            return 'current-problem-cell';
          }
          if (requiredFields.has(params.field) && !params.value) return 'required-empty-cell';
          if (isValueInvalid(params.field, params.value)) return 'invalid-value-cell';
          return '';
        }}
        sx={{
          border: 'none',
          borderRadius: 2,
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
            onSelectionChange?.(fullSelectedRows);
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
            insetInlineEnd: 4,
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
        <MenuItem onClick={handlePrintLabels}>הדפסת מדבקות</MenuItem>
        <MenuItem onClick={handleDownloadExcel}>הורדת קובץ אקסל למחשב</MenuItem>
      </Menu>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={handleMoveToAddressNote}>העבר להערת כתובת</MenuItem>
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



