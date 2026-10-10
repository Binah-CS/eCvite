import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './index.css';
import { rtlCache } from './rtl';

// תופסות שגיאות JavaScript שלא קשורות לקריאת רשת בכלל (לא עוברות דרך ה-
// interceptor ב-api.js) - כמו קריסה ברינדור של רכיב לפני שה-ErrorBoundary תפס
// אותה, או שגיאה ב-callback/timeout. בלי זה, קריסה כזו הייתה "שקטה לגמרי" -
// לא רואים אותה בשום לוג, בדיוק המקרה שתואר (התחברות הצליחה, מעבר למסך הבא לא
// קרה, ושום שגיאת רשת לא נרשמה)
window.addEventListener('error', (event) => {
  console.error('✗ שגיאת JavaScript לא תפוסה', event.error ?? event.message, event);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('✗ Promise נדחה בלי טיפול (unhandled rejection)', event.reason, event);
});

// עיצוב אחיד לכל הכפתורים באתר: לבן עם מסגרת כחולה בהירה (כמו בסרגל הכלים של הטבלה הראשית) במקום המילוי הכחול הבהיר/הטקסט החיוור של ברירת המחדל של MUI -
// חל אוטומטית על כל <Button> בכל מסך, בלי לגעת בכל קובץ בנפרד. כפתורי אזהרה
// (color="error", כמו "שמור בכל זאת"/מחיקה) לא נגעו בהם בכוונה - נשארים אדומים
const theme = createTheme({
  direction: 'rtl',
  components: {
    MuiButton: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          padding: '6px 16px',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          backgroundColor: '#ffffff',
          color: '#1e293b',
          border: '1px solid #60a5fa',
          '&:hover': { backgroundColor: '#eff6ff', border: '1px solid #60a5fa' },
        },
        outlinedPrimary: {
          backgroundColor: '#ffffff',
          color: '#1e293b',
          borderColor: '#60a5fa',
          '&:hover': { backgroundColor: '#eff6ff', borderColor: '#60a5fa' },
        },
        textPrimary: {
          color: '#1e293b',
          border: '1px solid transparent',
          '&:hover': { backgroundColor: '#eff6ff', borderColor: '#60a5fa' },
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <CacheProvider value={rtlCache}>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </CacheProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
