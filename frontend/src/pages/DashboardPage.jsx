import { useEffect, useCallback, useRef, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DataTable from '../components/DataTable';
import api from '../services/api';
import PrintModal from '../components/PrintModal'; // ייבוא המודאל החדש

const DEFAULT_PRINTABLE_FIELDS = ['prefix', 'man', 'woman', 'lastName', 'suffix', 'street', 'houseNo', 'city', 'country'];
const INTERNAL_PRINT_FIELD_KEYS = new Set(['id', 'hashCode', 'changed', 'changeDate', 'changeBy', 'createdBy', 'print', 'printFields']);



function getLoggedUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function getLocalRecords(phone) {
  const saved = localStorage.getItem(`records-${phone}`);
  if (!saved) return [];
  // מתעלמים משורות בלי id (למשל שיור ישן מגרסה קודמת) - הן היו מקריסות את DataGrid
  return JSON.parse(saved).filter((row) => row.id !== undefined && row.id !== null);
}

function getLocalPrintFields(phone) {
  const saved = localStorage.getItem(`print-fields-${phone}`);
  return saved ? JSON.parse(saved) : {};
}

function applyLocalPrintFields(phone, rows) {
  const printFieldsByRecipient = getLocalPrintFields(phone);
  return rows.map((row) => {
    const savedFields = printFieldsByRecipient[row.hashCode ?? row.id];
    return savedFields ? { ...row, printFields: savedFields } : row;
  });
}

function saveLocalRecords(phone, rows) {
  localStorage.setItem(`records-${phone}`, JSON.stringify(rows));
  const printFieldsByRecipient = Object.fromEntries(
    rows
      .filter((row) => row.printFields && (row.hashCode ?? row.id) !== undefined)
      .map((row) => [row.hashCode ?? row.id, row.printFields])
  );
  localStorage.setItem(`print-fields-${phone}`, JSON.stringify(printFieldsByRecipient));
}

function getPendingDeletedStorageKey(phone) {
  return `pending-deleted-${phone}`;
}

function getPendingDeletedHashCodes(phone) {
  if (!phone) return new Set();
  const saved = localStorage.getItem(getPendingDeletedStorageKey(phone));
  return new Set(saved ? JSON.parse(saved).map(String) : []);
}

function savePendingDeletedHashCodes(phone, deletedIds) {
  if (!phone) return;
  localStorage.setItem(getPendingDeletedStorageKey(phone), JSON.stringify([...deletedIds]));
}

function clearPendingDeletedHashCodes(phone) {
  if (!phone) return;
  localStorage.removeItem(getPendingDeletedStorageKey(phone));
}

function getRecordIdentity(row) {
  return row.hashCode ?? row.id;
}

function filterDeletedRows(rows, deletedIds) {
  if (!deletedIds || deletedIds.size === 0) return rows;

  return rows.filter((row) => {
    const ids = [row.id, row.hashCode, getRecordIdentity(row)]
      .filter((id) => id !== undefined && id !== null)
      .map(String);

    return ids.every((id) => !deletedIds.has(id));
  });
}

function normalizePendingDeletedHashCodes(phone, pendingIds, rowsFromServer) {
  if (!phone || !pendingIds || pendingIds.size === 0 || !rowsFromServer.length) {
    return pendingIds ?? new Set();
  }

  const localIds = new Set(
    getLocalRecords(phone)
      .flatMap((row) => [row.hashCode, row.id])
      .filter((id) => id !== undefined && id !== null)
      .map(String)
  );
  const serverIds = new Set(
    rowsFromServer
      .flatMap((row) => [row.hashCode, row.id])
      .filter((id) => id !== undefined && id !== null)
      .map(String)
  );
  const activeIds = new Set(
    [...pendingIds].filter((id) => serverIds.has(id) && !localIds.has(id))
  );

  if (activeIds.size >= rowsFromServer.length) {
    clearPendingDeletedHashCodes(phone);
    return new Set();
  }

  if (activeIds.size !== pendingIds.size) {
    if (activeIds.size) {
      savePendingDeletedHashCodes(phone, activeIds);
    } else {
      clearPendingDeletedHashCodes(phone);
    }
  }

  return activeIds;
}

function createUnselectedPrintFields(row) {
  const fieldNames = new Set([
    ...DEFAULT_PRINTABLE_FIELDS,
    ...Object.keys(row).filter((field) => !INTERNAL_PRINT_FIELD_KEYS.has(field)),
  ]);

  return Object.fromEntries([...fieldNames].map((field) => [field, false]));
}

function cloneRows(rows) {
  return rows.map((row) => ({
    ...row,
    printFields: row.printFields ? { ...row.printFields } : row.printFields,
  }));
}

export default function DashboardPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getLoggedUser();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]); // 🌟 רק הגדרה אחת, נקייה ותקינה!
  const [isTableDirty, setIsTableDirty] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const hasTrackedDashboardVisit = useRef(false);
  const pendingDeletedHashCodes = useRef(getPendingDeletedHashCodes(user?.phone));
  const recordsRef = useRef(records);
  const undoStackRef = useRef([]);
  const isApplyingUndo = useRef(false);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // זהות השורות שהיו מסומנות לפני שיצאנו לתצוגה המקדימה - נקרא פעם אחת, בטרם עולה הטבלה
  const [initialSelectedIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    const saved = sessionStorage.getItem('savedSelectedIds');
    return saved ? JSON.parse(saved) : [];
  });


  const loadRecords = useCallback(async () => {
    if (!user?.phone) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.getRecipients(user.phone);

      //  שיפור: אם הבקאנד החזיר רשימה ריקה (כי ה-DB ריק/לא מחובר), נטען כגיבוי מהלוקאל
      if (response.data && response.data.length > 0) {
        const serverRows = applyLocalPrintFields(user.phone, response.data);
        pendingDeletedHashCodes.current = normalizePendingDeletedHashCodes(
          user.phone,
          pendingDeletedHashCodes.current,
          serverRows
        );
        setRecords(filterDeletedRows(serverRows, pendingDeletedHashCodes.current));
      } else {
        const local = getLocalRecords(user.phone);
        setRecords(local);
      }

      setError('');
    } catch (err) {
      setError('לא ניתן לטעון רשומות מהמנוע האחורי. עובד במצב לא מקוון.');
      setRecords(getLocalRecords(user.phone));
    } finally {
      setLoading(false);
    }
  }, [user?.phone]);

  const loadActivityLogs = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const response = await api.getActivityLogs(user.phone);
      setActivityLogs(response.data);
    } catch (err) {
      console.warn('Unable to load activity logs', err);
    }
  }, [user?.phone]);

  const trackActivity = useCallback(async (action, details = '') => {
    if (!user?.phone) return;
    try {
      await api.createActivityLog(user.phone, action, details);
      await loadActivityLogs();
    } catch (err) {
      console.warn('Unable to save activity log', err);
    }
  }, [loadActivityLogs, user?.phone]);

  useEffect(() => {
    const returnFromPreview = sessionStorage.getItem('returnFromPreview');

    if (returnFromPreview === 'true') {
      sessionStorage.removeItem('returnFromPreview');

      const local = getLocalRecords(user?.phone);
      setRecords(local);
      return;
    }

    loadRecords();
  }, [loadRecords, user?.phone]);

  useEffect(() => {
    loadActivityLogs();
    if (user?.phone && !hasTrackedDashboardVisit.current) {
      hasTrackedDashboardVisit.current = true;
      trackActivity('DASHBOARD_OPENED');
    }
  }, [loadActivityLogs, trackActivity, user?.phone]);

  // 🌟 פותח את המודאל אוטומטית אם המשתמש לחץ על "שינוי הגדרות" בתצוגה המקדימה
  useEffect(() => {
    const cameFromPreview = sessionStorage.getItem('fromPreview');

    if (cameFromPreview === 'true') {
      setIsPrintModalOpen(true);
      sessionStorage.removeItem('fromPreview'); // מנקים מיד כדי שלא יציק ברענונים הבאים
      sessionStorage.removeItem('savedSelectedIds');
    }
  }, []);
  //  מקפיץ אזהרה ברענן/סגירה רק אם הסטייט השתנה (כלומר יש שינויים שלא נשמרו)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isTableDirty) {
        e.preventDefault();
        // e.returnValue = 'ישנם שינויים שלא נשמרו. האם אתה בטוח שברצונך לעזוב?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTableDirty]);

  // עטוף ב-useCallback (לא פונקציה רגילה) כדי שהזהות שלו תישאר יציבה בין רינדורים -
  // אחרת DataTable מקבל onAutoSave חדש בכל הקשה, מה שגורם לו לבנות מחדש את כל
  // ה-columns שלו וקלטי העריכה מאבדים פוקוס אחרי כל אות (בדיוק הבאג שנתקלנו בו)
  const handleAutoSaveLocal = useCallback((updatedRows) => {
    if (!user?.phone) return;
    updatedRows.forEach((row) => {
      if (row.hashCode !== undefined && row.hashCode !== null) {
        pendingDeletedHashCodes.current.delete(String(row.hashCode));
      }
    });

    if (pendingDeletedHashCodes.current.size) {
      savePendingDeletedHashCodes(user.phone, pendingDeletedHashCodes.current);
    } else {
      clearPendingDeletedHashCodes(user.phone);
    }

    const visibleRows = filterDeletedRows(updatedRows, pendingDeletedHashCodes.current);
    if (!isApplyingUndo.current) {
      undoStackRef.current = [...undoStackRef.current.slice(-49), cloneRows(recordsRef.current)];
    }
    saveLocalRecords(user.phone, visibleRows);
    setRecords(visibleRows);
    setIsTableDirty(true); //  בום! ברגע שיש שינוי בטבלה, האבא ננעל רשמית!
  }, [user?.phone]);

  const handleUndoLastChange = useCallback(() => {
    if (!user?.phone || undoStackRef.current.length === 0) return false;

    const previousRows = undoStackRef.current.pop();
    previousRows.forEach((row) => {
      if (row.hashCode !== undefined && row.hashCode !== null) {
        pendingDeletedHashCodes.current.delete(String(row.hashCode));
      }
    });

    if (pendingDeletedHashCodes.current.size) {
      savePendingDeletedHashCodes(user.phone, pendingDeletedHashCodes.current);
    } else {
      clearPendingDeletedHashCodes(user.phone);
    }

    isApplyingUndo.current = true;
    saveLocalRecords(user.phone, previousRows);
    setRecords(previousRows);
    setSelectedRows((currentSelectedRows) =>
      currentSelectedRows.filter((selectedRow) =>
        previousRows.some((row) => String(row.id) === String(selectedRow.id))
      )
    );
    setIsTableDirty(true);
    setTimeout(() => {
      isApplyingUndo.current = false;
    }, 0);

    return true;
  }, [user?.phone]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z';

      if (!isUndoShortcut) return;
      if (!handleUndoLastChange()) return;

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleUndoLastChange]);

  // מחיקה לא נשלחת לשרת מיד - רק נשמרת בתור "ממתינה" ונשלחת בפועל רק כשלוחצים "שמור
  // את כל המוזמנים" (handleSave), יחד עם שאר השינויים. המזהה האמיתי של שורה שמורה
  // הוא ה-hashCode (מחרוזת) - id מספרי טהור הוא שורה חדשה שעוד לא נשמרה בשרת בכלל
  // (ר' handleAddRow/handleImport), ולכן אין מה למחוק בשבילה

  const handleDeleteRows = async (idsToDelete) => {
    if (!user?.phone) return;

    const deletedIds = new Set(
      (idsToDelete || [])
        .filter((id) => id !== undefined && id !== null)
        .map(String)
    );

    if (!deletedIds.size) return;

    const realIds = [...deletedIds];

    try {
      // Keep the deletion local until the user explicitly saves the table.
      realIds.forEach((id) => pendingDeletedHashCodes.current.add(id));
      savePendingDeletedHashCodes(user.phone, pendingDeletedHashCodes.current);

      console.log('✅ הרשומות נמחקו מהשרת:', realIds);

      const currentRows = getLocalRecords(user.phone);

      const updatedRows = filterDeletedRows(currentRows, deletedIds);

      saveLocalRecords(user.phone, updatedRows);
      setRecords(updatedRows);
      await loadActivityLogs();

    } catch (err) {
      console.error('❌ שגיאה במחיקת הרשומות:', err);
      setError('לא ניתן למחוק את הרשומות מהשרת.');
    }
  };
  const handleSave = async (updatedRows) => {
    console.log("1. כפתור שמור נלחץ בדאשבורד!");

    if (!user?.phone) {
      console.log("❌ השליחה נעצרת כי אין טלפון למשתמש:", user);
      return;
    }

    try {
      console.log("2. שולח לבקאנד:", updatedRows);

      const cleanRows = updatedRows.map(
          ({ id, hashCode, printFields, ...rest }) => rest
      );

      console.log("2. שולח לבקאנד אחרי ניקוי:", cleanRows);


      console.log("SENDING TO BACKEND:", {
        phone: user.phone,
        recipients: cleanRows
      });

      const response = await api.saveRecords(
          user.phone,
          cleanRows
      );

      const hashCodesToDelete = [...pendingDeletedHashCodes.current];
      if (hashCodesToDelete.length) {
        await api.deleteRecipients(user.phone, hashCodesToDelete);
        pendingDeletedHashCodes.current.clear();
        clearPendingDeletedHashCodes(user.phone);
      }



      console.log("3. נשמר בהצלחה!", response.data);

      // מוחקים בפועל מהשרת רק עכשיו, אחרי שהשמירה הצליחה - יחד עם שאר השינויים,
      // לא ברגע שלוחצים על כפתור המחיקה בטבלה




     setIsTableDirty(false);

      await loadRecords();
      await loadActivityLogs();


    } catch (err) {

      console.error("❌ שגיאה בשליחה לבקאנד:", err);

      setError(
          'לא ניתן לשמור רשומות לשרת. השמירה תבצע באופן מקומי.'
      );

      saveLocalRecords(user.phone, updatedRows);
    }
  };

  // ייבוא אקסל לא שומר לשרת מיד - רק מציג את השורות בטבלה מקומית, בדיוק כמו כל עריכה
  // אחרת. השמירה בפועל ל-Neon קורית רק כשלוחצים "שמור את כל המוזמנים" (handleSave)
  const handleImport = (rows) => {
    // onImport נקרא לפעמים עם מערך שורות ולפעמים עם { rows, columns } - תלוי בנתיב
    // בתוך ExcelImport - שני המבנים קיימים היום בפועל
    const importedRows = Array.isArray(rows) ? rows : rows?.rows ?? [];
    if (!importedRows.length || !user?.phone) return;

    // אותה שיטת מזהה זמני כמו "הוסף שורה" בטבלה - שורות מיובאות עוד לא נשמרו בשרת
    // אז אין להן hashCode, וצריך id ייחודי כלשהו כדי שה-DataGrid יוכל להציג אותן
    const numericIds = records.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    let nextId = numericIds.length ? Math.max(...numericIds) + 1 : 1;
    const rowsWithIds = importedRows.map((row) => ({
      ...row,
      id: row.id ?? nextId++,
      printFields: createUnselectedPrintFields(row),
    }));

    handleAutoSaveLocal([...rowsWithIds, ...records]);
    trackActivity('EXCEL_IMPORTED_TO_TABLE', `Rows added to table: ${rowsWithIds.length}`);
    setError('');
  };

  const handleLogout = async () => {
    await trackActivity('LOGGED_OUT');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const formatActivityLog = (entry) => {
    const labels = {
      DASHBOARD_OPENED: 'נפתחה לוח הבקרה',
      LOGGED_OUT: 'בוצעה יציאה מהמערכת',
      EXCEL_IMPORTED_TO_TABLE: 'יובא קובץ Excel לטבלה',
      RECIPIENTS_SAVED: 'נשמרו נמענים',
      RECIPIENTS_IMPORTED: 'יובאו נמענים',
      RECIPIENTS_DELETED: 'נמחקו נמענים',
      PRINT_MODAL_OPENED: 'נפתח מסך הדפסה',
    };
    const date = entry.createdAt ? new Date(entry.createdAt).toLocaleString('he-IL') : '';
    return { title: labels[entry.action] || entry.action, secondary: [entry.details, date].filter(Boolean).join(' | ') };
  };
  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return 'בוקר טוב';
    }

    if (hour >= 12 && hour < 18) {
      return 'צהריים טובים';
    }

    return 'ערב טוב';
  };
  return (
      <Box sx={{ width: '100%', px: 2, pt: 0.5, pb: 1 }}>



        <Typography
            variant="h8"
            sx={{
              fontWeight: 700,
              color: '#1e3a8a',
              textAlign: 'right',
              transform: 'translateY(-30px)',
            }}
        >

          <Box display="flex" justifyContent="space-between" mb={0.25} >

            {getGreeting()}, {user?.firstNameMan || user?.firstNameWoman || 'משתמש'}
            <Button
                variant="outlined"
                size="small"
                onClick={handleLogout}
                sx={{ textTransform: 'none', px: 2, borderRadius: 2 }}

            >
              יציאה

            </Button>

          </Box>
        </Typography>

        {error && (
            <Typography color="error" variant="body2" mb={1}>
              {error}
            </Typography>
        )}

        <DataTable
            records={records}
            loading={loading}
            onSave={handleSave}
            onAutoSave={handleAutoSaveLocal}
            onSelectionChange={setSelectedRows}
            onDeleteRows={handleDeleteRows}
            initialSelectedIds={initialSelectedIds}
            onImport={handleImport}
            onOpenPrint={() => {
              setIsPrintModalOpen(true);
              trackActivity('PRINT_MODAL_OPENED', `Selected rows: ${selectedRows.length}`);
            }}
        />

        {/* רנדור המודאל והעברת הרשומות המסומנות אליו */}
        <PrintModal
            open={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            selectedRows={selectedRows}
            records={records}
        />

        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>יומן פעילות ({activityLogs.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {activityLogs.length === 0 ? (
              <Typography color="text.secondary">עדיין לא נרשמה פעילות.</Typography>
            ) : (
              <List dense disablePadding>
                {activityLogs.map((entry) => {
                  const log = formatActivityLog(entry);
                  return (
                    <ListItem key={entry.id} disableGutters>
                      <ListItemText primary={log.title} secondary={log.secondary} />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
  );}
