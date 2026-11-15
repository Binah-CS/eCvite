import { Box, Typography, IconButton, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// רקע ה-body (index.css) - הכותרת הנעוצה צריכה רקע אטום, אחרת התוכן נראה מתחתיה בגלילה
const PAGE_BACKGROUND = '#f7f8fc';

// מבנה משותף לעמודי ההגדרות שנפתחים מתפריט המשתמש: כותרת עם חץ חזרה שנשארת נעוצה
// בראש המסך בזמן גלילה, התוכן, ואזור כפתורים (footer) שמודבק לתחתית המסך - תמיד
// גלוי, גם בזמן גלילה - בלי רקע/מסגרת סביבו, ישר על המסך
export default function SettingsPageLayout({ title, onBack, footer, children }) {
  return (
    <Box sx={{ width: '100%', minHeight: '100vh', px: 3, py: 2 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          bgcolor: PAGE_BACKGROUND,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          mb: 2,
        }}
      >
        <IconButton onClick={onBack}>
          <ArrowForwardIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {title}
        </Typography>
      </Box>

      <Box sx={{ pb: 10 }}>{children}</Box>

      {footer && (
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
            gap: 1.5,
          }}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}

const footerButtonSx = {
  py: 1,
  px: 3,
  fontSize: '0.95rem',
  fontWeight: 700,
};

// כפתור "שמור שינויים" של עמודי ההגדרות. loading מציג סימן טעינה ומונע לחיצה כפולה
export function SettingsSaveButton({ onClick, disabled = false, loading = false }) {
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
      sx={{
        ...footerButtonSx,
        bgcolor: '#dbeafe',
        color: '#1e293b',
        borderColor: '#60a5fa',
        '&:hover': { bgcolor: '#bfdbfe', borderColor: '#60a5fa' },
        '&.Mui-disabled': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' },
      }}
    >
      שמור שינויים
    </Button>
  );
}

// כפתור משני ליד השמירה (למשל "ביטול שינויים")
export function SettingsSecondaryButton({ onClick, disabled = false, children }) {
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      disabled={disabled}
      sx={{ ...footerButtonSx, bgcolor: '#fff', color: '#1e293b', borderColor: '#cbd5e1' }}
    >
      {children}
    </Button>
  );
}

// הודעת "נשמר בהצלחה" בראש המסך אחרי שמירה (נשארים באותו עמוד)
export function SettingsSavedSnackbar({ open, onClose }) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={2500}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity="success" icon={false} sx={{ bgcolor: '#60a5fa', color: '#fff' }}>
        נשמר בהצלחה
      </Alert>
    </Snackbar>
  );
}
