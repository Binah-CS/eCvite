import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
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
    saveRecords: (phone, rows) =>
        apiClient.post('/recipients/save', {
            phone: phone,
            recipients: rows
        }),
  deleteRecipients: (phone, hashCodes) =>
      apiClient.post('/recipients/delete', { phone, hashCodes }),

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
  getActivityLogs: (phone) =>
      apiClient.get('/activity-logs', { params: { phone } }),
  createActivityLog: (phone, action, details = '') =>
      apiClient.post('/activity-logs', { phone, action, details }),
};

export default api;
