import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';

// עמודי ההגדרות שנפתחים מתפריט המשתמש - כל עמוד עם נתיב משלו. מקור אמת יחיד לשם,
// לנתיב ולאייקון: התפריט בדשבורד, הנתיבים ב-App וכותרות העמודים קוראים מכאן,
// כך ששינוי שם או נתיב נעשה במקום אחד
export const ACCOUNT_PAGE = {
  key: 'account',
  path: '/settings/account',
  label: 'פרטי חשבון',
  icon: PersonOutlineOutlinedIcon,
};

export const COLUMN_MANAGEMENT_PAGE = {
  key: 'columns',
  path: '/settings/columns',
  label: 'ניהול עמודות',
  icon: ViewColumnOutlinedIcon,
};

// סדר הפריטים בתפריט המשתמש (לפני "יציאה")
export const SETTINGS_PAGES = [ACCOUNT_PAGE, COLUMN_MANAGEMENT_PAGE];

// הנתיב הישן /settings (קישורים קיימים, ר' ExcelImport) מוביל לניהול העמודות
export const DEFAULT_SETTINGS_PAGE = COLUMN_MANAGEMENT_PAGE;
