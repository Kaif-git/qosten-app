
const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function fetchWithRetry(url, options = {}, retries = 5, backoff = 1000) {
  try {
    const response = await fetch(url, options);
    if ([429, 502, 503, 504].includes(response.status)) {
      if (retries > 0) {
        const delay = backoff + Math.random() * 500;
        console.warn(`⚠️ ${response.status} received from ${url}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      const delay = backoff + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

async function updateQuestion(id, questionData) {
    const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update question ${id}: ${response.status} ${text}`);
    }
    return await response.json();
}

async function fixNullImages() {
    console.log('🚀 Starting "null" image reference cleanup (v2 - safe mode)...');
    
    let page = 0;
    const limit = 500;
    let totalScanned = 0;
    let totalFixed = 0;
    
    const placeholders = [
        '[there is a picture]',
        '[ছবি আছে]',
        'picture',
        'image',
        'ছবি'
    ];
    
    const partPlaceholderPatterns = [
        /^\[there is a picture for part [a-d]\]$/i,
        /^\[ছবি আছে জন্য অংশ [ক-ঘ]\]$/i
    ];

    while (true) {
        console.log(`📥 Fetching page ${page}...`);
        const url = `${API_BASE_URL}/questions?page=${page}&limit=${limit}`;
        let response;
        try {
            response = await fetch(url);
            if (!response.ok) break;
        } catch (err) {
            console.error('Fetch error:', err);
            break;
        }
        const questions = await response.json();
        
        if (!questions || questions.length === 0) break;

        for (const q of questions) {
            let changed = false;
            const updatedQ = { ...q };

            const fieldsToCheck = [
                'image', 'imageUrl', 'image_url', 'questionimage', 'questionImage',
                'answerimage1', 'answerimage2', 'answerimage3', 'answerimage4',
                'answerImage1', 'answerImage2', 'answerImage3', 'answerImage4'
            ];

            fieldsToCheck.forEach(field => {
                const value = updatedQ[field];
                if (value === null || value === undefined) return;
                
                const sValue = String(value).trim().toLowerCase();
                
                const isExactMatch = ['null', 'undefined', 'none', ''].includes(sValue) || 
                                   placeholders.some(p => sValue === p.toLowerCase());
                
                const isPartPlaceholder = partPlaceholderPatterns.some(pattern => pattern.test(sValue));

                if (isExactMatch || isPartPlaceholder) {
                    console.log(`  ✨ Fixing ${field} for ID ${q.id}: "${value}" -> null`);
                    updatedQ[field] = null;
                    changed = true;
                }
            });

            if (updatedQ.parts && Array.isArray(updatedQ.parts)) {
                updatedQ.parts = updatedQ.parts.map((part, idx) => {
                    const updatedPart = { ...part };
                    ['image', 'answerImage', 'image_url'].forEach(pField => {
                        const value = updatedPart[pField];
                        if (value === null || value === undefined) return;
                        
                        const sValue = String(value).trim().toLowerCase();
                        
                        const isExactMatch = ['null', 'undefined', 'none', ''].includes(sValue) || 
                                           placeholders.some(p => sValue === p.toLowerCase());
                        
                        const isPartPlaceholder = partPlaceholderPatterns.some(pattern => pattern.test(sValue));

                        if (isExactMatch || isPartPlaceholder) {
                            console.log(`  ✨ Fixing parts[${idx}].${pField} for ID ${q.id}: "${value}" -> null`);
                            updatedPart[pField] = null;
                            changed = true;
                        }
                    });
                    return updatedPart;
                });
            }

            if (changed) {
                try {
                    await updateQuestion(q.id, updatedQ);
                    totalFixed++;
                    console.log(`✅ Successfully updated ID ${q.id}`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (err) {
                    console.error(`❌ Failed to update ID ${q.id}:`, err.message);
                }
            }
        }

        totalScanned += questions.length;
        console.log(`📊 Scanned: ${totalScanned}, Fixed so far: ${totalFixed}`);

        if (questions.length < limit) break;
        page++;
        
        if (totalScanned > 25000) break;
    }

    console.log('\n--- CLEANUP COMPLETE ---');
    console.log(`Total questions scanned: ${totalScanned}`);
    console.log(`Total questions fixed: ${totalFixed}`);
}

fixNullImages().catch(err => console.error(err));
