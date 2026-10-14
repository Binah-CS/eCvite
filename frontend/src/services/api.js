import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// עוטף כל קריאה שיוצאת דרך apiClient (כל הפונקציות למטה עוברות דרכו) - שורת לוג אחת
// "יוצא" ושורה אחת "חוזר" (הצלחה או שגיאה) - בלי להסתמך על שמישהי תזכור להוסיף
// console.log בכל קריאה חדשה בעתיד, וכדי לראות מיד אם ולמה קריאה נכשלה
apiClient.interceptors.request.use((config) => {
  console.log(`→ ${config.method?.toUpperCase()} ${config.url}`, config.params ?? config.data ?? '');
  return config;
}, (error) => {
  console.error('✗ בקשה נכשלה לפני שנשלחה:', error.message, error);
  return Promise.reject(error);
});

// מדפיסה לקונסול של הדפדפן את שורת הלוג שהשרת עצמו רשם (אם היא הגיעה ב-header,
// ר' RequestLoggingFilter.setBackendLogHeader בצד ה-Java) - כדי שאפשר יהיה לראות
// את לוגי ה-backend באותו מקום בדיוק כמו לוגי ה-frontend, גם באתר החי, בלי גישה
// לדשבורד השרת (Render) בכלל. מקודד ב-URL בצד השרת, אז צריך לפענח כאן בחזרה
function logBackendHeader(headers) {
  const raw = headers?.['x-backend-log'];
  if (!raw) return;
  try {
    console.log(`(שרת) ${decodeURIComponent(raw)}`);
  } catch {
    console.log(`(שרת) ${raw}`);
  }
}

apiClient.interceptors.response.use((response) => {
  console.log(`✓ ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`);
  logBackendHeader(response.headers);
  return response;
}, (error) => {
  const config = error.config ?? {};
  const status = error.response?.status;
  // מעבירים גם את אובייקט ה-error המלא (לא רק טקסט) - ב-Chrome DevTools אפשר
  // "להרחיב" אותו ולראות עקבות קריאה (stack trace) שקופצות ישר לקובץ ולשורה
  // ב-React שביצעו את הקריאה שנכשלה, לא רק מה השרת החזיר
  console.error(
    `✗ ${config.method?.toUpperCase()} ${config.url} -> ${status ?? 'network error'}`,
    error.response?.data ?? error.message,
    error
  );
  logBackendHeader(error.response?.headers);
  return Promise.reject(error);
});

const api = {
  login: (data) =>
      apiClient.post('/auth/login', data),

  register: (data) =>
      apiClient.post("/auth/register", data),
    sendVerificationCode: (email) =>
        apiClient.post("/auth/send-code", { email }),
    verifyCode: (email, code) =>
        apiClient.post("/auth/verify-code", {
            email,
            code
        }),
  getRecipients: (phone) =>
      apiClient.get('/recipients', { params: { phone } }),
    uploadExcel: (formData, phone) =>
        apiClient.post(
            `/recipients/upload-excel?phone=${phone}`,
            formData,
            {
                headers:{
                    "Content-Type":"multipart/form-data"
                }
            }
        ),
    saveRecords: (phone, rows, hashCodesToDelete) =>
        apiClient.post('/recipients/save', {
            phone: phone,
            recipients: rows,
            hashCodesToDelete
        }),

  importRecipients: (phone, recipients) =>
      apiClient.post('/recipients/import', { phone, recipients }),

  getRecipientColumns: () =>

      apiClient.get('/recipient-columns'),
    importRecords: (phone, rows) =>
        apiClient.post('/recipients/import', {
            phone,
            recipients: rows
        }),
  addRecipientColumnAlias: (technicalName, alias) =>
      apiClient.post(
          `/recipient-columns/${encodeURIComponent(technicalName)}/aliases`,
          { alias }
      ),

  updateColumnPreferences: (phone, columnPreferences) =>
      apiClient.put('/auth/column-preferences', { phone, columnPreferences }),

  getRecipientHistory: (hashCode, phone) =>
      apiClient.get(`/recipients/${encodeURIComponent(hashCode)}/history`, { params: { phone } }),
};

export default api;