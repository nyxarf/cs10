import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
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
export async function adminLogin(email, password) {
  const { data } = await api.post('/admin/login', { email, password });
  return data;
}

export async function adminDashboard() {
  const { data } = await api.get('/admin/dashboard');
  return data;
}

// Admin Category APIs
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

// ─── NEW: Full-spectrum moderation APIs ───────────────────────────────────────

/**
 * Get all community questions with optional status filter.
 * status: 'all' | 'open' | 'answered' | 'review' | 'hidden' | 'closed'
 */
export async function adminGetAllQuestions(params) {
  const { data } = await api.get('/admin/questions', { params });
  return data;
}

/**
 * Change a community question's status.
 * status: 'open' | 'answered' | 'review' | 'hidden' | 'closed'
 */
export async function adminUpdateQuestionStatus(id, status) {
  const { data } = await api.patch(`/admin/questions/${id}/status`, { status });
  return data;
}

/**
 * Get all community answers with optional status filter.
 * status: 'all' | 'live' | 'flagged' | 'hidden'
 */
export async function adminGetAllAnswers(params) {
  const { data } = await api.get('/admin/answers', { params });
  return data;
}

/**
 * Change a community answer's status.
 * status: 'live' | 'flagged' | 'hidden'
 */
export async function adminUpdateAnswerStatus(id, status) {
  const { data } = await api.patch(`/admin/answers/${id}/status`, { status });
  return data;
}

/**
 * Toggle pin state of a community question.
 */
export async function adminPinQuestion(id) {
  const { data } = await api.patch(`/admin/questions/${id}/pin`);
  return data;
}

/**
 * Toggle pin state of an FAQ.
 */
export async function adminPinFaq(id) {
  const { data } = await api.patch(`/admin/faqs/${id}/pin`);
  return data;
}

export default api;
