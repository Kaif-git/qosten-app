const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

export const questionApi = {
  // Fetch questions with optional pagination/filtering
  async fetchQuestions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.offset) searchParams.append('offset', params.offset);
    
    // Pass other filters if needed
    if (params.type) searchParams.append('type', params.type);
    if (params.subject) searchParams.append('subject', params.subject);
    
    const response = await fetch(`${API_BASE_URL}/questions?${searchParams.toString()}`);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch questions: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  // Fetch all questions (handling internal pagination if API limits)
  // For now, we try to fetch a large number or iterate
  async fetchAllQuestions() {
    // Attempt to fetch a large batch. If the API paginates, we might need a loop.
    // Assuming the API allows a high limit or returns all if no limit specified.
    // We'll try a safe high number.
    const response = await fetch(`${API_BASE_URL}/questions?limit=20000`); 
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch all questions: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    // Support both array return or { data: [...] } format
    return Array.isArray(data) ? data : (data.data || []);
  },

  async fetchQuestionsByIds(ids) {
    if (!ids || ids.length === 0) return [];
    // Assuming the API supports filtering by IDs via query param or POST
    // Using GET with comma-separated IDs for now
    const response = await fetch(`${API_BASE_URL}/questions?ids=${ids.join(',')}`);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch questions by IDs: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.data || []);
  },

  async createQuestion(questionData) {
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create question: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  async updateQuestion(id, questionData) {
    const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
      method: 'PUT', // Using PUT for full update, could be PATCH
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update question: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  async deleteQuestion(id) {
    const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete question: ${response.status} ${errorText}`);
    }
    return true;
  },
  
  // Bulk update helper
  async bulkUpdateQuestions(questions) {
     // Try a bulk endpoint first if it existed, but we'll use parallel requests for now
     // or a custom bulk endpoint if the user specified. 
     // We will use parallel promises with concurrency control could be better, 
     // but for simplicity in browser:
     
     // Check if there is a bulk endpoint? No info. 
     // We'll map to individual updates.
     
     const results = {
         successCount: 0,
         failedCount: 0,
         errors: []
     };

     // Process in chunks to avoid browser network limits
     const CHUNK_SIZE = 5;
     for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
         const chunk = questions.slice(i, i + CHUNK_SIZE);
         const promises = chunk.map(q => 
             this.updateQuestion(q.id, q)
                 .then(() => ({ success: true }))
                 .catch(err => ({ success: false, error: err }))
         );
         
         const chunkResults = await Promise.all(promises);
         chunkResults.forEach(r => {
             if (r.success) results.successCount++;
             else {
                 results.failedCount++;
                 results.errors.push(r.error);
             }
         });
     }
     
     return results;
  }
};
