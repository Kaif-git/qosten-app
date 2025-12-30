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

  // Fetch all questions by iterating in batches with deterministic loop control
  async fetchAllQuestions(onBatch) {
    const BATCH_SIZE = 500;
    const LIMIT_TOTAL = 100000;
    let allQuestions = [];
    const MAX_RETRIES = 3;

    // Helper for delay
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper for fetch with retry
    const fetchBatch = async (page, retryCount = 0) => {
      try {
        const url = `${API_BASE_URL}/questions?limit=${BATCH_SIZE}&page=${page}`;
        const response = await fetch(url);
        
        if (response.status === 503 || response.status === 429) {
           if (retryCount < MAX_RETRIES) {
             const delay = Math.pow(2, retryCount) * 1000;
             console.warn(`⚠️ ${response.status} at page ${page}, retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
             await sleep(delay);
             return fetchBatch(page, retryCount + 1);
           }
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch page ${page}: ${response.status} ${errorText}`);
        }
        
        return {
          data: await response.json(),
          totalCount: parseInt(response.headers.get('X-Total-Count') || '0')
        };
      } catch (error) {
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.warn(`⚠️ Network error at page ${page}, retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
          await sleep(delay);
          return fetchBatch(page, retryCount + 1);
        }
        throw error;
      }
    };

    console.log('📡 Fetching initial batch to determine total count...');
    const firstBatch = await fetchBatch(0);
    let totalCount = firstBatch.totalCount;
    
    const initialBatch = Array.isArray(firstBatch.data) ? firstBatch.data : (firstBatch.data.data || []);
    
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
        const result = await fetchBatch(page);
        const batch = Array.isArray(result.data) ? result.data : (result.data.data || []);
        
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

  async bulkCreateQuestions(questions, onProgress) {
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: []
    };

    // Use a batch size of 100 as requested
    const CHUNK_SIZE = 100; 
    const total = questions.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      console.log(`📤 Uploading batch ${Math.floor(i / CHUNK_SIZE) + 1} (${i + 1} to ${Math.min(i + CHUNK_SIZE, total)} of ${total})...`);
      
      try {
        // Assuming the API supports bulk creation at POST /questions/bulk or similar
        // If not, we fall back to parallel requests for the chunk
        const response = await fetch(`${API_BASE_URL}/questions/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (response.ok) {
          results.successCount += chunk.length;
          console.log(`✅ Batch ${Math.floor(i / CHUNK_SIZE) + 1} uploaded successfully.`);
        } else {
          // If bulk endpoint fails or doesn't exist, try individual uploads for this chunk
          console.warn(`⚠️ Bulk endpoint failed with ${response.status}, falling back to individual uploads for this batch...`);
          
          for (const q of chunk) {
            try {
              await this.createQuestion(q);
              results.successCount++;
            } catch (err) {
              results.failedCount++;
              results.errors.push({ id: q.id, error: err.message });
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error uploading batch ${Math.floor(i / CHUNK_SIZE) + 1}:`, error);
        // Fallback to individual for this batch on network error too
        for (const q of chunk) {
          try {
            await this.createQuestion(q);
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
