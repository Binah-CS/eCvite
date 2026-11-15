import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PrintPreviewPage from './pages/PrintPreviewPage'; // עמוד חדש שניצור
import RegisterPage from "./pages/RegisterPage";
import Terms from "./pages/Terms";
import ColumnManagementPage from './pages/ColumnManagementPage';
import { COLUMN_MANAGEMENT_PAGE, DEFAULT_SETTINGS_PAGE } from './utils/settingsPages';
function App() {

  // useLocation גורם ל-App להתעדכן בכל ניווט, כדי ש-loggedIn ייבדק מחדש אחרי login/logout
  useLocation();
  const loggedIn = Boolean(sessionStorage.getItem('user'));

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={loggedIn ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
      {/* הוספת הנתיב החדש */}
        <Route
            path="/print-preview"
            element={loggedIn ? <PrintPreviewPage /> : <Navigate to="/login" replace />}
        />
        <Route path="/terms" element={<Terms />} />
        <Route
            path={COLUMN_MANAGEMENT_PAGE.path}
            element={loggedIn ? <ColumnManagementPage /> : <Navigate to="/login" replace />}
        />
        {/* הנתיב הישן - קישורים קיימים (למשל מתוך הייבוא) ממשיכים לעבוד */}
        <Route
            path="/settings"
            element={<Navigate to={loggedIn ? DEFAULT_SETTINGS_PAGE.path : '/login'} replace />}
        />
      <Route path="*" element={<Navigate to={loggedIn ? '/' : '/login'} replace />} />

    </Routes>
  );
}

export default App;
