import { useEffect,useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton, Menu, MenuItem, Snackbar, Alert } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import DataTable from '../components/DataTable';
import api from '../services/api';
import PrintModal from '../components/PrintModal'; 
import { buildIdentityKey, mergeBelongsToValues } from '../utils/recipientIdentity';
import { parseColumnPreferences, saveColumnPreferences } from '../utils/columnPreferences';



function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// אות ראשונה של השם, לעיגול הפרופיל - אם השם הראשון מורכב משתי מילים (למשל "שושנה
// חנה"), האות הראשונה של כל מילה, צמודות בלי רווח ("שח"), לא רק אות אחת מהמילה
// הראשונה בלבד
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

function saveLocalRecords(phone, rows) {
  localStorage.setItem(`records-${phone}`, JSON.stringify(rows));
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
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null); // תפריט הפרופיל (עיגול עם אות ראשונה) שנפתח למעלה
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false); // הודעת "השמירה נעשתה בהצלחה" שיורדת מלמעלה

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
        setRecords(response.data);
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

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

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

  // "פינג" קל כל 4 דקות כל עוד הדף פתוח - Neon (בסיס הנתונים) "נרדם" אחרי 5 דקות של
  // חוסר פעילות, וההתעוררות הראשונה אחרי זה איטית (כמה שניות). זה מונע מזה לקרות
  // שוב ושוב תוך כדי עבודה רציפה בטבלה (לא עוזר לכניסה הראשונה ביום - לזה יש פינג
  // נפרד במסך ההתחברות)
  useEffect(() => {
    const interval = setInterval(() => {
      api.getRecipientColumns().catch(() => {});
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // עטוף ב-useCallback (לא פונקציה רגילה) כדי שהזהות שלו תישאר יציבה בין רינדורים -
  // אחרת DataTable מקבל onAutoSave חדש בכל הקשה, מה שגורם לו לבנות מחדש את כל
  // ה-columns שלו וקלטי העריכה מאבדים פוקוס אחרי כל אות (בדיוק הבאג שנתקלנו בו)
  const handleAutoSaveLocal = useCallback((updatedRows) => {
    if (!user?.phone) return;
    saveLocalRecords(user.phone, updatedRows);
    setRecords(updatedRows);
    setIsTableDirty(true); //  בום! ברגע שיש שינוי בטבלה, האבא ננעל רשמית!
  }, [user?.phone]);

  // מחיקה לא נשלחת לשרת מיד - רק נשמרת בתור "ממתינה" ונשלחת בפועל רק כשלוחצים "שמור
  // את כל המוזמנים" (handleSave), יחד עם שאר השינויים. המזהה האמיתי של שורה שמורה
  // הוא ה-hashCode (מחרוזת) - id מספרי טהור הוא שורה חדשה שעוד לא נשמרה בשרת בכלל
  // (ר' handleAddRow/handleImport), ולכן אין מה למחוק בשבילה
  const [pendingDeleteHashCodes, setPendingDeleteHashCodes] = useState([]);

  // מזהה מספרי טהור = שורה חדשה שעוד לא נשמרה בשרת בכלל - אין מה למחוק בשבילה
  const filterRealHashCodes = (ids) => ids.filter((id) => !(typeof id === 'number' || /^\d+$/.test(String(id))));

  const handleDeleteRows = (idsToDelete) => {
    const realIds = filterRealHashCodes(idsToDelete);
    if (!realIds.length) return;
    setPendingDeleteHashCodes((prev) => Array.from(new Set([...prev, ...realIds])));
  };
  // extraDeleteHashCodes - מזהים למחיקה שהתקבלו ישירות מהקורא (למשל handleConfirmDuplicates
  // ב-DataTable, אחרי שהמשתמשת פתרה שורות כפולות) ולא דרך pendingDeleteHashCodes (state) -
  // כי כשקוראים למחיקה ולשמירה ברצף באותה קריאה סינכרונית, ה-state ההוא עוד לא מספיק
  // להתעדכן לפני שה-handleSave הזה כבר רץ (stale closure), וההעברה במפורש פותרת את זה
  const handleSave = async (updatedRows, extraDeleteHashCodes = []) => {
    console.log("1. כפתור שמור נלחץ בדאשבורד!");

    if (!user?.phone) {
      console.log("❌ השליחה נעצרת כי אין טלפון למשתמש:", user);
      return;
    }

    try {
      // מחיקה ושמירה נשלחות יחד בבקשת HTTP אחת (לא שתי בקשות נפרדות) - הבקאנד
      // מבצע את המחיקה קודם, בתוך אותה טרנזקציה, לפני השמירה עצמה. אם המחיקה הייתה
      // רצה אחרי השמירה, נמען שנמחק ואז יובא/נוסף מחדש עם אותה זהות (שם+טלפון+כתובת)
      // היה מקבל hash זהה לנמען הישן שעדיין מקושר אליך באותו רגע - והמחיקה שהייתה
      // רצה רק אחר כך הייתה מנתקת בטעות גם את מה שכרגע נשמר
      const hashCodesToDelete = Array.from(
        new Set([...pendingDeleteHashCodes, ...filterRealHashCodes(extraDeleteHashCodes)])
      );

      console.log("2. שולח לבקאנד:", updatedRows);

      // hashCode כן נשלח (רק id המקומי-לתצוגה מוסר) - שורה עם hashCode היא נמען שכבר
      // קיים בשרת, ומזהה אותו במפורש בשביל עדכון; רק שורה חדשה לגמרי (בלי hashCode,
      // כמו מ"הוסף שורה") תיבדק ותקבל hash חדש בצד השרת
      const cleanRows = updatedRows.map(
          ({ id, ...rest }) => rest
      );

      console.log("2. שולח לבקאנד אחרי ניקוי:", cleanRows);


      console.log("SENDING TO BACKEND:", {
        phone: user.phone,
        recipients: cleanRows,
        hashCodesToDelete
      });

      const response = await api.saveRecords(
          user.phone,
          cleanRows,
          hashCodesToDelete
      );

      if (hashCodesToDelete.length > 0) {
        // מסירים רק את מה שבאמת נשלח בבקשה הזו (לא מאפסים סתם לריק) - כי בין
        // הרגע שנשלחה הבקשה לרגע שהיא חוזרת, המשתמשת יכולה להספיק לסמן עוד שורה
        // למחיקה (למשל דרך אייקון הפח) - איפוס גורף היה מוחק גם אותה מהתור בלי
        // שהיא נשלחה בפועל לשרת אף פעם
        const sentSet = new Set(hashCodesToDelete);
        setPendingDeleteHashCodes((prev) => prev.filter((id) => !sentSet.has(id)));
      }

      console.log("3. נשמר בהצלחה!", response.data);

      // משתמשים ישירות בנתונים שחזרו מהשמירה (hashCode טרי לנמענים חדשים, "שייך ל"
      // אחרי איחוד) - במקום לבקש מחדש את כל הרשימה מהשרת בנפרד. זה היה בקשת רשת
      // שלישית ברצף (אחרי מחיקה ושמירה) שהאיטה מאוד את "שמור את כל המוזמנים" בפועל
      // התאמה לפי hashCode קודם (חד-משמעית, לשורה שכבר הייתה קיימת) - ורק אם אין
      // (שורה חדשה) נופלים לזהות. זהות לבדה לא מספיקה כשיש 2 שורות עם אותם פרטי
      // זהות בדיוק (כמו ב"השאר את שתיהן" עם duplicateSalt) - שתיהן היו מתמזגות
      // לאותה תוצאה אחת ומקבלות בטעות את אותו מזהה. מוסיפים גם את duplicateSalt
      // לזהות (השרת מחזיר אותו כמו שהוא, ר' Recipients.java) כדי להבדיל ביניהן
      const savedRows = Array.isArray(response.data) ? response.data : [];
      const savedByHashCode = new Map();
      const savedByIdentity = new Map();
      savedRows.forEach((row) => {
        savedByHashCode.set(row.hashCode, row);
        savedByIdentity.set(`${buildIdentityKey(row)}|${row.duplicateSalt ?? ''}`, row);
      });
      const finalRecords = updatedRows.map((row) => {
        const saved = (row.hashCode && savedByHashCode.get(row.hashCode))
          ?? savedByIdentity.get(`${buildIdentityKey(row)}|${row.duplicateSalt ?? ''}`);
        return saved ? { ...saved, id: saved.hashCode } : row;
      });

      setRecords(finalRecords);
      saveLocalRecords(user.phone, finalRecords);
      setIsTableDirty(false);
      setSaveSuccessOpen(true);


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

    // ממזגים כל שורה שמיובאת מול מה שכבר יושב בטבלה (לא רק בין גליונות של אותו קובץ -
    // זה כבר טופל ב-ExcelImport - אלא גם מול נמענים שכבר קיימים מייבוא/שמירה קודמים).
    // כך שאם נמען כבר קיים ומיובא שוב עם "שייך ל" אחר, זה מתמזג מיד ויזואלית בטבלה,
    // לא רק אחרי לחיצה על "שמור" - אותו כלל בדיוק שרץ בשרת (belongsTo מצטבר, שאר
    // השדות "העדכני מנצח"), כדי שמה שרואים כאן יתאים בדיוק למה שבאמת יישמר
    const importedByIdentity = new Map();
    importedRows.forEach((row) => {
      const key = buildIdentityKey(row);
      if (key.replace(/\|/g, '') === '') return; // שורות בלי שום פרט זהות לא ממוזגות
      importedByIdentity.set(key, row);
    });

    const mergedRecords = records.map((row) => {
      const key = buildIdentityKey(row);
      const importedMatch = key.replace(/\|/g, '') !== '' ? importedByIdentity.get(key) : null;
      if (!importedMatch) return row;
      importedByIdentity.delete(key); // נוצל - לא ייווצר בשבילו גם שורה חדשה נפרדת
      return {
        ...row,
        ...importedMatch,
        id: row.id,
        hashCode: row.hashCode,
        belongsTo: mergeBelongsToValues(row.belongsTo, importedMatch.belongsTo),
      };
    });

    // אותה שיטת מזהה זמני כמו "הוסף שורה" בטבלה - שורות שבאמת חדשות (לא התמזגו לתוך
    // שורה קיימת למעלה) עוד לא נשמרו בשרת, אז אין להן hashCode
    const numericIds = records.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    let nextId = numericIds.length ? Math.max(...numericIds) + 1 : 1;
    const blankIdentityRows = importedRows.filter((row) => buildIdentityKey(row).replace(/\|/g, '') === '');
    const trulyNewRows = [...importedByIdentity.values(), ...blankIdentityRows];
    const rowsWithIds = trulyNewRows.map((row) => ({ ...row, id: row.id ?? nextId++ }));

    handleAutoSaveLocal([...rowsWithIds, ...mergedRecords]);
    setError('');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    window.location.href = '/login';
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
    await saveColumnPreferences(user, columnPreferences);
  };

  return (
      <Box sx={{ width: '100%', height: '100vh', px: 1, pt: 0.5, pb: 1, display: 'flex', flexDirection: 'column' }}>

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
              onOpenPrint={() => setIsPrintModalOpen(true)}
              columnPreferences={parseColumnPreferences(user?.columnPreferences)}
              profileMenu={profileMenu}
              onColumnOrderChange={handleColumnOrderChange}
              phone={user?.phone}
          />
        </Box>

        {/* רנדור המודאל והעברת הרשומות המסומנות אליו */}
        <PrintModal
            open={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            selectedRows={selectedRows}
            records={records}
        />

        <Snackbar
            open={saveSuccessOpen}
            autoHideDuration={3000}
            onClose={() => setSaveSuccessOpen(false)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
              onClose={() => setSaveSuccessOpen(false)}
              severity="success"
              variant="filled"
              icon={false}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                bgcolor: '#60a5fa',
                color: '#ffffff',
                '& .MuiAlert-action .MuiIconButton-root': { color: '#ffffff' },
              }}
          >
            השמירה נעשתה בהצלחה
          </Alert>
        </Snackbar>
      </Box>
  );}
