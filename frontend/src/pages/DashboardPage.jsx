import { useEffect, useCallback, useRef, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Avatar, Box, IconButton, List, ListItem, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import api from '../services/api';
import PrintModal from '../components/PrintModal';
import { parseColumnPreferences } from '../utils/columnPreferences';

const DEFAULT_PRINTABLE_FIELDS = ['prefix', 'man', 'woman', 'lastName', 'suffix', 'street', 'houseNo', 'city', 'country'];
const INTERNAL_PRINT_FIELD_KEYS = new Set(['id', 'hashCode', 'changed', 'changeDate', 'changeBy', 'createdBy', 'print', 'printFields']);



function getLoggedUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function getInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0];
  return `${parts[0][0]}${parts[1][0]}`;
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
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getLoggedUser();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]); // 🌟 רק הגדרה אחת, נקייה ותקינה!
  const [isTableDirty, setIsTableDirty] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
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

      // Keep hashCode for persisted rows: it is the stable database identity used
      // by the backend to update the intended recipient even if name/address changes.
      const cleanRows = updatedRows.map(({ id, printFields, ...rest }) => rest);

      console.log("2. שולח לבקאנד אחרי ניקוי:", cleanRows);


      console.log("SENDING TO BACKEND:", {
        phone: user.phone,
        recipients: cleanRows
      });

      const hashCodesToDelete = [...pendingDeletedHashCodes.current];
      if (hashCodesToDelete.length) {
        await api.deleteRecipients(user.phone, hashCodesToDelete);
        pendingDeletedHashCodes.current.clear();
        clearPendingDeletedHashCodes(user.phone);
      }

      const response = await api.saveRecords(
          user.phone,
          cleanRows
      );



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
  const profileMenu = (
    <Box sx={{ display: 'inline-flex' }}>
      <IconButton onClick={(e) => setProfileMenuAnchor(e.currentTarget)} size="small">
        <Avatar sx={{ width: 30, height: 30, bgcolor: '#1e3a8a', fontSize: '0.9rem' }}>
          {getInitials(user?.firstNameMan || user?.firstNameWoman || 'משתמש')}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={() => setProfileMenuAnchor(null)}
        transitionDuration={0}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          sx: {
            mt: 1,
            width: 320,
            borderRadius: 4,
            boxShadow: '0 8px 28px rgba(15, 23, 42, 0.18)',
            p: 3,
          },
        }}
        MenuListProps={{ sx: { p: 0 } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 2 }}>
          <Avatar sx={{ width: 72, height: 72, bgcolor: '#1e3a8a', fontSize: '2rem' }}>
            {getInitials(user?.firstNameMan || user?.firstNameWoman || 'משתמש')}
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mt: 1.5 }}>
            {getGreeting()}, {user?.firstNameMan || user?.firstNameWoman || 'משתמש'}!
          </Typography>
        </Box>

        <Box sx={{ bgcolor: '#f8fafc', borderRadius: 3, p: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <MenuItem
            onClick={() => {
              setProfileMenuAnchor(null);
              navigate('/settings');
            }}
            sx={{ borderRadius: 2.5, py: 1.25, px: 2, gap: 1.5, '&:hover': { bgcolor: '#eef2f7' } }}
          >
            <SettingsOutlinedIcon fontSize="small" sx={{ color: '#475569' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>הגדרות</Typography>
          </MenuItem>
          <MenuItem
            onClick={handleLogout}
            sx={{ borderRadius: 2.5, py: 1.25, px: 2, gap: 1.5, '&:hover': { bgcolor: '#eef2f7' } }}
          >
            <LogoutOutlinedIcon fontSize="small" sx={{ color: '#475569' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>יציאה</Typography>
          </MenuItem>
        </Box>
      </Menu>
    </Box>
  );

  // סדר העמודות שהמשתמשת גררה נשמר מיד לשרת, בלי לחכות ללחיצה על "שמור שינויים" -
  // זה שונה במפורש מהצג/הדפס (שנשמרים רק בלחיצה על שמור), כי הגרירה קורית בטבלה
  // עצמה, לא במסך ההגדרות. נשמר יחד עם אותה עמודה/מבנה JSON שכבר קיים להצג/הדפס,
  // בתוך מפתח נפרד (__order), כדי לא לפתוח עמודה חדשה בנאון בשביל זה
  const handleColumnOrderChange = async (order) => {
    const currentPrefs = parseColumnPreferences(user?.columnPreferences);
    const columnPreferences = JSON.stringify({ ...currentPrefs, __order: order });
    let updatedUser = { ...user, columnPreferences };
    try {
      const response = await api.updateColumnPreferences(user.phone, columnPreferences);
      updatedUser = response.data;
    } catch {
      // אם קריאת השרת נכשלה, שומרים לפחות מקומית כדי שהשינוי לא ילך לאיבוד בטעות
    }
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
      <Box sx={{ width: '100%', height: '100vh', px: 2, pt: 0.5, pb: 1, display: 'flex', flexDirection: 'column' }}>
        {error && (
            <Typography color="error" variant="body2" mb={1}>
              {error}
            </Typography>
        )}

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
              columnPreferences={parseColumnPreferences(user?.columnPreferences)}
              profileMenu={profileMenu}
              onColumnOrderChange={handleColumnOrderChange}
          />
        </Box>

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
