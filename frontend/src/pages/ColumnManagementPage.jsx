import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Checkbox,
} from '@mui/material';
import SettingsPageLayout, {
  SAVE_FAILED_MESSAGE,
  SettingsErrorSnackbar,
  SettingsSaveButton,
  SettingsSavedSnackbar,
  SettingsSecondaryButton,
} from '../components/SettingsPageLayout';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { getExcelColumns } from '../services/excelColumnsCache';
import {
  hasColumnPrefsChanged,
  parseColumnPreferences,
  resolveColumnFlag,
  saveColumnPreferences,
} from '../utils/columnPreferences';
import { COLUMN_MANAGEMENT_PAGE } from '../utils/settingsPages';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export default function ColumnManagementPage() {
  const navigate = useNavigate();
  const user = getLoggedUser();
  const [fieldDefs, setFieldDefs] = useState([]);
  // המצב השמור בשרת - מולו נקבע אם יש שינוי, ואליו חוזר "ביטול שינויים"
  const [savedPrefs, setSavedPrefs] = useState(() => parseColumnPreferences(user?.columnPreferences));
  const [prefs, setPrefs] = useState(savedPrefs);
  const [saving, setSaving] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getExcelColumns().then(setFieldDefs).catch(() => setFieldDefs([]));
  }, []);

  const isDirty = hasColumnPrefsChanged(savedPrefs, prefs, fieldDefs);
  const { confirmLeave, dialogProps } = useUnsavedChangesGuard(isDirty);

  const getFlag = (technicalName, key) => resolveColumnFlag(prefs, fieldDefs, technicalName, key);

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

  // בהצלחה - המצב השמור מתעדכן ומוצגת הודעת הצלחה. בכישלון - שום דבר לא נשמר, גם
  // לא מקומית (keepLocalOnFailure: false), כך שהטבלה והכניסה הבאה לעמוד ממשיכות
  // עם ההעדפות השמורות. העמוד נשאר "עם שינויים" ואפשר לנסות לשמור שוב
  const handleSave = async () => {
    setSaving(true);
    const savedToServer = await saveColumnPreferences(user, JSON.stringify(prefs), { keepLocalOnFailure: false });
    setSaving(false);
    if (savedToServer) {
      setSavedPrefs(prefs);
      setSavedOpen(true);
    } else {
      setSaveError(SAVE_FAILED_MESSAGE);
    }
  };

  const handleCancel = () => setPrefs(savedPrefs);

  const columnList = (key, title) => (
    <Box sx={{ flex: 1, minWidth: 260 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
        {title}
      </Typography>
      <List dense sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 0.5 }}>
        {fieldDefs.filter((f) => f.technicalName !== 'print').map((f) => (
          <ListItemButton
            key={f.technicalName}
            onClick={() => toggleFlag(f.technicalName, key)}
            sx={{ borderRadius: 1.5 }}
          >
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
  // לפתוח שוב את אותו מסך ייבוא, לא סתם לחזור לטבלה. עובר דרך confirmLeave, כך
  // שהדגלים משתנים רק כשבאמת יוצאים (ולא כשבוחרים "להישאר בעמוד")
  const handleBack = () => confirmLeave(() => {
    if (sessionStorage.getItem('settingsReturnTo') === 'columnMatch') {
      sessionStorage.removeItem('settingsReturnTo');
      sessionStorage.setItem('reopenColumnMatch', 'true');
    }
    navigate('/');
  });

  return (
    <SettingsPageLayout
      title={COLUMN_MANAGEMENT_PAGE.label}
      onBack={handleBack}
      footer={
        <>
          <SettingsSecondaryButton onClick={handleCancel} disabled={!isDirty || saving}>
            ביטול שינויים
          </SettingsSecondaryButton>
          <SettingsSaveButton onClick={handleSave} disabled={!isDirty} loading={saving} />
        </>
      }
    >
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {columnList('show', 'עמודות להצגה')}
        {columnList('print', 'עמודות להדפסה')}
      </Box>

      <SettingsSavedSnackbar open={savedOpen} onClose={() => setSavedOpen(false)} />
      <SettingsErrorSnackbar message={saveError} onClose={() => setSaveError('')} />
      <UnsavedChangesDialog {...dialogProps} />
    </SettingsPageLayout>
  );
}
