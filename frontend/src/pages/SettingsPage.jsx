import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Checkbox,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { getExcelColumns } from '../services/excelColumnsCache';
import { parseColumnPreferences, PRINT_DEFAULT_FIELDS, saveColumnPreferences } from '../utils/columnPreferences';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { moveColumn, resolveColumnOrder } from '../utils/columnOrder';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// כל קטגוריות ההגדרות - כרגע יש רק אחת (ניהול עמודות), אבל הרשימה בצד בנויה כך
// שאפשר להוסיף עוד קטגוריות בעתיד בלי לשנות את מבנה העמוד
const SETTINGS_CATEGORIES = [
  { key: 'columns', label: 'ניהול עמודות', icon: ViewColumnOutlinedIcon },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = getLoggedUser();
  const [selectedCategory, setSelectedCategory] = useState('columns');
  const [fieldDefs, setFieldDefs] = useState([]);
  const [prefs, setPrefs] = useState(() => parseColumnPreferences(user?.columnPreferences));
  const [savedOpen, setSavedOpen] = useState(false);

  useEffect(() => {
    getExcelColumns().then(setFieldDefs).catch(() => setFieldDefs([]));
  }, []);

  const getFlag = (technicalName, key) => {
    const saved = prefs[technicalName]?.[key];
    if (saved !== undefined) return saved;
    if (key === 'show') {
      const f = fieldDefs.find((d) => d.technicalName === technicalName);
      return Boolean(f?.defaultOrder);
    }
    return PRINT_DEFAULT_FIELDS.has(technicalName);
  };

  const toggleFlag = (technicalName, key) => {
    setPrefs((prev) => ({
      ...prev,
      [technicalName]: {
        show: getFlag(technicalName, 'show'),
        print: getFlag(technicalName, 'print'),
        [key]: !getFlag(technicalName, key),
      },
    }));
  };

  const handleSave = async () => {
    const columnPreferences = JSON.stringify(prefs);
    await saveColumnPreferences(user, columnPreferences);
    setSavedOpen(true);
  };

  // סדר העמודות בטבלה - גרירה ברשימת "עמודות להצגה" (#79). נשמר ב"שמור שינויים", באותו
  // מקום שבו נשמרת גרירת העמודות בטבלה עצמה (__order), כך ששתי הדרכים משנות את אותו סדר.
  // __order נכתב רק אחרי גרירה - בלי גרירה ממשיכים לקבל את ברירת המחדל מה-DB
  const [draggedColumn, setDraggedColumn] = useState(null);
  const columnOrder = resolveColumnOrder(prefs.__order, fieldDefs);
  const dragOverColumn = (targetName) => {
    if (!draggedColumn || draggedColumn === targetName) return;
    setPrefs((prev) => ({
      ...prev,
      __order: moveColumn(resolveColumnOrder(prev.__order, fieldDefs), draggedColumn, targetName),
    }));
  };

  // רשימת "עמודות להדפסה" נשארת בסדר הקבוע - סדר השורות במדבקה לא תלוי בסדר העמודות
  const columnList = (key, title, { reorderable = false, hint } = {}) => (
    <Box sx={{ flex: 1, minWidth: 260 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: hint ? 0.25 : 1, color: '#1e293b' }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" sx={{ mb: 1, color: '#64748b' }}>
          {hint}
        </Typography>
      )}
      <List dense sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 0.5 }}>
        {(reorderable
          ? columnOrder.map((name) => fieldDefs.find((f) => f.technicalName === name))
          : fieldDefs
        ).filter((f) => f.technicalName !== 'print').map((f) => (
          <ListItemButton
            key={f.technicalName}
            onClick={() => toggleFlag(f.technicalName, key)}
            {...(reorderable && {
              draggable: true,
              onDragStart: (event) => {
                event.dataTransfer.effectAllowed = 'move';
                setDraggedColumn(f.technicalName);
              },
              onDragEnter: () => dragOverColumn(f.technicalName),
              onDragOver: (event) => event.preventDefault(),
              onDrop: (event) => event.preventDefault(),
              onDragEnd: () => setDraggedColumn(null),
            })}
            sx={{
              borderRadius: 1.5,
              ...(reorderable && { cursor: 'grab' }),
              ...(reorderable && draggedColumn === f.technicalName && { opacity: 0.5, bgcolor: '#e0f2fe' }),
            }}
          >
            {reorderable && <DragIndicatorIcon fontSize="small" sx={{ color: '#94a3b8', mr: -0.5 }} />}
            <Checkbox
              checked={getFlag(f.technicalName, key)}
              tabIndex={-1}
              disableRipple
            />
            <ListItemText primary={f.displayName} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  // אם הגיעו לכאן מתוך מסך התאמת העמודות בייבוא (לא מהתפריט הרגיל) - חזרה צריכה
  // לפתוח שוב את אותו מסך ייבוא, לא סתם לחזור לטבלה
  const handleBack = () => {
    if (sessionStorage.getItem('settingsReturnTo') === 'columnMatch') {
      sessionStorage.removeItem('settingsReturnTo');
      sessionStorage.setItem('reopenColumnMatch', 'true');
    }
    navigate('/');
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', px: 3, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={handleBack}>
          <ArrowForwardIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          הגדרות
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        {/* רשימת הקטגוריות - נשארת קבועה בצד, לא נעלמת כשבוחרים קטגוריה */}
        <List sx={{ width: 280, flexShrink: 0 }}>
          {SETTINGS_CATEGORIES.map(({ key, label, icon: Icon }) => (
            <ListItemButton
              key={key}
              selected={selectedCategory === key}
              onClick={() => setSelectedCategory(key)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                gap: 1.5,
                '&.Mui-selected': { bgcolor: '#eff6ff' },
                '&.Mui-selected:hover': { bgcolor: '#eff6ff' },
              }}
            >
              <Icon sx={{ color: '#475569' }} />
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>

        {/* תוכן הקטגוריה הנבחרת - מוצג באמצע, לצד הרשימה */}
        <Box sx={{ flex: 1, pb: 10 }}>
          {selectedCategory === 'columns' && (
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {columnList('show', 'עמודות להצגה', {
                reorderable: true,
                hint: 'אפשר לגרור עמודה למעלה או למטה כדי לשנות את המיקום שלה בטבלה',
              })}
              {columnList('print', 'עמודות להדפסה')}
            </Box>
          )}
        </Box>
      </Box>

      {/* כפתור השמירה מודבק לתחתית המסך - תמיד גלוי, גם בזמן גלילה - בלי רקע/מסגרת סביבו, ישר על המסך */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          px: 3,
          py: 1.5,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          variant="outlined"
          onClick={handleSave}
          sx={{
            bgcolor: '#dbeafe',
            color: '#1e293b',
            borderColor: '#60a5fa',
            '&:hover': { bgcolor: '#bfdbfe', borderColor: '#60a5fa' },
            py: 1,
            px: 3,
            fontSize: '0.95rem',
            fontWeight: 700,
          }}
        >
          שמור שינויים
        </Button>
      </Box>

      <Snackbar
        open={savedOpen}
        autoHideDuration={2500}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" icon={false} sx={{ bgcolor: '#60a5fa', color: '#fff' }}>
          נשמר בהצלחה
        </Alert>
      </Snackbar>
    </Box>
  );
}
