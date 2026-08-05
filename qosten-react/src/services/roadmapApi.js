const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function getJson(url, retries = 5, backoff = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if ([429, 502, 503, 504].includes(response.status) && attempt < retries) {
        const delay = backoff * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt < retries) {
        const delay = backoff * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

export const roadmapApi = {
  // GET /api/roadmap/list?subject=&chapter=&status=
  async listRoadmaps(params = {}) {
    const sp = new URLSearchParams();
    if (params.subject) sp.append('subject', params.subject);
    if (params.chapter) sp.append('chapter', params.chapter);
    if (params.status) sp.append('status', params.status);
    const qs = sp.toString();
    const url = `${API_BASE_URL}/api/roadmap/list${qs ? '?' + qs : ''}`;
    const data = await getJson(url);
    return Array.isArray(data) ? data : (data.roadmaps || []);
  },

  // GET /api/roadmap/:id  -> roadmap with nodes (each w/ sessions + episodes)
  async getRoadmap(id) {
    return await getJson(`${API_BASE_URL}/api/roadmap/${id}`);
  },

  // GET /api/roadmap/by-subject-chapter?subject=&chapter=
  async getRoadmapBySubjectChapter(subject, chapter) {
    const sp = new URLSearchParams({ subject, chapter });
    return await getJson(`${API_BASE_URL}/api/roadmap/by-subject-chapter?${sp.toString()}`);
  },

  // GET /questions/:id  (SSC question detail, no /api prefix)
  async fetchQuestionById(id) {
    return await getJson(`${API_BASE_URL}/questions/${id}`);
  },

  // Fetch several SSC questions by id in parallel (concurrency-limited)
  async fetchQuestionsByIds(ids) {
    const out = [];
    const CONCURRENCY = 8;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map(id => this.fetchQuestionById(id)));
      results.forEach(r => { if (r.status === 'fulfilled' && r.value && !r.value.error) out.push(r.value); });
    }
    return out;
  },
};
