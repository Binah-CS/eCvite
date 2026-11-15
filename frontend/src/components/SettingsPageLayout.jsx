import { Box, Typography, IconButton } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// מבנה משותף לעמודי ההגדרות שנפתחים מתפריט המשתמש: כותרת עם חץ חזרה, התוכן,
// ואזור כפתורים (footer) שמודבק לתחתית המסך - תמיד גלוי, גם בזמן גלילה - בלי
// רקע/מסגרת סביבו, ישר על המסך
export default function SettingsPageLayout({ title, onBack, footer, children }) {
  return (
    <Box sx={{ width: '100%', minHeight: '100vh', px: 3, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
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
