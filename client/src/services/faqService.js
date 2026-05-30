import apiClient from './apiClient';

/**
 * Frontend Service handling FAQ browsing and Yaksha AI chat interactions.
 */
class FAQService {
  /**
   * Validates a raw search query.
   */
  async validateQuery(query) {
    const response = await apiClient.post('/query/validate', { query });
    return response.data;
  }

  /**
   * Requests a synthesized answer from the Yaksha pipeline.
   */
  async askYaksha(query, history = []) {
    const response = await apiClient.post('/search/ask', { query, history });
    return response.data;
  }

  /**
   * Submit helpful/unhelpful feedback for analytics.
   */
  async submitFeedback(cacheId, helpful) {
    if (!cacheId) return;
    const response = await apiClient.post('/search/feedback', { cacheId, helpful });
    return response.data;
  }

  /**
   * Retrieves FAQ entries grouped by section.
   */
  async listFaqs({ section, search } = {}) {
    const response = await apiClient.get('/faqs', { params: { section, search } });
    return response.data;
  }

  /**
   * Retrieves the count metadata of active FAQ sections.
   */
  async listSections() {
    const response = await apiClient.get('/faqs/sections');
    return response.data;
  }
}

export default new FAQService();
