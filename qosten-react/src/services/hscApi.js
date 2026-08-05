const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

// Helper for fetch with retry (mirrors questionApi)
const fetchWithRetry = async (url, options = {}, retries = 5, backoff = 1000, method = 'GET') => {
  try {
    const response = await fetch(url, options);
    if ([429, 502, 503, 504].includes(response.status)) {
      if (retries > 0) {
        const delay = backoff + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      const delay = backoff + Math.random() * 500;
      console.warn(`⚠️ Network error fetching ${url}. Retrying... (${retries} left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const hscApi = {
  // GET /api/hsc/meta - unique subjects, chapters, sources
  async fetchMeta() {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/meta`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch HSC meta: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  // GET /api/hsc/questions - list with filters & pagination
  async fetchQuestions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.append('page', params.page);
    if (params.limit !== undefined) searchParams.append('limit', params.limit);
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.chapter) searchParams.append('chapter', params.chapter);
    if (params.type) searchParams.append('type', params.type);
    if (params.source) searchParams.append('source', params.source);

    const url = `${API_BASE_URL}/api/hsc/questions?${searchParams.toString()}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch HSC questions: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const total = parseInt(response.headers.get('X-Total-Count') || '0', 10);
    return { questions: Array.isArray(data) ? data : (data.data || []), total };
  },

  // GET /api/hsc/questions/:id
  async fetchQuestion(id) {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions/${id}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch HSC question ${id}: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  // POST /api/hsc/questions - create single
  async createQuestion(data) {
    const body = { ...data };
    delete body.id;
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 5, 1000);
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to create HSC question: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },

  // POST /api/hsc/questions/batch - batch create
  async batchCreateQuestions(questions) {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questions),
    });
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to batch create HSC questions: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },

  // PUT /api/hsc/questions/:id - update single
  async updateQuestion(id, data) {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 5, 1000);
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to update HSC question ${id}: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },

  // DELETE /api/hsc/questions/:id - delete single
  async deleteQuestion(id) {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete HSC question ${id}: ${response.status} ${errorText}`);
    }
    return true;
  },

  // POST /api/hsc/questions/:id/flag - toggle flagged
  async toggleFlag(id) {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions/${id}/flag`, {
      method: 'POST',
    });
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to toggle flag ${id}: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },

  // POST /api/hsc/questions/:id/verify - toggle verified
  async toggleVerify(id) {
    const response = await fetchWithRetry(`${API_BASE_URL}/api/hsc/questions/${id}/verify`, {
      method: 'POST',
    });
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to toggle verify ${id}: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },
};
