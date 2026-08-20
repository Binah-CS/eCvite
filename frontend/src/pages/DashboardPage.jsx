import { useEffect,useCallback, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import DataTable from '../components/DataTable';
import api from '../services/api';
import PrintModal from '../components/PrintModal'; // ייבוא המודאל החדש



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

function saveLocalRecords(phone, rows) {
  localStorage.setItem(`records-${phone}`, JSON.stringify(rows));
}

export default function DashboardPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getLoggedUser();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]); // 🌟 רק הגדרה אחת, נקייה ותקינה!
  const [isTableDirty, setIsTableDirty] = useState(false);

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
    const returnFromPreview = sessionStorage.getItem('returnFromPreview');

    if (returnFromPreview === 'true') {
      sessionStorage.removeItem('returnFromPreview');

      const local = getLocalRecords(user?.phone);
      setRecords(local);
      return;
    }

    loadRecords();
  }, [loadRecords, user?.phone]);

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
    saveLocalRecords(user.phone, updatedRows);
    setRecords(updatedRows);
    setIsTableDirty(true); //  בום! ברגע שיש שינוי בטבלה, האבא ננעל רשמית!
  }, [user?.phone]);

  // מחיקה לא נשלחת לשרת מיד - רק נשמרת בתור "ממתינה" ונשלחת בפועל רק כשלוחצים "שמור
  // את כל המוזמנים" (handleSave), יחד עם שאר השינויים. המזהה האמיתי של שורה שמורה
  // הוא ה-hashCode (מחרוזת) - id מספרי טהור הוא שורה חדשה שעוד לא נשמרה בשרת בכלל
  // (ר' handleAddRow/handleImport), ולכן אין מה למחוק בשבילה

  const handleDeleteRows = async (idsToDelete) => {
    if (!user?.phone) return;

    const realIds = idsToDelete.filter(
        (id) => !(typeof id === 'number' || /^\d+$/.test(String(id)))
    );

    if (!realIds.length) return;

    try {
      await api.deleteRecipients(user.phone, realIds);

      console.log('✅ הרשומות נמחקו מהשרת:', realIds);

      const currentRows = getLocalRecords(user.phone);

      const updatedRows = currentRows.filter(
          (row) => !realIds.includes(row.hashCode)
      );

      saveLocalRecords(user.phone, updatedRows);

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
          ({ id, hashCode, ...rest }) => rest
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



      console.log("3. נשמר בהצלחה!", response.data);

      // מוחקים בפועל מהשרת רק עכשיו, אחרי שהשמירה הצליחה - יחד עם שאר השינויים,
      // לא ברגע שלוחצים על כפתור המחיקה בטבלה




     setIsTableDirty(false);

      await loadRecords();


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
    const rowsWithIds = importedRows.map((row) => ({ ...row, id: row.id ?? nextId++ }));

    handleAutoSaveLocal([...rowsWithIds, ...records]);
    setError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
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
            onOpenPrint={() => setIsPrintModalOpen(true)}
        />

        {/* רנדור המודאל והעברת הרשומות המסומנות אליו */}
        <PrintModal
            open={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            selectedRows={selectedRows}
            records={records}
        />
      </Box>
  );}
