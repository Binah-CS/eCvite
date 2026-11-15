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
import SettingsPageLayout, { SettingsSaveButton, SettingsSavedSnackbar } from '../components/SettingsPageLayout';
import { getExcelColumns } from '../services/excelColumnsCache';
import { parseColumnPreferences, PRINT_DEFAULT_FIELDS, saveColumnPreferences } from '../utils/columnPreferences';
import { COLUMN_MANAGEMENT_PAGE } from '../utils/settingsPages';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export default function ColumnManagementPage() {
  const navigate = useNavigate();
  const user = getLoggedUser();
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
  // לפתוח שוב את אותו מסך ייבוא, לא סתם לחזור לטבלה
  const handleBack = () => {
    if (sessionStorage.getItem('settingsReturnTo') === 'columnMatch') {
      sessionStorage.removeItem('settingsReturnTo');
      sessionStorage.setItem('reopenColumnMatch', 'true');
    }
    navigate('/');
  };

  return (
    <SettingsPageLayout
      title={COLUMN_MANAGEMENT_PAGE.label}
      onBack={handleBack}
      footer={<SettingsSaveButton onClick={handleSave} />}
    >
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {columnList('show', 'עמודות להצגה')}
        {columnList('print', 'עמודות להדפסה')}
      </Box>

      <SettingsSavedSnackbar open={savedOpen} onClose={() => setSavedOpen(false)} />
    </SettingsPageLayout>
  );
}
