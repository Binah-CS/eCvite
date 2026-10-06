# תיעוד פרויקט eCvite

## מטרת המערכת

המערכת מאפשרת למשתמשים להירשם ולהתחבר, לנהל רשימת נמענים, לייבא אותה מקובץ Excel, לבצע התאמת עמודות, וליצור תצוגה והדפסה של מדבקות. צד הלקוח כתוב ב-React וצד השרת ב-Spring Boot עם PostgreSQL.

## מבנה וזרימת נתונים

`App` מפנה משתמש מחובר ללוח הבקרה. `DashboardPage` טוען נמענים מהשרת, או מהאחסון המקומי במקרה שאין חיבור. `DataTable` מציג וערוך את הרשומות. `ExcelImport` ממיר קובץ Excel לרשומות לפי הגדרות העמודות שמגיעות מ-`/api/recipient-columns`. שמירה שולחת את הרשומות אל `RecipientController`; הדפסה עוברת דרך `PrintModal` אל `PrintPreviewPage`.

## Frontend

### `frontend/src/index.js`

נקודת הכניסה ליישום. יוצרת ערכת MUI בכיוון RTL, עוטפת את `App` ב-`ThemeProvider`, ב-`CacheProvider` וב-`BrowserRouter`, ומרנדרת אותו אל רכיב `root` בדף.

### `frontend/src/rtl.js`

יוצר ומייצא `rtlCache`, מטמון Emotion המשתמש ב-`stylis-plugin-rtl` כדי להפוך סגנונות MUI לכיוון ימין לשמאל.

### `frontend/src/index.css`

מכיל את סגנונות הבסיס הגלובליים של הלקוח.

### `frontend/src/App.jsx`

- `App()` — בודקת אם קיים משתמש ב-`localStorage` ומגדירה את נתיבי הניווט: התחברות, הרשמה, תנאי שירות, לוח בקרה ותצוגת הדפסה. נתיב ברירת המחדל מפנה בהתאם למצב ההתחברות.

### `frontend/src/services/api.js`

מגדיר מופע Axios מול `/api` ומייצא את אובייקט `api`:

- `login(data)` — `POST /auth/login` עם שם וטלפון.
- `register(data)` — `POST /auth/register` עם פרטי משתמש.
- `getRecipients(phone)` — `GET /recipients?phone=...`.
- `saveRecords(phone, rows)` — `POST /recipients/save` עם הטלפון והרשומות.
- `deleteRecipients(phone, hashCodes)` — `POST /recipients/delete` להסרת הקישור של הנמענים מהמשתמש.
- `importRecipients(phone, recipients)` ו-`importRecords(phone, rows)` — שולחות רשומות לנתיב הייבוא.
- `getRecipientColumns()` — טוענת את הגדרות עמודות הנמענים.
- `addRecipientColumnAlias(technicalName, alias)` — מיועדת לשמירת כינוי חדש לעמודה. יש לוודא שקיים נתיב שרת תואם, משום שבבקר הנוכחי מופיע רק נתיב קריאה.
- `uploadExcel`, `sendVerificationCode`, `verifyCode` — עטיפות לבקשות שנועדו לתהליכי העלאה ואימות; אין להם בקרים תואמים בקוד הנוכחי.

### `frontend/src/services/excelColumnsCache.js`

- `getExcelColumns()` — מחזירה את הגדרות העמודות מהמטמון, או טוענת אותן מה-API בפעם הראשונה.
- `invalidateExcelColumnsCache()` — מאפסת את המטמון לאחר שנוסף כינוי, כדי שהייבוא הבא יקבל את ההגדרות המעודכנות.

### `frontend/src/utils/excelColumnMatcher.js`

- `normalize(text)` — מנקה רווחים וממיר ערך לטקסט אחיד לצורך השוואה.
- `getAliasList(column)` — ממירה את מחרוזת הכינויים של עמודה לרשימה נקייה.
- `matchExcelHeaders(headers, columns)` — מתאימה כותרות Excel לשם הטכני של עמודה לפי שם טכני, שם תצוגה או כינוי.
- `getPossibleValuesList(column)` — מחזירה את הערכים האופייניים לעמודה בצורה מנורמלת.
- `matchByValues(unmatchedHeaders, rows, columns)` — מנסה להתאים כותרות שלא זוהו לפי שיעור התאמה של הערכים שבתאים.
- `remapRows(rows, headerToKeyMap)` — בונה רשומות חדשות שבהן מפתחות הכותרות הוחלפו בשמות הטכניים.

### `frontend/src/utils/labelSheetLayout.js`

מרכז את מידות המדבקות והחישובים המשותפים לתצוגה ולהדפסה.

- `cmToPx(cm)` — ממירה סנטימטרים לפיקסלים.
- `getColumns(pageContentWidth, labelWidth, gapPx)` — מחשבת כמה מדבקות נכנסות בשורה.
- `getRealColumns(sizeKey)` — מחזירה את מספר העמודות בגודל מדבקה נתון.
- `getScaledLabelSizes(targetContentWidth)` — משנה את מידות המדבקות ביחס לרוחב תצוגה, עבור ההדמיה בחלון ההדפסה.
- `REAL_LABEL_SIZES`, `REAL_PAGE_CONTENT_WIDTH`, `REAL_GAP_PX` — קבועי המידות הפיזיות.

### `frontend/src/pages/HardCodePage.jsx`

מרכז טקסטים וקבועים של ממשק ההדפסה.

- `MODAL_TEXTS` — כותרות, אפשרויות וכפתורים בחלון ההדפסה; `NOT_AVAILABLE_ALERT(type)` מחזירה הודעה עבור אפשרות הדפסה שאינה זמינה.
- `PRINT_CONSTANTS` — טקסטים קבועים לתצוגה ולהדפסה.
- `FONT_OPTIONS` — רשימת הגופנים הניתנים לבחירה.
- `HardCodePage()` — דף עזר שמציג כותרת בכיוון RTL.

### `frontend/src/pages/LoginPage.jsx`

- `LoginPage()` — מציג טופס כניסה ושומר משתמש מחובר ב-`localStorage`.
- `handleSubmit(event)` — מאמת שם וטלפון, שולח בקשת התחברות, ומפנה ללוח הבקרה או מציג שגיאה. אם המשתמש לא נמצא, מוצג קישור להרשמה עם הערכים שכבר הוזנו.

### `frontend/src/pages/RegisterPage.jsx`

- `RegisterPage()` — מציג טופס הרשמה ושומר את שדות המשתמש והודעות האימות.
- `handleChange(event)` — מעדכן שדה בטופס ומאמת בזמן אמת טלפון וכתובת Gmail.
- `handleRegister(event)` — בודק טלפון, אימייל ואישור תנאי שירות, שולח הרשמה ושומר את המשתמש המחובר.

### `frontend/src/pages/Terms.jsx`

- `Terms()` — מציג את דף תנאי השירות. תוכנו כרגע מציין מקום.

### `frontend/src/pages/DashboardPage.jsx`

- `getLoggedUser()` — קוראת את המשתמש המחובר מ-`localStorage`.
- `getLocalRecords(phone)` — מחזירה את הרשומות המקומיות של משתמש לפי טלפון.
- `saveLocalRecords(phone, rows)` — שומרת רשומות במטמון המקומי.
- `DashboardPage()` — מחזיק את מצב הרשומות, הבחירה, השמירה וחלון ההדפסה ומחבר בין רכיבי הדף.
- `loadRecords()` — טוענת נמענים מהשרת; במקרה של כשל משתמשת בנתונים מקומיים.
- `handleAutoSaveLocal(updatedRows)` — שומר שינויים מקומיים ומסמן שקיימים שינויים שטרם נשמרו בשרת.
- `handleDeleteRows(idsToDelete)` — מסיר מהשרת קישורים של רשומות שכבר נשמרו ומעדכן את המטמון המקומי.
- `handleSave(updatedRows)` — שולח את הרשומות לשמירה; במקרה תקלה שומר אותן מקומית.
- `handleImport(rows)` — מוסיף לרשומות את נתוני הייבוא ונותן מזהים זמניים לשורות חדשות.
- `handleLogout()` — מוחק את המשתמש המחובר ומפנה לדף הכניסה.
- `getGreeting()` — מחזירה ברכה לפי השעה.
- אפקטי `useEffect` — טוענים נתונים, משחזרים מצב לאחר תצוגת הדפסה ומזהירים לפני יציאה עם שינויים שלא נשמרו.

### `frontend/src/pages/PrintPreviewPage.jsx`

- `getDisplayName(row)` — בוחר שם תצוגה קיים, או מרכיב שם משדות הנמען.
- `PrintPreviewPage()` — קורא את הגדרות ההדפסה ממצב הניווט, מציג רשת מדבקות ומפעיל הדפסת דפדפן. הוא גם שומר מצב ב-`sessionStorage` כדי לאפשר חזרה לשינוי הגדרות.
- `LABEL_LAYOUT` — הגדרת מספר עמודות, גודל וטיפוגרפיה עבור כל גודל מדבקה.

### `frontend/src/components/ColumnMatchDialog.jsx`

- `getSampleValues(rows, header, limit)` — מחזירה עד חמישה ערכים ייחודיים מעמודת Excel לצורך הצגה בדו-שיח.
- `ColumnMatchDialog(props)` — מציג כותרות שלא הותאמו ומאפשר למשתמש לבחור להן עמודת יעד או להתעלם מהן.
- `handleChange(header, value)` — מעדכנת את בחירת המשתמש עבור כותרת.
- `handleConfirm()` — מחזירה להורה את כל הבחירות.
- `IGNORE_VALUE` — ערך מיוחד שמסמן התעלמות מעמודה.

### `frontend/src/components/ExcelImport.jsx`

קורא את כל גיליונות הקובץ, מאחד את השורות, מתאים עמודות ומחזיר את התוצאה ל-`onImport`.

- `columnLetterFromIndex(index)` — ממירה אינדקס לאות עמודה בסגנון Excel.
- `getHeaderInfo(sheet, sheetName)` — שומרת את סדר הכותרות ויוצרת מזהים ותוויות ייחודיים לעמודות ללא כותרת.
- `applyRenameMap(rows, renameMap)` — מחליפה מפתחות גנריים (`__EMPTY`) במזהים ייחודיים.
- `applyDefaultCountry(rows)` — ממלאת את ישראל כאשר השדה `country` ריק.
- `normalizePrintField(rows)` — ממירה ייצוגים נפוצים של כן/לא לשדה בוליאני `print`.
- `applyBelongsToFromSheet(rows, rowSheetNames, confirmedSheets)` — ממלאת `belongsTo` בשם הגיליון, עבור גיליונות שהמשתמש אישר.
- `ExcelImport({ onImport })` — רכיב ממשק העלאת הקובץ וניהול דו-שיחי הייבוא.
- `runColumnMatching(...)` — טוענת הגדרות עמודות, מבצעת התאמה אוטומטית, ומציגה התאמה ידנית כאשר צריך.
- `handleFile(event)` — קוראת קובץ XLS/XLSX, אוספת נתונים מכל הגיליונות ומתחילה התאמה.
- `handleBelongsToConfirm()` — מאשרת את בחירת הגיליונות למילוי `belongsTo` וממשיכה בייבוא.
- `toggleBelongsToSheet(sheetName, shouldFill)` — משנה את בחירת המשתמש לגיליון.
- `handleDialogConfirm(choices)` — משלימה את ההתאמות הידניות, מנסה לשמור כינויים חדשים, ומעבירה את השורות להורה.
- `handleDialogCancel()` — ממשיכה בייבוא רק עם ההתאמות האוטומטיות.

### `frontend/src/components/PrintModal.jsx`

- `getLabelsPerPage(size)` — מחשבת כמה מדבקות נכנסות בדף ההדמיה.
- `MockLabel({ width, height })` — מציירת מדבקה ריקה בהדמיה.
- `LabelSheetPreview({ labelSize })` — מציג רשת מדבקות מוקטנת בחלון.
- `PrintModal({ open, onClose, selectedRows, records })` — דו-שיח דו-שלבי לבחירת סוג הדפסה והגדרות מדבקה.
- `handleNextStep()` — מתקדם לשלב ההגדרות או מציג הודעה אם נבחרה אפשרות שאינה נתמכת.
- `handlePrint()` — מעביר לתצוגת ההדפסה עם `autoPrint` פעיל.
- `handlePreview()` — מעביר לתצוגה מקדימה ללא פתיחת חלון הדפסה מיידית.

### `frontend/src/components/DataTable.jsx`

רכיב הטבלה המרכזי, מבוסס `MUI DataGrid`. הוא מציג עמודות דינמיות מהשרת, עריכה, מיון, סינון, ייבוא, ייצוא, בחירה, מחיקה ובדיקת שדות חובה.

- `createTextSortComparator(field, secondaryFields)` — יוצר משווה מיון טקסטואלי, עם שדות מיון משניים.
- `DataTable(props)` — מנהל את מצב הטבלה ומעביר אירועים להורה: `onSave`, `onAutoSave`, `onSelectionChange`, `onDeleteRows`, `onImport`, `onOpenPrint`.
- `handleNativeContextMenu(event)` — מחליף את תפריט ההקשר של הדפדפן בתפריט הטבלה.
- `handleMouseOver(event)` / `handleMouseLeave()` — עוקבים אחר שורת העכבר להצגת פעולות שורה.
- `handleSaveClick()` — בודק שגיאות לפני שמירה ומציג אפשרויות טיפול.
- `handleSaveAnyway()` — שומר גם אם נמצאו בעיות.
- `handleFixProblemsNow()` — עובר לתא הבעייתי הראשון.
- `handlePrintLabels()` — מבקש מההורה לפתוח את חלון ההדפסה.
- `handleDownloadExcel()` — מייצא את הרשומות המסוננות לקובץ Excel.
- `handleAddRow()` — מוסיף רשומה חדשה עם מזהה זמני.
- `handleDeleteRows()` — מבקש מחיקה של השורות הנבחרות ומעדכן את המצב.
- `handleDeleteSingleRow(id)` — מוחק שורה בודדת מפעולת המחיקה שמופיעה בעת ריחוף עליה.
- `handleCloseContextMenu()` — סוגר את תפריט ההקשר.
- `updateCellValue(id, field, value)` — מעדכן ערך של תא ומעביר את השורות המעודכנות לשמירה המקומית.
- `moveValueToAddressNote(id, field)` — מעביר תוכן של שדה כתובת אל `addressNote` ומנקה את השדה המקורי.
- `handleMoveToAddressNote()` — מעביר מידע רלוונטי להערת כתובת בהתאם לפעולת תפריט ההקשר.
- `renderAddressCell(params)` — מציג תא כתובת עם הטיפול המותאם לשדות כתובת.
- `renderTextCell(pickListField)` — יוצר renderer לתא טקסט, לרבות תפריט ערכים כשמדובר בשדה בחירה.
- `TextCell(params)` — עורך תא טקסט מותאם אישית.
- `openMenu()` / `closeMenu()` — פותחים וסוגרים תפריט בחירת ערכים עבור תא.
- `renderBooleanCell(params)` — מציג ועורך תא בוליאני, כגון שדה ההדפסה.
- `handleInputChange(event)` / `handleKeyDown(event)` — מטפלים בעריכת התא באמצעות מקלדת.
- `handleRemoveChip(chip)` — מסיר מסנן פעיל.
- `handleFullReset()` — מאפס מסננים, מיון ובחירה.
- `isValueInvalid(field, value)` — בודק אם ערך מפר את כללי העמודה.
- `handleFocusOut(event)` — מסיים עריכה ומעדכן את הטבלה.
- `findProblemCells(rows)` — מאתר תאים חסרים או בלתי תקינים, בעיקר בשדות חובה.
- `handleAddSecondarySort(field)` / `handleRemoveSecondarySort(field)` — מנהלים סדרי מיון משניים.
- קריאות `useMemo` ו-`useEffect` מחשבות עמודות, מסננים ותאים בעייתיים, ומשחזרות נראות עמודות ומיקוד בתיקון שגיאות.

## Backend

### `backend/src/main/java/com/example/excelapp/Application.java`

- `main(args)` — נקודת הכניסה של Spring Boot; מפעילה את השרת.

### `config/CorsConfig.java`

- `addCorsMappings(registry)` — מאפשר בקשות CORS אל `/api/**` מהמקורות המוגדרים ב-`app.cors.allowed-origins` ובשיטות HTTP הנדרשות.

### `controller/AuthController.java`

בסיס הנתיב: `/api/auth`.

- `login(request)` — `POST /login`; מחזיר משתמש לפי שם וטלפון, או 400/404.
- `register(user)` — `POST /register`; מוודא שהטלפון עדיין אינו קיים ושומר משתמש חדש.

### `controller/ExcelColumnController.java`

בסיס הנתיב: `/api/recipient-columns`.

- `ExcelColumnController(excelColumnRepository)` — הזרקת המאגר.
- `getColumns()` — `GET /api/recipient-columns`; מחזיר את הגדרות עמודות הנמענים לפי `defaultOrder` עולה.

### `controller/RecipientController.java`

בסיס הנתיב: `/api/recipients`.

- `saveRecipients(request)` — `POST /save`; יוצר מזהה hash לרשומות חדשות, מונע כפילויות, שומר רק נמענים חדשים ומקשר אותם למשתמש.
- `getRecipients(phone)` — `GET /`; מחזיר את הנמענים המקושרים למשתמש לפי טלפון.
- `insertRecipient(newRecipient)` — `POST /add`; יוצר hash ושומר נמען יחיד.
- `importRecipients(request)` — `POST /import`; שומר את רשומות הייבוא ומקשר אותן למשתמש, תוך מניעת קישורים כפולים.
- `deleteRecipients(request)` — `POST /delete`; מוחק רק את רשומות הקישור `user_recipients`, ולא את הנמען המשותף עצמו.

### `controller/UserController.java`

מחלקת שלד ללא נתיבים או פונקציות.

### `service/AuthService.java`

- `register(user)` — מחשב `hashCode` עבור המשתמש ושומר אותו.
- `findUser(name, phone)` — מאתר משתמש לפי טלפון ומשווה את השם לאחד משדות השם הפרטי.

### `service/ExcelService.java`

- `readExcel(file)` — קורא קובץ Excel באמצעות Apache POI וממיר את שורותיו לרשומות `Recipients`.

### `service/RecipientsService.java`

- `updateAllHashCodes()` — מעדכן מזהי hash של נמענים קיימים כאשר הם חסרים או צריכים חישוב מחדש.

### `service/UserService.java` ו-`service/EmailService.java`

מחלקות שלד ללא פונקציות פעילות.

### `repository/UserRepository.java`

- `findByPhone(phone)` — שאילתה נגזרת של Spring Data שמחזירה משתמש לפי טלפון.

### `repository/RecipientsRepository.java`

- `findByHashCode(hashCode)` — מחזירה נמען לפי המזהה שלו. פונקציות CRUD נוספות מגיעות מ-`JpaRepository`.

### `repository/ExcelColumnRepository.java`

- `findAllByOrderByDefaultOrderAsc()` — מחזירה את כל הגדרות העמודות לפי סדר ברירת המחדל.

### `repository/UserRecipientsRepository.java`

- `existsByUserAndRecipient(user, recipient)` — בודקת אם הקישור כבר קיים.
- `findByUser(user)` — טוענת את קישורי המשתמש ואת הנמענים שלהם באותה שאילתה.
- `findRecipientHashCodesByUser(user)` — מחזירה רק את מזהי הנמענים המקושרים למשתמש.
- `findByUserAndRecipient_HashCodeIn(user, hashCodes)` — מחזירה את הקישורים המתאימים למחיקה.

### `repository/EmailVerificationRepository.java`

ממשק שלד ללא פעולות.

### `entity/User.java`

ישות טבלת `users`. Lombok יוצר getters, setters ובנאים.

- `onCreate()` — מופעל לפני שמירת משתמש חדש ומגדיר `createdAt`.
- `generateHashCode()` — מחזיר SHA-256 של שמות המשתמש והטלפון, לשימוש כמפתח.

### `entity/Recipients.java`

ישות טבלת `recipients`, הכוללת פרטי שם, כתובת, סטטוס הדפסה ושדות מעקב.

- `generateRowHashCode()` — מחשב מזהה SHA-256 עקבי לפי נתוני הנמען.
- `setUser(user)` — פונקציית תאימות; הקשר התקין בין משתמש לנמען נשמר בישות `UserRecipients`.

### `entity/UserRecipients.java`

ישות טבלת הקישור `user_recipients`. מייצגת קשר רבים-לרבים בין משתמשים לנמענים, עם מזהה מספרי פנימי.

### `model/ExcelColumn.java`

ישות טבלת `excel_columns`. מתארת עמודה מותרת בייבוא: שם טכני, שם תצוגה, חובה/נראות, סדר, כינויים וערכים אפשריים. Lombok יוצר את פונקציות הגישה והבנאים.

### `entity/ExcelColumns.java`, `entity/EmailVerification.java`, `entity/UserRecipientId.java`

מחלקות שלד ללא שדות או פונקציות פעילות. שימי לב: `UserRecipientId.java` נמצא בחבילת `com.example.excelapp` ולא בחבילת `entity`.

### `dto/SaveRecipientsRequest.java`

אובייקט בקשה לשמירת או ייבוא נמענים: `phone` ו-`recipients`. Lombok `@Data` יוצר getters, setters ושיטות עזר.

### `dto/DeleteRecipientsRequest.java`

אובייקט בקשה למחיקת קישורי נמענים: `phone` ו-`hashCodes`.

### `dto/EmailRequest.java` ו-`dto/VerifyCodeRequest.java`

מחלקות שלד לתהליכי מייל ואימות קוד.

### `requests.http`

קובץ בקשות ידניות ל-IDE. הבקשה הקיימת שולחת `POST` ל-`http://localhost:3000/users`; היא אינה תואמת לנתיבי ה-API הפעילים המתועדים לעיל.

## קובצי תצורה ומשאבים

- `pom.xml` — תצורת Maven; Java 17, Spring Boot, JPA, Validation, PostgreSQL, Lombok ו-Apache POI. מקור Java מוגדר תחת `backend/src/main/java`.
- `backend/src/main/resources/application.properties` — הגדרות סביבת Spring, מסד הנתונים ו-CORS.
- `backend/src/main/resources/db/seed/excel_columns_seed.sql` — נתוני התחלה להגדרות עמודות Excel.
- `frontend/package.json` — תלויות וסקריפטים של לקוח React (`start`, `build`, `test`).
- `package-lock.json` ו-`frontend/package-lock.json` — נועלים את גרסאות התלויות של npm לצורך התקנה עקבית.
- `frontend/public/index.html` — מסמך ה-HTML הראשי שאליו React נטען.
- `Dockerfile` ו-`backend/Dockerfile` — הוראות בנייה והרצה בקונטיינר.
- `render.yaml` — תצורת פריסה לשירות Render.
- `.gitignore` ו-`.dockerignore` — רשימות קבצים שלא ייכללו ב-Git או ב-build של Docker.
- `excelapp.iml` — קובץ מודול של IntelliJ IDEA; הוא הגדרה של סביבת הפיתוח ואינו חלק מהלוגיקה של המערכת.
