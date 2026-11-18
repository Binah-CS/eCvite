import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsPageLayout, {
  SettingsSaveButton,
  SAVE_FAILED_MESSAGE,
  SettingsErrorSnackbar,
  SettingsSavedSnackbar,
  SettingsSecondaryButton,
} from '../components/SettingsPageLayout';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import api from '../services/api';
import { getChangedFields, getVisibleAccountFields, toFormValues, validateAccount } from '../utils/accountDetails';
import {
  ENGLISH_SENDER_FIELDS,
  ENGLISH_SENDER_PLACEHOLDERS,
  HEBREW_SENDER_FIELDS,
  clearEnglishSender,
  clearHebrewSender,
  getHebrewSenderPlaceholders,
  getRequiredSenderFields,
  getVisibleSenderFields,
  hasEnglishDetails,
  hasHebrewSenderDetails,
  isSenderChanged,
  resolveSenderAddress,
  toSenderFormValues,
  toSenderPayload,
  validateSender,
} from '../utils/senderDetails';
import { ACCOUNT_PAGE } from '../utils/settingsPages';

function getLoggedUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

const FIX_FIELDS = 'יש שדות שצריך לתקן';
const READ_ONLY_HINT = 'משמש להתחברות ולא ניתן לשינוי';

const EMPTY_FIELD_LISTS = { editable: [], readOnly: [], required: [], sender: [] };

const sectionTitleSx = { fontWeight: 700, color: '#1e293b', mt: 2 };

// הודעת שגיאה אחת לשדה, בלי לגעת בשאר
function withoutKey(errors, name) {
  if (!errors[name]) return errors;
  const { [name]: _removed, ...rest } = errors;
  return rest;
}

function formatAddress({ street, houseNo, city }) {
  return [[street, houseNo].filter(Boolean).join(' '), city].filter(Boolean).join(', ');
}

export default function AccountDetailsPage() {
  const navigate = useNavigate();
  const [loggedUser] = useState(getLoggedUser);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  // מה מוצג, מה נעול, מה חובה ואילו שדות שולח קיימים - מגיע רק מהשרת
  // (ר' AccountFields / SenderFields ב-backend)
  const [fieldLists, setFieldLists] = useState(EMPTY_FIELD_LISTS);
  const [savedValues, setSavedValues] = useState({});
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [savedSender, setSavedSender] = useState({});
  const [senderValues, setSenderValues] = useState({});
  const [senderErrors, setSenderErrors] = useState({});
  const [showEnglish, setShowEnglish] = useState(false);
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
      sender: data.senderFields ?? [],
    };
    const formValues = toFormValues(data.user, [...lists.readOnly, ...lists.editable]);
    const senderFormValues = toSenderFormValues(data.sender, lists.sender);
    setFieldLists(lists);
    setSavedValues(formValues);
    setValues(formValues);
    setErrors({});
    setSavedSender(senderFormValues);
    setSenderValues(senderFormValues);
    setSenderErrors({});
    setShowEnglish(hasEnglishDetails(senderFormValues));
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
  const hebrewSenderFields = useMemo(() => getVisibleSenderFields(HEBREW_SENDER_FIELDS, fieldLists.sender), [fieldLists]);
  const englishSenderFields = useMemo(() => getVisibleSenderFields(ENGLISH_SENDER_FIELDS, fieldLists.sender), [fieldLists]);

  const changes = useMemo(
    () => getChangedFields(savedValues, values, fieldLists.editable),
    [savedValues, values, fieldLists.editable]
  );
  const accountChanged = Object.keys(changes).length > 0;
  const senderChanged = isSenderChanged(savedSender, senderValues, fieldLists.sender);
  const isDirty = accountChanged || senderChanged;
  const { confirmLeave, dialogProps } = useUnsavedChangesGuard(isDirty);

  // ה-fallback של השולח לפי מה שכרגע בטופס, כך שה-placeholder והרמז מתעדכנים תוך כדי
  // עריכת פרטי החשבון
  const fallbackAddress = formatAddress(resolveSenderAddress(null, values));
  const hebrewPlaceholders = getHebrewSenderPlaceholders(senderValues, values);
  const requiredSenderFields = getRequiredSenderFields(senderValues);

  const handleChange = (name) => (event) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => withoutKey(prev, name));
  };

  const handleSenderChange = (name) => (event) => {
    const { value } = event.target;
    setSenderValues((prev) => ({ ...prev, [name]: value }));
    // שגיאת "חובה" על רחוב/עיר תלויה בשדות אחרים - מנקים הכול ונבדק מחדש בשמירה
    setSenderErrors({});
  };

  // ריקון שדות השולח בעברית - חוזרים ל-fallback של פרטי החשבון. שינוי רגיל בטופס:
  // נשמר רק ב"שמור שינויים" ואפשר לבטל אותו ב"ביטול שינויים"
  const handleUseAccountDetails = () => {
    setSenderValues(clearHebrewSender);
    setSenderErrors({});
  };

  const handleRemoveEnglish = () => {
    setSenderValues(clearEnglishSender);
    setSenderErrors({});
    setShowEnglish(false);
  };

  const handleCancel = () => {
    setValues(savedValues);
    setErrors({});
    setSenderValues(savedSender);
    setSenderErrors({});
    setShowEnglish(hasEnglishDetails(savedSender));
  };

  const handleSave = async () => {
    const clientErrors = validateAccount(changes, fieldLists.required);
    const clientSenderErrors = senderChanged ? validateSender(senderValues) : {};
    if (Object.keys(clientErrors).length > 0 || Object.keys(clientSenderErrors).length > 0) {
      setErrors(clientErrors);
      setSenderErrors(clientSenderErrors);
      setSaveError(FIX_FIELDS);
      return;
    }

    setSaving(true);
    try {
      const response = await api.updateAccount(
        loggedUser?.phone,
        loggedUser?.hashCode,
        accountChanged ? changes : null,
        senderChanged ? toSenderPayload(senderValues, fieldLists.sender) : null
      );
      applyAccountResponse(response.data);
      setSavedOpen(true);
    } catch (err) {
      const data = err.response?.data;
      const hasFieldErrors = Boolean(data?.errors || data?.senderErrors);
      if (data?.errors) setErrors(data.errors);
      if (data?.senderErrors) setSenderErrors(data.senderErrors);
      setSaveError(hasFieldErrors ? FIX_FIELDS : SAVE_FAILED_MESSAGE);
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

  // placeholder = ה-fallback (בעברית: פרטי החשבון וישראל; באנגלית: רק Israel בארץ).
  // shrink כדי שה-placeholder ייראה גם בלי פוקוס - כך השדה "נראה מלא"
  const renderSenderField = ({ name, label }, { ltr = false } = {}) => {
    const placeholder = (ltr ? ENGLISH_SENDER_PLACEHOLDERS[name] : hebrewPlaceholders[name]) || '';
    return (
      <TextField
        key={name}
        label={label}
        value={senderValues[name] ?? ''}
        onChange={handleSenderChange(name)}
        required={requiredSenderFields.includes(name)}
        placeholder={placeholder}
        InputLabelProps={placeholder ? { shrink: true } : undefined}
        error={Boolean(senderErrors[name])}
        helperText={senderErrors[name] || ''}
        inputProps={ltr ? { dir: 'ltr' } : undefined}
        fullWidth
      />
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

          {hebrewSenderFields.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={sectionTitleSx}>פרטי שולח למעטפות</Typography>
              <Typography variant="body2" sx={{ color: '#475569', mt: -1 }}>
                השם והכתובת שיודפסו כשולח.
                {fallbackAddress && ` אם הכתובת ריקה, תודפס כתובת החשבון: ${fallbackAddress}`}
              </Typography>
              {hebrewSenderFields.map((field) => renderSenderField(field))}
              {hasHebrewSenderDetails(senderValues) && (
                <Box>
                  <Button onClick={handleUseAccountDetails}>שימוש בפרטי החשבון</Button>
                </Box>
              )}
            </>
          )}

          {englishSenderFields.length > 0 && !showEnglish && (
            <Box>
              <Button startIcon={<AddIcon />} onClick={() => setShowEnglish(true)}>
                הוספת פרטי שולח באנגלית
              </Button>
            </Box>
          )}

          {englishSenderFields.length > 0 && showEnglish && (
            <>
              <Typography variant="subtitle1" sx={sectionTitleSx}>פרטי שולח באנגלית</Typography>
              <Typography variant="body2" sx={{ color: '#475569', mt: -1 }}>
                למעטפות לנמענים בחו&quot;ל. אם ממלאים, רחוב ועיר הם חובה.
              </Typography>
              {englishSenderFields.map((field) => renderSenderField(field, { ltr: true }))}
              <Box>
                <Button color="error" onClick={handleRemoveEnglish}>הסרת הפרטים באנגלית</Button>
              </Box>
            </>
          )}
        </Box>
      )}

      <SettingsSavedSnackbar open={savedOpen} onClose={() => setSavedOpen(false)} />

      <SettingsErrorSnackbar message={saveError} onClose={() => setSaveError('')} />

      <UnsavedChangesDialog {...dialogProps} />
    </SettingsPageLayout>
  );
}
