
import fs from 'fs';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function fetchWithRetry(url, options = {}, retries = 5, backoff = 1000) {
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
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

async function restore() {
    console.log('💊 Starting image restoration (v8 - gs regex - utf16le)...');
    const logContent = fs.readFileSync('cleanup_logs.txt', 'utf16le');
    
    const restorations = new Map();
    
    // Use dotAll flag (s) to match across lines
    const regex = /Fixing\s+([\w\.\[\]]+)\s+for\s+ID\s+(\d+):\s+"([^"]+)"\s*->\s*null/gs;
    
    let match;
    const matches = logContent.matchAll(regex);
    for (const match of matches) {
        const field = match[1];
        const id = match[2];
        const url = match[3].replace(/\s+/g, '');
        
        if (url.includes('supabase.co') || url.startsWith('data:image')) {
            if (!restorations.has(id)) {
                restorations.set(id, []);
            }
            restorations.get(id).push({ field, url });
        }
    }

    console.log(`📋 Found ${restorations.size} questions to restore.`);

    let restoredCount = 0;
    for (const [id, changes] of restorations.entries()) {
        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`);
            if (!response.ok) {
                console.error(`❌ Could not fetch question ${id}`);
                continue;
            }
            const q = await response.json();
            
            let changed = false;
            changes.forEach(change => {
                if (change.field.startsWith('parts[')) {
                    const partIdxMatch = change.field.match(/parts\[(\d+)\]\.(\w+)/);
                    if (partIdxMatch) {
                        const idx = parseInt(partIdxMatch[1]);
                        const pField = partIdxMatch[2];
                        if (q.parts && q.parts[idx]) {
                            q.parts[idx][pField] = change.url;
                            changed = true;
                        }
                    }
                } else {
                    q[change.field] = change.url;
                    changed = true;
                }
            });

            if (changed) {
                const updateRes = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(q)
                });

                if (updateRes.ok) {
                    restoredCount++;
                    console.log(`✅ Restored ID ${id} (${changes.length} fields)`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                } else {
                    console.error(`❌ Failed to restore ID ${id}: ${updateRes.status}`);
                }
            }
        } catch (err) {
            console.error(`❌ Error restoring ID ${id}:`, err.message);
        }
    }

    console.log(`\n🎉 Restoration complete. Restored ${restoredCount} questions.`);
}

restore().catch(err => console.error(err));
