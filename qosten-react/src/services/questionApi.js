const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

// Helper for fetch with retry
const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 1000) => {
  try {
    const response = await fetch(url, options);
    // Retry on Service Unavailable (503) or Too Many Requests (429)
    if (response.status === 503 || response.status === 429) {
      if (retries > 0) {
        console.warn(`⚠️ ${response.status} received from ${url}. Retrying in ${backoff}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
    }
    return response;
  } catch (error) {
    // Retry on network errors (e.g. Failed to fetch)
    if (retries > 0) {
      console.warn(`⚠️ Network error fetching ${url}. Retrying in ${backoff}ms... (${retries} retries left)`, error);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const questionApi = {
  // Fetch questions with optional pagination/filtering
  async fetchQuestions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.append('page', params.page);
    if (params.limit !== undefined) searchParams.append('limit', params.limit);
    if (params.offset !== undefined) searchParams.append('offset', params.offset);
    
    // Pass other filters
    if (params.type) searchParams.append('type', params.type);
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.chapter) searchParams.append('chapter', params.chapter);
    if (params.lesson) searchParams.append('lesson', params.lesson);
    if (params.board) searchParams.append('board', params.board);
    if (params.language) searchParams.append('language', params.language);
    
    const url = `${API_BASE_URL}/questions?${searchParams.toString()}`;
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch questions: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  async fetchHierarchy() {
    const response = await fetchWithRetry(`${API_BASE_URL}/hierarchy`);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch hierarchy: ${response.status} ${errorText}`);
    }
    return await response.json();
  },

  // Fetch all questions by iterating in batches with deterministic loop control
  async fetchAllQuestions(onBatch) {
    const BATCH_SIZE = 500;
    const LIMIT_TOTAL = 100000;
    let allQuestions = [];

    // Helper for delay
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    console.log('📡 Fetching initial batch to determine total count...');
    
    // Initial fetch using the helper
    let firstBatchData, firstBatchHeaders;
    try {
        const url = `${API_BASE_URL}/questions?limit=${BATCH_SIZE}&page=0`;
        const response = await fetchWithRetry(url);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch page 0: ${response.status} ${errorText}`);
        }
        firstBatchData = await response.json();
        firstBatchHeaders = response.headers;
    } catch (error) {
        console.error("Failed to fetch initial batch:", error);
        return [];
    }

    let totalCount = parseInt(firstBatchHeaders.get('X-Total-Count') || '0');
    const initialBatch = Array.isArray(firstBatchData) ? firstBatchData : (firstBatchData.data || []);
    
    // If header is missing but we got data, we might need to continue fetching
    if (totalCount === 0 && initialBatch.length > 0) {
      console.warn('⚠️ X-Total-Count header missing or 0, but data received. Falling back to empirical pagination.');
      // If we got exactly BATCH_SIZE, there is likely more. 
      // We will set a high virtual totalCount so the loop continues.
      if (initialBatch.length === BATCH_SIZE) {
          totalCount = LIMIT_TOTAL; 
      } else {
          totalCount = initialBatch.length;
      }
    }
    
    console.log(`📊 Database reports ${totalCount} total questions.`);
    
    // We target the minimum of totalCount and our hard limit
    const targetCount = Math.min(totalCount, LIMIT_TOTAL);
    const totalPages = Math.ceil(targetCount / BATCH_SIZE);
    
    console.log(`📡 Fetching up to ${targetCount} questions across ${totalPages || 1} pages...`);

    const seenIds = new Set();
    
    // Process the first batch data immediately
    const initialUniques = initialBatch.filter(q => {
      if (!q.id) return true;
      if (seenIds.has(q.id)) return false;
      seenIds.add(q.id);
      return true;
    });
    
    allQuestions = [...initialUniques];
    if (onBatch) onBatch(initialUniques);

    // If first batch was smaller than BATCH_SIZE, we are done
    if (initialBatch.length < BATCH_SIZE) {
        console.log('✅ First batch was partial, no more pages to fetch.');
        return allQuestions;
    }

    // Loop through the remaining pages
    for (let page = 1; page < totalPages || (totalCount === LIMIT_TOTAL); page++) {
      try {
        const url = `${API_BASE_URL}/questions?limit=${BATCH_SIZE}&page=${page}`;
        const response = await fetchWithRetry(url);
        
        if (!response.ok) {
           throw new Error(`Failed to fetch page ${page}: ${response.status}`);
        }

        const resultData = await response.json();
        const batch = Array.isArray(resultData) ? resultData : (resultData.data || []);
        
        if (batch.length === 0) break;

        const newQuestions = batch.filter(q => {
          if (!q.id) return true;
          if (seenIds.has(q.id)) return false;
          seenIds.add(q.id);
          return true;
        });

        if (newQuestions.length > 0) {
          allQuestions = [...allQuestions, ...newQuestions];
          if (onBatch) onBatch(newQuestions);
          console.log(`📥 Added ${newQuestions.length} unique questions. Total: ${allQuestions.length}/${LIMIT_TOTAL}`);
        }

        // If batch is partial, we reached the end of the real database
        if (batch.length < BATCH_SIZE) {
            console.log('✅ Reached end of database (partial batch).');
            break;
        }
        
        // Safety break
        if (allQuestions.length >= LIMIT_TOTAL) {
            console.log(`✅ Reached limit of ${LIMIT_TOTAL} questions.`);
            break;
        }

        await sleep(50);
      } catch (error) {
        console.error(`❌ Error on page ${page}:`, error);
        break; // Stop on error to avoid infinite loops
      }
    }

    console.log(`✅ Finished fetching. Total unique questions: ${allQuestions.length}`);
    return allQuestions;
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
    console.log('📤 [questionApi] createQuestion - sending full data:', JSON.stringify(questionData, null, 2));
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    const responseData = await response.json();
    console.log('📥 [questionApi] createQuestion - response:', responseData);
    if (!response.ok) {
        throw new Error(`Failed to create question: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },

  async updateQuestion(id, questionData) {
    console.log(`📤 [questionApi] updateQuestion - ID: ${id}, data:`, questionData);
    const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
      method: 'PUT', // Using PUT for full update, could be PATCH
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    const responseData = await response.json();
    console.log(`📥 [questionApi] updateQuestion - ID: ${id}, response:`, responseData);
    if (!response.ok) {
        throw new Error(`Failed to update question: ${response.status} ${JSON.stringify(responseData)}`);
    }
    return responseData;
  },

  async deleteQuestion(id) {
    console.log(`📤 [questionApi] deleteQuestion - ID: ${id}`);
    const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`📥 [questionApi] deleteQuestion - ID: ${id}, error:`, errorText);
        throw new Error(`Failed to delete question: ${response.status} ${errorText}`);
    }
    console.log(`📥 [questionApi] deleteQuestion - ID: ${id}, SUCCESS`);
    return true;
  },

  async bulkCreateQuestions(questions, onProgress) {
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [],
      questions: [] // Return the created questions
    };

    // Use a batch size of 100 as requested
    const CHUNK_SIZE = 100; 
    const total = questions.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      console.log(`📤 [questionApi] bulkCreateQuestions - batch ${Math.floor(i / CHUNK_SIZE) + 1} (${i + 1} to ${Math.min(i + CHUNK_SIZE, total)} of ${total})...`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/questions/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`📥 [questionApi] bulkCreateQuestions - batch ${Math.floor(i / CHUNK_SIZE) + 1} response:`, data);
          // Standardize response to an array of objects
          const addedBatch = Array.isArray(data) ? data : (data.data || data.questions || data.items || chunk);
          results.questions.push(...addedBatch);
          results.successCount += chunk.length;
          console.log(`✅ [questionApi] batch ${Math.floor(i / CHUNK_SIZE) + 1} uploaded successfully.`);
        } else {
          console.warn(`⚠️ [questionApi] bulk endpoint failed with ${response.status}, falling back to individual uploads...`);
          
          for (const q of chunk) {
            try {
              const newQ = await this.createQuestion(q);
              // Ensure we capture the object that contains the ID
              results.questions.push(newQ.data || newQ.question || newQ);
              results.successCount++;
            } catch (err) {
              results.failedCount++;
              results.errors.push({ id: q.id, error: err.message });
            }
          }
        }
      } catch (error) {
        console.error(`❌ [questionApi] error uploading batch ${Math.floor(i / CHUNK_SIZE) + 1}:`, error);
        for (const q of chunk) {
          try {
            const newQ = await this.createQuestion(q);
            results.questions.push(newQ.data || newQ.question || newQ);
            results.successCount++;
          } catch (err) {
            results.failedCount++;
            results.errors.push({ id: q.id, error: err.message });
          }
        }
      }

      if (onProgress) {
        onProgress(Math.min(i + CHUNK_SIZE, total), total);
      }
    }

    return results;
  },

  async batchCreateQuestions(questions, onProgress) {
    const CHUNK_SIZE = 150;
    const total = questions.length;
    console.log(`Starting upload of ${total} questions...`);

    let successCount = 0;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      
      try {
        const response = await fetch(`${API_BASE_URL}/questions/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk)
        });

        if (!response.ok) throw new Error(`Failed at chunk starting at ${i}`);
        
        const result = await response.json();
        successCount += chunk.length;
        console.log(`Uploaded ${Math.min(i + chunk.length, total)}/${total}...`);
        
        if (onProgress) {
          onProgress(Math.min(i + CHUNK_SIZE, total), total);
        }

      } catch (err) {
        console.error("Upload failed:", err);
        throw err;
      }
    }
    
    return { successCount };
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
