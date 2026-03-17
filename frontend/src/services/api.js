import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 minutes for PDF processing/OCR
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.message
      || error.response?.data?.error
      || error.message
      || 'Erro desconhecido';
    console.error('API Error:', message, error.response?.data);
    return Promise.reject(error);
  }
);

const api = {
  // ========================
  // CASES
  // ========================

  /** Get all cases */
  getCases: () => apiClient.get('/cases'),

  /** Get a specific case with all data */
  getCase: (id) => apiClient.get(`/cases/${id}`),

  /** Create a new case */
  createCase: (name) => apiClient.post('/cases', { name }),

  /** Update case data fields (manual correction) */
  updateCaseData: (id, fields) => apiClient.put(`/cases/${id}/data`, { fields }),

  /** Delete a case */
  deleteCase: (id) => apiClient.delete(`/cases/${id}`),

  // ========================
  // DOCUMENTS / UPLOAD
  // ========================

  /** Upload a document for a case */
  uploadDocument: (caseId, file, documentType, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    return apiClient.post(`/cases/${caseId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000, // 3 minutes for OCR
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      }
    });
  },

  /** Get documents for a case */
  getDocuments: (caseId) => apiClient.get(`/cases/${caseId}/documents`),

  // ========================
  // CALCULATIONS
  // ========================

  /** Run calculations for a case */
  calculate: (caseId) => apiClient.post(`/cases/${caseId}/calculate`),

  /** Get the latest calculation result */
  getCalculation: (caseId) => apiClient.get(`/cases/${caseId}/calculation`),

  /** Generate and download DOCX */
  generateDocx: async (caseId) => {
    const response = await axios.post(
      `${BASE_URL}/cases/${caseId}/generate-docx`,
      {},
      {
        responseType: 'blob',
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'calculo_verbas_rescisórias.docx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true, filename };
  },

  // ========================
  // HEALTH
  // ========================
  healthCheck: () => apiClient.get('/health')
};

export default api;
