# eCvite — Data Flow

**גרסה מתועדת:** מצב הקוד הנוכחי, 08.10.2026.  
**מקור חיבור ה־API:** `frontend/.env` מגדיר `REACT_APP_API_BASE_URL=http://localhost:8080/api`; בהיעדר הערך, זו גם ברירת המחדל בקוד.

## מבט כולל

```mermaid
flowchart LR
    U[משתמשת] --> F[React: state / טפסים / טבלה]
    F <--> SS[sessionStorage]
    F <--> LS[localStorage\nrecords-{phone}]
    F <--> API[Spring Boot API]
    API <--> DB[(Neon PostgreSQL)]
    F --> P[תצוגת הדפסה / הדפדפן]
```

הדפדפן הוא המקום הראשון שאליו נכנסים נתונים בזמן ההקלדה. נתוני נמענים נשמרים תחילה ב־React state ובגיבוי ב־`localStorage`; מעבר ל־DB נעשה רק בפעולת שמירה מפורשת. פרטי ההתחברות, העדפות תצוגה ומצב מעבר בין מסכים נשמרים ב־`sessionStorage` לתקופת הטאב בלבד.

## 1. נתונים שנשמרים מקומית בדפדפן

| אחסון | מפתח | תוכן | מי כותב וקורא | משך חיים / שימוש |
|---|---|---|---|---|
| `sessionStorage` | `user` | אובייקט המשתמש שחזר מהתחברות/הרשמה: פרטים אישיים, טלפון, `hashCode` ו־`columnPreferences` | `LoginPage`, `RegisterPage`, `DashboardPage`, `SettingsPage`, `PrintPreviewPage`, `App` | עד סגירת הטאב. משמש גם כבדיקת כניסה לנתיבים מוגנים. נמחק בהתנתקות. |
| `localStorage` | `records-{phone}` | מערך הנמענים האחרון במבנה הטבלה, לפי מספר טלפון של משתמשת | `DashboardPage` | נשאר לאחר סגירת הדפדפן. גיבוי מקומי ו־fallback בעת כשל טעינה/שמירה בשרת או כאשר השרת מחזיר רשימה ריקה. |
| `sessionStorage` | `savedSelectedIds` | מזהי השורות שנבחרו לפני יציאה לתצוגת ההדפסה | `PrintPreviewPage` → `DashboardPage` | שחזור בחירת השורות בעת חזרה להגדרות הדפסה; מוסר לאחר צריכתו. |
| `sessionStorage` | `fromPreview`, `returnFromPreview` | דגלי ניווט בין לוח הבקרה לתצוגה המקדימה | `PrintPreviewPage` ↔ `DashboardPage` | קובעים אם לפתוח מחדש את מודאל ההדפסה או לטעון את נתוני הגיבוי המקומי; מוסרים לאחר צריכה. |
| `sessionStorage` | `savedLabelSize`, `savedPrinter`, `savedFontType`, `savedDeliveryMethod` | בחירות ההדפסה האחרונות | `PrintPreviewPage` → `PrintModal` | נשמרות רק כדי לחזור לתצוגת הגדרות ההדפסה; `PrintModal` מנקה אותן בסגירה. |
| `sessionStorage` | `excelImportPending` | נתוני ייבוא Excel בהמתנה להתאמת עמודות | `ExcelImport` | נשמר לפני מעבר להגדרות, ומוחזר למודאל התאמת העמודות. |
| `sessionStorage` | `settingsReturnTo`, `reopenColumnMatch` | דגלים לחזרה מהגדרות למודאל התאמת עמודות של Excel | `ExcelImport` ↔ `SettingsPage` | קצרים; מסירים אותם לאחר החזרה. |
| זיכרון JavaScript | `cachedColumnsPromise` | Promise עם רשימת הגדרות עמודות | `excelColumnsCache.js` | מטמון בזיכרון העמוד בלבד; נעלם ברענון. מאופס אחרי יצירת alias חדש. |

### זרימת נמענים מקומית

1. `DashboardPage` טוען `GET /recipients?phone=...`.
2. אם ה־API מחזיר נמענים, הם נכנסים ל־`records` ב־React state. אם הקריאה נכשלת, או אם התקבלה רשימה ריקה, נטען `localStorage['records-{phone}']`.
3. עריכת תא, הוספת שורה, ייבוא Excel, שחזור היסטוריה או העברת ערך להערת כתובת מפעילים `onAutoSave`: הנתונים מתעדכנים גם ב־state וגם ב־`localStorage`; הדגל `isTableDirty` מסמן שהם טרם נשמרו בשרת.
4. בשמירה מוצלחת, תגובת השרת מחליפה את השורות בזיכרון ונכתבת גם לגיבוי המקומי. בשמירה שנכשלה, הגרסה שניסו לשמור נשארת ב־`localStorage` בלבד.

## 2. שמירה ל־DB

### משתמשות והעדפות

| פעולה במסך | API | כתיבה ב־DB | תוצאה בדפדפן |
|---|---|---|---|
| הרשמה | `POST /auth/register` עם פרטי טופס המשתמשת | יצירת רשומה ב־`users`; נוצר `hash_code` ו־`created_at` | אובייקט המשתמש מהתגובה נשמר ב־`sessionStorage.user`. |
| עדכון העדפות עמודות/סדר/הדפסה | `PUT /auth/column-preferences` עם `phone`, `columnPreferences` | עדכון `users.column_preferences` (JSON כמחרוזת) | התגובה, או גרסת fallback מקומית במקרה כשל, נכתבת ל־`sessionStorage.user`. |
| התאמת כותרת Excel חדשה לשדה | `POST /recipient-columns/{technicalName}/aliases` | עדכון `excel_columns.aliases` | מטמון העמודות בזיכרון מאופס; ה־alias זמין בייבוא הבא. |

### נמענים

פעולת **"שמור את כל המוזמנים"** שולחת `POST /recipients/save` עם:

```json
{
  "phone": "טלפון המשתמשת",
  "recipients": ["כל השורות המוצגות, ללא שדה id מקומי"],
  "hashCodesToDelete": ["מזהי נמענים למחיקה"]
}
```

בשרת הפעולה היא טרנזקציונית:

1. מאתרים את המשתמשת לפי `phone`; אם אינה קיימת מוחזר `404`.
2. מגדירים את המשתמשת הפעילה להיסטוריית השינויים.
3. מנתקים קודם את רשומות `user_recipients` ש־`hashCode` שלהן מופיע ב־`hashCodesToDelete`. הנמען עצמו אינו נמחק מטבלת `recipients`.
4. שורה שכבר מכילה `hashCode` עוברת עדכון ב־`recipients`.
5. לשורה חדשה השרת מחשב `hashCode` מ־`man`, `woman`, `lastName`, `phone`, `city`, `street`, `houseNo` ו־`duplicateSalt`; אם קיימת רשומה עם אותו hash הוא מאחד את `belongsTo`, אחרת יוצר נמען חדש.
6. נוצרים או נשמרים הקישורים ב־`user_recipients`, המחברים בין המשתמשת לנמענים שלה.
7. מוחזרת רשימת הנמענים שנשמרו. הפרונט משתמש בה כדי להחליף מזהים זמניים במזהי hash אמיתיים ולגבות את התוצאה מקומית.

### ייבוא Excel

קובץ Excel נקרא כולו בדפדפן באמצעות `ExcelImport`: הגיליונות, הכותרות והשורות עוברים התאמת עמודות, נרמול שדה `print`, מילוי `country` כברירת מחדל והשלמת `belongsTo` לפי בחירת המשתמשת. לאחר מכן `onImport` ממזג את השורות עם הטבלה ושומר אותן מקומית. **הייבוא מהמסך אינו כותב ל־DB מיד**; השמירה מתבצעת רק בלחיצה על שמירת כל המוזמנים.

בשרת קיימים גם הנתיבים `POST /recipients/import` ו־`POST /recipients/add`. לקוח ה־API מגדיר גם `uploadExcel` עבור `POST /recipients/upload-excel`, אך לשרת אין endpoint כזה בגרסה הנוכחית. רכיב הייבוא הפעיל אינו קורא לאף אחד מן הנתיבים האלה.

## 3. טעינה מה־DB

| מתי | API | מקור ב־DB | יעד בפרונט |
|---|---|---|---|
| התחברות | `POST /auth/login` | `users`, חיפוש לפי טלפון; השירות בודק גם שם | `sessionStorage.user`, ואז ניווט ללוח הבקרה. |
| פתיחת לוח הבקרה | `GET /recipients?phone=...` | `user_recipients` עבור המשתמשת, ואז `recipients` המקושרים | `records` ב־React state; במקרה כשל/תוצאה ריקה נטען הגיבוי המקומי. |
| התחברות או הרשמה מוצלחת; שינוי העדפות | `GET /recipient-columns` | `excel_columns` ממוינים | הגדרת העמודות והתאמת כותרות Excel. הקריאה נעשית פעם אחת לפני פתיחת לוח הבקרה ונשענת על מטמון בזיכרון; רענון נוסף מתבצע רק אחרי שמירת העדפות. |
| פתיחת היסטוריה לשורה | `GET /recipients/{hashCode}/history?phone=...` | `recipients_history` | מודאל היסטוריה זמני ב־`DataTable`; בחירת גרסה לשחזור משנה תחילה את הטבלה המקומית בלבד. |
| רענון אחרי שמירת העדפות | תגובת `PUT /auth/column-preferences` | `users.column_preferences` המעודכן | החלפת אובייקט המשתמש ב־`sessionStorage`. |

ה־DB המוגדר ב־backend הוא PostgreSQL של Neon, דרך `NEON_DB_URL`, `NEON_DB_USER` ו־`NEON_DB_PASS`. ה־frontend אינו מקבל פרטי גישה אלה; הוא מתקשר רק עם בסיס כתובת ה־API מה־`.env` שלו.

## 4. נתונים שמוזנים במסך ואינם נשמרים כלל

| מסך / פעולה | נתונים | היכן הם חיים | מתי הם נעלמים |
|---|---|---|---|
| התחברות | `name`, `phone`, הודעת שגיאה | state של `LoginPage` | ניווט, רענון או עזיבת המסך. בעת מעבר להרשמה רק שם וטלפון נשלחים ב־`location.state`. |
| הרשמה לפני שליחה | כל שדות הטופס, `emailError`, `phoneError`, `agreeTerms`, `termsError` | state של `RegisterPage` | רענון/עזיבה או לאחר ההרשמה. רק שליחה מוצלחת יוצרת משתמשת ב־DB. |
| טבלה ומודאלים | מיון, סינון, שדה חיפוש, סדר מיון משני, בחירת שורות, תורים לבדיקת תקינות/כפילויות, תפריטי הקשר, הודעות הצלחה/שגיאה | state של `DataTable` או `DashboardPage` | בדרך כלל ברענון או ביציאה מהמסך. בחירת שורות נשמרת זמנית רק במסלול תצוגת ההדפסה. |
| הדפסה | השורות שנבחרו, גודל מדבקה, מדפסת, גופן, אופן מסירה ו־`autoPrint` | `location.state` בעת מעבר ל־`/print-preview` | נעלמים ברענון של דף התצוגה המקדימה; חלק מהבחירות נשמרות זמנית ב־`sessionStorage` רק כדי לחזור למודאל. |
| הורדת Excel | מערך השורות המסוננות שמומר לקובץ | זיכרון הדפדפן וקובץ הורדה מקומי של המשתמשת | לא נשלח לשרת ולא נכתב ל־DB. |
| שליחת קוד אימות | `api.js` מגדיר `sendVerificationCode` ו־`verifyCode` | אין מסך פעיל או controller מקביל בגרסה הנוכחית | אין זרימת נתונים פעילה במערכת. |

הערה חשובה: ערכי נמענים שלא נשלחו בפעולת שמירה אינם מגיעים ל־DB, אך בדרך כלל כן נכתבים ל־`localStorage`. לכן הם אינם "לא נשמרים בכלל" אלא נשמרים מקומית בלבד.

## 5. פערים שהתגלו בזרימה הנוכחית

1. `DashboardPage.handleSave` משתמש במשתנה `hashCodesToDelete`, אך משתנה כזה אינו מוגדר בפונקציה; הפרמטר המתקבל הוא `extraDeleteHashCodes`. לכן פעולת השמירה עלולה להיכשל ב־`ReferenceError` לפני בקשת ה־API. במקרה זה הנתונים נשמרים ב־`localStorage` דרך נתיב השגיאה ולא ב־DB.
2. `DashboardPage.handleDeleteRows` קורא ל־`api.deleteRecipients`, אך לפונקציית `api` אין מתודה זו, וגם בשרת אין `DELETE` מתאים. פעולת המחיקה במסך עלולה להיכשל; הנתיב הנתמך בפועל למחיקה הוא `hashCodesToDelete` בתוך `POST /recipients/save`.
3. קיים אי־התאמה בין התיעוד הישן לבין הקוד: האפליקציה משתמשת ב־`sessionStorage` למשתמש המחובר, לא ב־`localStorage`.
4. לקוח ה־API מגדיר `POST /recipients/upload-excel`, אך אין לו controller תואם ב־backend. קריאה אליו תחזיר `404`.
