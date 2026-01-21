
/**
 * Migration utility to normalize CQ image storage.
 * Moves images from parts[].image into top-level answerimage1-4 columns.
 */

export const getMigrationPreview = (questions) => {
    console.log(`🔍 getMigrationPreview: Scanning ${questions.length} questions...`);
    const candidates = [];
    const mapping = {
        'c': 'answerimage1',
        'd': 'answerimage2',
        'a': 'answerimage3',
        'b': 'answerimage4'
    };

    questions.forEach(q => {
        if (q.type !== 'cq') return;

        const changes = [];
        const parts = q.parts || [];
        
        if (q.id === 1767512332375 || q.id === "1767512332375") {
            console.log(`🔎 Deep Scan for Q#${q.id}:`, {
                id: q.id,
                rawKeys: Object.keys(q).filter(k => k.startsWith('_raw')),
                rawValues: {
                    r1: q._rawAnswerimage1,
                    r2: q._rawAnswerimage2,
                    r3: q._rawAnswerimage3,
                    r4: q._rawAnswerimage4
                },
                partsInfo: parts.map(p => ({
                    letter: p.letter,
                    hasImg: !!(p.image || p.answerImage)
                }))
            });
        }

        parts.forEach(part => {
            const letter = part.letter?.toLowerCase();
            const colName = mapping[letter];
            if (!colName) return;

            const partImg = part.image || part.answerImage;
            
            // Check if the actual database column is empty
            // We standardize to lowercase 'i' in Answerimage
            const rawColProp = `_rawAnswerimage${colName.slice(-1)}`;
            const isColumnActuallyEmpty = !q[rawColProp];

            if (partImg && isColumnActuallyEmpty) {
                console.log(`  🚩 Candidate found! ID: ${q.id} Part: ${letter} -> ${colName}`);
                changes.push({
                    part: letter.toUpperCase(),
                    targetColumn: colName,
                    imageUrl: partImg
                });
            }
        });

        if (changes.length > 0) {
            candidates.push({
                question: q,
                changes: changes
            });
        }
    });

    console.log(`🔍 Scan complete. Found ${candidates.length} candidates.`);
    return candidates;
};

export const performImageMigration = async (candidates, updateBulk) => {
    if (candidates.length === 0) return { success: true, count: 0 };
    
    const updates = candidates.map(c => {
        const updated = { ...c.question };
        c.changes.forEach(change => {
            updated[change.targetColumn] = change.imageUrl;
        });
        // Clear old part images to ensure normalization
        updated.parts = (updated.parts || []).map(p => ({ ...p, image: null, answerImage: null }));
        return updated;
    });

    try {
        await updateBulk(updates);
        return { success: true, count: updates.length };
    } catch (err) {
        console.error("Migration failed:", err);
        throw err;
    }
};

