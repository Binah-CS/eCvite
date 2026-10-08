# eCvite

מערכת לניהול רשימות מוזמנים לאירועים. המערכת מאפשרת הרשמה והתחברות, יבוא נתונים מ־Excel, עריכת נמענים בטבלה, שמירת הרשימה, יצוא/הדפסת מדבקות, ומעקב אחר פעולות משתמשים.

## יכולות עיקריות

- הרשמת משתמש והתחברות לפי שם וטלפון.
- ניהול רשימת נמענים אישית: הוספה, עריכה, מיון, סינון, מחיקה ושמירה.
- יבוא קובצי Excel, התאמת כותרות עמודות והמרת ערכים לשדות המערכת.
- שמירה מקומית בדפדפן כגיבוי כאשר השרת אינו זמין.
- בחירת שדות להדפסה, תצוגה מקדימה והדפסת מדבקות.
- יומן פעילות: פעולות נשמרות במסד הנתונים ומוצגות בדף הבית של המשתמש.

## טכנולוגיות

| שכבה | טכנולוגיות |
| --- | --- |
| ממשק | React 18, React Router, Material UI, Axios |
| Excel והדפסה | `xlsx`, ExcelJS, MUI Data Grid |
| שרת | Java 21, Spring Boot 3.2.5, Spring Web, Spring Data JPA |
| נתונים | PostgreSQL / Neon |
| פריסה | Docker ו־Render |

## מבנה הפרויקט

```text
eCvite/
├── frontend/                         # אפליקציית React
│   └── src/
│       ├── pages/                    # Login, Register, Dashboard, Print Preview, Terms
│       ├── components/               # טבלה, יבוא Excel, התאמת עמודות, חלון הדפסה
│       ├── services/api.js           # כל הפניות ל־API
│       └── utils/                    # התאמת כותרות ופריסת מדבקות
├── backend/src/main/java/.../
│   ├── controller/                   # מסלולי REST
│   ├── service/                      # לוגיקה עסקית
│   ├── repository/                   # גישה למסד הנתונים
│   └── entity/                       # User, Recipients, ActivityLog ועוד
├── backend/src/main/resources/       # הגדרות ונתוני seed לעמודות Excel
├── pom.xml                           # הגדרות Maven של השרת
├── Dockerfile                        # בניית השרת בקונטיינר
└── render.yaml                       # הגדרת שירות Render
```

## הפעלה מקומית

דרישות מוקדמות: Node.js (מומלץ LTS), npm, Java 21 ו־Maven. נדרש מסד PostgreSQL, או חשבון Neon.

1. הגדירו משתני סביבה לשרת:

```powershell
$env:NEON_DB_URL = 'jdbc:postgresql://<host>/<database>?sslmode=require'
$env:NEON_DB_USER = '<database-user>'
$env:NEON_DB_PASS = '<database-password>'
$env:MAIL_USERNAME = '<gmail-address>'
$env:MAIL_PASSWORD = '<app-password>'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000'
```

2. הפעילו את השרת, מהתיקייה הראשית:

```powershell
mvn spring-boot:run
```

השרת יאזין כברירת מחדל ב־`http://localhost:8080`.

3. בחלון נוסף הפעילו את הממשק:

```powershell
cd frontend
npm install
npm start
```

הממשק ייפתח ב־`http://localhost:3000` ויפנה ל־`http://localhost:8080/api`. עבור שרת מרוחק הגדירו בממשק `REACT_APP_API_BASE_URL`, למשל `https://example.onrender.com/api`.

## משתני סביבה

| משתנה | חובה | תיאור |
| --- | --- | --- |
| `NEON_DB_URL` | כן | כתובת JDBC של PostgreSQL/Neon |
| `NEON_DB_USER` | כן | משתמש למסד הנתונים |
| `NEON_DB_PASS` | כן | סיסמת מסד הנתונים |
| `MAIL_USERNAME` | בעת שימוש בדוא״ל | חשבון Gmail לשליחת הודעות |
| `MAIL_PASSWORD` | בעת שימוש בדוא״ל | App Password של Gmail |
| `CORS_ALLOWED_ORIGINS` | בפריסה | כתובות הממשק המורשות, מופרדות בפסיק |
| `REACT_APP_API_BASE_URL` | לא | כתובת בסיס ל־API בממשק; ברירת המחדל מקומית |

אין לשמור סיסמאות או כתובות חיבור בקוד או ב־Git.

## מסלולי API

| פעולה | Method + path | נתונים עיקריים |
| --- | --- | --- |
| התחברות | `POST /api/auth/login` | `name`, `phone` |
| הרשמה | `POST /api/auth/register` | פרטי משתמש |
| קבלת נמענים | `GET /api/recipients?phone=` | טלפון משתמש |
| שמירת נמענים | `POST /api/recipients/save` | `phone`, `recipients` |
| יבוא נמענים | `POST /api/recipients/import` | `phone`, `recipients` |
| מחיקת קישורי נמענים | `POST /api/recipients/delete` | `phone`, `hashCodes` |
| קבלת הגדרות עמודות | `GET /api/recipient-columns` | — |
| קבלת יומן פעילות | `GET /api/activity-logs?phone=` | עד 100 הפעולות האחרונות |
| כתיבת פעילות | `POST /api/activity-logs` | `phone`, `action`, `details` |

## זרימת העבודה של המשתמשת

1. נרשמת או מתחברת ונכנסת ללוח הבקרה.
2. מייבאת Excel או מוסיפה ומעדכנת נמענים בטבלה.
3. השינויים נשמרים תחילה בדפדפן; לחיצה על שמירה מעדכנת את השרת ומסד הנתונים.
4. בוחרת נמענים, פותחת הגדרות הדפסה וממשיכה לתצוגה מקדימה או להדפסה.
5. פותחת את ״יומן פעילות״ בתחתית לוח הבקרה כדי לראות את ההיסטוריה.

## יומן פעילות ומעקב

היומן נשמר בטבלת `activity_logs`, שנוצרת אוטומטית בזכות `spring.jpa.hibernate.ddl-auto=update`. כל רשומה כוללת:

- מזהה, טלפון המשתמש, סוג הפעולה, פרטים תיאוריים קצרים וזמן יצירה.
- עד 100 הפעולות האחרונות של המשתמש מוחזרות למסך.

הפעולות המתועדות כרגע: פתיחת לוח הבקרה, יבוא Excel לטבלה, פתיחת חלון ההדפסה, יציאה, שמירת נמענים, יבוא נמענים ומחיקת נמענים. פעולות שינוי נתונים סופיות (`save`, `import`, `delete`) נרשמות בשרת, ולכן נשמרות גם אם מקור הבקשה אינו הדשבורד.

לשמירה על פרטיות, פרטי הפעולה מתעדים רק ספירות ומידע תפעולי; הם אינם מכילים את שמות, כתובות או תוכן הרשומות של הנמענים.

## מסד הנתונים

הישויות העיקריות הן `User`, `Recipients`, `UserRecipients`, `ExcelColumns`, `EmailVerification` ו־`ActivityLog`. הקישור `UserRecipients` מאפשר לאותו נמען להיות משויך למשתמשים שונים, ומחיקת נמען למשתמש מסירה את הקישור שלו ולא בהכרח מוחקת את רשומת הנמען הגלובלית.

## פריסה

קובץ `render.yaml` מגדיר שירות Docker לשרת. יש להגדיר ב־Render את משתני `NEON_DB_URL`, `NEON_DB_USER`, `NEON_DB_PASS` ו־`CORS_ALLOWED_ORIGINS`. ה־Dockerfile הראשי בונה JAR באמצעות Maven ואז מריץ אותו על Java 21.

## הערות אבטחה להמשך

בגרסה הנוכחית הזיהוי מבוסס על שם וטלפון וה־API מקבל את מספר הטלפון בפרמטר/גוף הבקשה. לפני פריסה ציבורית מומלץ להוסיף אימות מלא (למשל Spring Security ו־JWT), הרשאות גישה ליומן הפעילות, הצפנה/הגנה על מידע אישי, והגבלה על קצב הבקשות.
