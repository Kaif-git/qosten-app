

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function fetchQuestions(page = 0, limit = 100) {
    const url = `${API_BASE_URL}/questions?page=${page}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.status}`);
    }
    return await response.json();
}

async function scanForNullImages() {
    console.log('📡 Starting scan for "null" image references...');
    let page = 0;
    const limit = 500;
    let totalScanned = 0;
    let foundCount = 0;
    const suspiciousQuestions = [];

    while (true) {
        console.log(`📥 Fetching page ${page}...`);
        const data = await fetchQuestions(page, limit);
        const questions = Array.isArray(data) ? data : (data.data || []);
        
        if (questions.length === 0) break;


        questions.forEach(q => {
            const fieldsToCheck = [
                'image', 'imageUrl', 'image_url', 'questionimage', 'questionImage',
                'answerimage1', 'answerimage2', 'answerimage3', 'answerimage4',
                'answerImage1', 'answerImage2', 'answerImage3', 'answerImage4'
            ];

            let isSuspicious = false;
            const nullFields = [];

            const placeholders = [
                '[there is a picture]',
                '[ছবি আছে]',
                'picture',
                'image',
                'ছবি',
                '[there is a picture for part',
                '[ছবি আছে জন্য অংশ'
            ];

            fieldsToCheck.forEach(field => {
                const value = q[field];
                if (value === null || value === undefined) return;
                
                const sValue = String(value).trim().toLowerCase();
                
                if (sValue === 'null' || sValue === 'undefined' || sValue === 'none' || sValue === '') {
                    isSuspicious = true;
                    nullFields.push(`${field}: "${value}"`);
                } else if (placeholders.some(p => sValue.includes(p.toLowerCase()))) {
                    isSuspicious = true;
                    nullFields.push(`${field}: "${value}" (placeholder)`);
                }
            });

            // Also check parts if they exist
            if (q.parts && Array.isArray(q.parts)) {
                q.parts.forEach((part, idx) => {
                    ['image', 'answerImage', 'image_url'].forEach(pField => {
                        const value = part[pField];
                        if (value === null || value === undefined) return;
                        
                        const sValue = String(value).trim().toLowerCase();
                        if (sValue === 'null' || sValue === 'undefined' || sValue === 'none' || sValue === '') {
                            isSuspicious = true;
                            nullFields.push(`parts[${idx}].${pField}: "${value}"`);
                        } else if (placeholders.some(p => sValue.includes(p.toLowerCase()))) {
                            isSuspicious = true;
                            nullFields.push(`parts[${idx}].${pField}: "${value}" (placeholder)`);
                        }
                    });
                });
            }


            if (isSuspicious) {
                foundCount++;
                suspiciousQuestions.push({
                    id: q.id,
                    type: q.type,
                    nullFields,
                    fullData: q // Store full data for inspection
                });
            }
        });

        totalScanned += questions.length;
        console.log(`✅ Scanned ${totalScanned} questions. Found ${foundCount} suspicious ones.`);

        if (questions.length < limit) break;
        page++;
        
        // Safety break for testing - let's scan a bit more
        if (page > 20) {
            console.log('⚠️ Safety break after 20 pages.');
            break;
        }
    }

    console.log('\n--- SCAN RESULTS ---');
    console.log(`Total questions scanned: ${totalScanned}`);
    console.log(`Suspicious questions found: ${foundCount}`);
    
    if (suspiciousQuestions.length > 0) {
        console.log('\nDetailed suspicious questions (first 20):');
        suspiciousQuestions.slice(0, 20).forEach(q => {
            console.log(`ID: ${q.id}, Type: ${q.type}`);
            q.nullFields.forEach(f => console.log(`  - ${f}`));
        });


        // Search specifically for empty string
        const emptyStrings = suspiciousQuestions.filter(q => 
            q.nullFields.some(f => f.includes(': ""'))
        );
        console.log(`\nQuestions with empty string image: ${emptyStrings.length}`);
        emptyStrings.slice(0, 5).forEach(q => {
            console.log(`ID: ${q.id}, Fields: ${q.nullFields.filter(f => f.includes(': ""')).join(', ')}`);
        });
    }
}

// node-fetch is not in package.json, so I might need to use global fetch if available or a different approach.
// React 19 / Node 18+ has global fetch.
scanForNullImages().catch(err => console.error(err));
