import axios from 'axios';

// Create a configured Axios instance for all admin API calls.
// The baseURL is relative so the same client works in dev and production.
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach the saved admin JWT token to every request if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response interceptor handles unauthorized access and forces login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear cached admin auth data and redirect to login when token is invalid.
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Admin Authentication
// Login and dashboard endpoints for admin user authentication and summary data.
export async function adminLogin(email, password) {
  const { data } = await api.post('/admin/login', { email, password });
  return data;
}

export async function adminDashboard() {
  const { data } = await api.get('/admin/dashboard');
  return data;
}

// Admin Category APIs
// CRUD operations for managing FAQ categories from the admin panel.
export async function getCategories() {
  const { data } = await api.get('/categories');
  return data;
}

export async function adminCreateCategory(body) {
  const { data } = await api.post('/admin/categories', body);
  return data;
}

export async function adminUpdateCategory(id, body) {
  const { data } = await api.put(`/admin/categories/${id}`, body);
  return data;
}

export async function adminDeleteCategory(id) {
  const { data } = await api.delete(`/admin/categories/${id}`);
  return data;
}

// Admin FAQ APIs
// Public and admin FAQ endpoints used for listing, creating, updating, and deleting FAQs.
export async function getFAQs(params) {
  const { data } = await api.get('/faqs', { params });
  return data;
}

export async function adminGetFaqs(page = 1) {
  const { data } = await api.get('/admin/faqs', { params: { page } });
  return data;
}

export async function adminCreateFAQ(body) {
  const { data } = await api.post('/admin/faqs', body);
  return data;
}

export async function adminUpdateFAQ(id, body) {
  const { data } = await api.put(`/admin/faqs/${id}`, body);
  return data;
}

export async function adminDeleteFAQ(id) {
  const { data } = await api.delete(`/admin/faqs/${id}`);
  return data;
}

export async function adminDeduplicateFaqs() {
  const { data } = await api.post('/admin/faqs/deduplicate');
  return data;
}

// Admin Moderation - Answer Submissions
// Endpoints for reviewing, approving, rejecting, and promoting submitted answers.
export async function adminGetModeration(params) {
  const { data } = await api.get('/admin/moderation', { params });
  return data;
}

export async function adminApproveSubmission(id, { answererXp, askerXp } = {}) {
  const { data } = await api.post(`/admin/moderation/${id}/approve`, { answererXp, askerXp });
  return data;
}

export async function adminRejectSubmission(id) {
  const { data } = await api.post(`/admin/moderation/${id}/reject`);
  return data;
}

export async function adminAutoModerate() {
  const { data } = await api.post('/admin/moderation/auto-moderate');
  return data;
}

export async function adminPromoteSubmission(id, { answererXp, askerXp } = {}) {
  const { data } = await api.post(`/admin/answers/${id}/promote`, { answererXp, askerXp });
  return data;
}

export async function adminGetPendingQuestions() {
  const { data } = await api.get('/admin/moderation/questions');
  return data;
}

export async function adminApproveQuestion(id, { askerXp } = {}) {
  const { data } = await api.post(`/admin/moderation/questions/${id}/approve`, { askerXp });
  return data;
}

export async function adminRejectQuestion(id) {
  const { data } = await api.post(`/admin/moderation/questions/${id}/reject`);
  return data;
}

// Admin Moderation - FAQ Proposals (from students)
// Endpoints to review and moderate submitted FAQ proposals.
export async function adminGetFaqProposals(params) {
  const { data } = await api.get('/admin/faq-proposals', { params });
  return data;
}

export async function adminApproveFaqProposal(id) {
  const { data } = await api.post(`/admin/faq-proposals/${id}/approve`);
  return data;
}

export async function adminRejectFaqProposal(id) {
  const { data } = await api.post(`/admin/faq-proposals/${id}/reject`);
  return data;
}

// Admin Analytics & Auditing
// Endpoints for analytics, query logs, and GROQ logs used in admin reports.
export async function adminGetAnalytics(params) {
  const { data } = await api.get('/admin/analytics', { params });
  return data;
}

export async function adminGetQueryLogs(params) {
  const { data } = await api.get('/admin/query-logs', { params });
  return data;
}

export async function adminGetGroqLogs(params) {
  const { data } = await api.get('/admin/groq-logs', { params });
  return data;
}

export async function adminCreateAdmin(body) {
  const { data } = await api.post('/admin/admins', body);
  return data;
}

// Admin Users APIs
// User management endpoints such as listing users and adjusting SP balances.
export async function adminGetUsers() {
  const { data } = await api.get('/admin/users');
  return data;
}

export async function adminAdjustUserSp(id, amount) {
  const { data } = await api.post(`/admin/users/${id}/sp`, { amount });
  return data;
}

export async function adminGetSpLedger(params) {
  const { data } = await api.get('/admin/sp-ledger', { params });
  return data;
}

// Community integrations for Master FAQs creation
// Endpoints used to generate community-driven master FAQ content.
export async function adminGetCommunityMasterCandidates() {
  const { data } = await api.get('/admin/community/master-candidates');
  return data;
}

export async function adminGenerateMasterContent(body) {
  const { data } = await api.post('/admin/community/generate-master', body);
  return data;
}

export async function adminCreateMasterFaq(body) {
  const { data } = await api.post('/admin/community/create-master-faq', body);
  return data;
}

export async function adminRunGlobalAiCluster(apiKey) {
  const { data } = await api.post('/admin/community/global-ai-cluster', { apiKey });
  return data;
}

export async function adminGetCommunityQuestions(params) {
  const { data } = await api.get('/admin/community/questions', { params });
  return data;
}

export async function adminDeleteCommunityQuestion(id) {
  const { data } = await api.delete(`/admin/community/questions/${id}`);
  return data;
}

export async function adminGetSpotlightedQuestions(params) {
  const { data } = await api.get('/admin/spotlight', { params });
  return data;
}

export default api;
