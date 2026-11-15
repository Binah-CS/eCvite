import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, MenuItem, Snackbar, TextField } from '@mui/material';
import SettingsPageLayout, {
  SettingsSaveButton,
  SettingsSavedSnackbar,
  SettingsSecondaryButton,
} from '../components/SettingsPageLayout';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import api from '../services/api';
import { getChangedFields, getVisibleAccountFields, toFormValues, validateAccount } from '../utils/accountDetails';
import { ACCOUNT_PAGE } from '../utils/settingsPages';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

const SAVE_FAILED = 'השמירה נכשלה. נסי שוב.';
const FIX_FIELDS = 'יש שדות שצריך לתקן';
const READ_ONLY_HINT = 'משמש להתחברות ולא ניתן לשינוי';

const EMPTY_FIELD_LISTS = { editable: [], readOnly: [], required: [] };

export default function AccountDetailsPage() {
  const navigate = useNavigate();
  const [loggedUser] = useState(getLoggedUser);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  // מה נעול, מה ניתן לעריכה ומה חובה - מגיע רק מהשרת (ר' AccountFields ב-backend)
  const [fieldLists, setFieldLists] = useState(EMPTY_FIELD_LISTS);
  const [savedValues, setSavedValues] = useState({});
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveError, setSaveError] = useState('');

  // תשובת GET/PUT זהה - מעדכנים את הטופס, את "המצב השמור" ואת המשתמשת ב-sessionStorage
  // (כמו אחרי התחברות), כדי ששאר האפליקציה תראה את הפרטים החדשים
  const applyAccountResponse = useCallback((data) => {
    const lists = {
      editable: data.editableFields ?? [],
      readOnly: data.readOnlyFields ?? [],
      required: data.requiredFields ?? [],
    };
    const formValues = toFormValues(data.user, [...lists.readOnly, ...lists.editable]);
    setFieldLists(lists);
    setSavedValues(formValues);
    setValues(formValues);
    setErrors({});
    sessionStorage.setItem('user', JSON.stringify(data.user));
  }, []);

  const loadAccount = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await api.getAccount(loggedUser?.phone, loggedUser?.hashCode);
      applyAccountResponse(response.data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [loggedUser, applyAccountResponse]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const visibleFields = useMemo(
    () => getVisibleAccountFields(fieldLists.editable, fieldLists.readOnly),
    [fieldLists]
  );
  const changes = useMemo(
    () => getChangedFields(savedValues, values, fieldLists.editable),
    [savedValues, values, fieldLists.editable]
  );
  const isDirty = Object.keys(changes).length > 0;
  const { confirmLeave, dialogProps } = useUnsavedChangesGuard(isDirty);

  const handleChange = (name) => (event) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleCancel = () => {
    setValues(savedValues);
    setErrors({});
  };

  const handleSave = async () => {
    const clientErrors = validateAccount(changes, fieldLists.required);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setSaveError(FIX_FIELDS);
      return;
    }

    setSaving(true);
    try {
      const response = await api.updateAccount(loggedUser?.phone, loggedUser?.hashCode, changes);
      applyAccountResponse(response.data);
      setSavedOpen(true);
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) setErrors(serverErrors);
      setSaveError(serverErrors ? FIX_FIELDS : SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const renderField = ({ name, label, options }) => {
    const readOnly = !fieldLists.editable.includes(name);
    return (
      <TextField
        key={name}
        label={label}
        value={values[name] ?? ''}
        onChange={handleChange(name)}
        disabled={readOnly}
        required={!readOnly && fieldLists.required.includes(name)}
        error={Boolean(errors[name])}
        helperText={errors[name] || (readOnly ? READ_ONLY_HINT : '')}
        select={Boolean(options) && !readOnly}
        fullWidth
      >
        {options && [
          <MenuItem key="" value="">לא נבחר</MenuItem>,
          ...options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>),
        ]}
      </TextField>
    );
  };

  return (
    <SettingsPageLayout
      title={ACCOUNT_PAGE.label}
      onBack={() => confirmLeave(() => navigate('/'))}
      footer={status === 'ready' && (
        <>
          <SettingsSecondaryButton onClick={handleCancel} disabled={!isDirty || saving}>
            ביטול שינויים
          </SettingsSecondaryButton>
          <SettingsSaveButton onClick={handleSave} disabled={!isDirty} loading={saving} />
        </>
      )}
    >
      {status === 'loading' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {status === 'error' && (
        <Alert
          severity="error"
          sx={{ maxWidth: 520 }}
          action={<Button color="inherit" size="small" onClick={loadAccount}>נסי שוב</Button>}
        >
          לא הצלחנו לטעון את פרטי החשבון
        </Alert>
      )}

      {status === 'ready' && (
        <Box sx={{ display: 'grid', gap: 2, maxWidth: 520 }}>
          {visibleFields.map(renderField)}
        </Box>
      )}

      <SettingsSavedSnackbar open={savedOpen} onClose={() => setSavedOpen(false)} />

      <Snackbar
        open={Boolean(saveError)}
        autoHideDuration={6000}
        onClose={() => setSaveError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      </Snackbar>

      <UnsavedChangesDialog {...dialogProps} />
    </SettingsPageLayout>
  );
}
