import fs from 'fs';
import path from 'path';

const BASE = 'D:/OpenClawAutomations/Gemma bangla Processing';
const FINAL = path.join(BASE, 'final', 'Shuva');
const REVIEW = path.join(BASE, 'review_output', 'Shuva');
const CHAPTER = path.join(BASE, 'chapters', 'Shuva');

fs.mkdirSync(FINAL, { recursive: true });

// ─── 1. Compile MCQs ─────────────────────────────────────────────────────────
function extractMCQs() {
  const text = fs.readFileSync(path.join(REVIEW, 'MCQ_review.txt'), 'utf8');
  
  const groups = [];
  
  // Section 1: "Questions to Review" within Batch 1 (Q1-Q29)
  const qToReviewMarker = '--- MCQ QUESTIONS TO REVIEW ---';
  const qToReviewStart = text.indexOf(qToReviewMarker);
  if (qToReviewStart !== -1) {
    let endIdx = text.indexOf('=== MCQ Review Batch 2 ===', qToReviewStart);
    if (endIdx === -1) endIdx = text.length;
    let section = text.substring(qToReviewStart + qToReviewMarker.length, endIdx);
    // Remove "Summary of Changes" if present
    const sumIdx = section.indexOf('**Summary of Changes:**');
    if (sumIdx !== -1) section = section.substring(0, sumIdx);
    groups.push(section.trim());
  }
  
  // Section 2: "MCQ Review Batch 2" (Q30-Q59)
  const batch2Marker = '=== MCQ Review Batch 2 ===';
  const batch2Start = text.indexOf(batch2Marker);
  if (batch2Start !== -1) {
    let endIdx = text.indexOf('=== MCQ Review Batch 3 ===', batch2Start + batch2Marker.length);
    if (endIdx === -1) endIdx = text.length;
    let section = text.substring(batch2Start + batch2Marker.length, endIdx);
    
    // Remove leading batch lines (Q1-Q14 are repeated from original batches, we want Q30-Q59)
    // Look for the actual new questions starting
    // The section has: Q1-Q14 (repeats), then Q30-Q59 (new)
    const q30Marker = '\nQuestion 30:';
    const q30Idx = section.indexOf(q30Marker);
    if (q30Idx !== -1) {
      section = section.substring(q30Idx);
    } else {
      // Try to find where new questions start by finding after the summary
      const newSectionMarker = '---\n\n';
      // Just take everything after the first --- \n\n that follows a summary
    }
    
    // Remove trailing summary
    const sumIdx = section.indexOf('**Summary of Modifications:**');
    if (sumIdx !== -1) section = section.substring(0, sumIdx);
    groups.push(section.trim());
  }
  
  // Section 3: "MCQ Review Batch 3" (Q60-Q89)
  const batch3Marker = '=== MCQ Review Batch 3 ===';
  const batch3Start = text.indexOf(batch3Marker);
  if (batch3Start !== -1) {
    let endIdx = text.indexOf('=== MCQ Review Batch 4 ===', batch3Start + batch3Marker.length);
    if (endIdx === -1) endIdx = text.length;
    let section = text.substring(batch3Start + batch3Marker.length, endIdx);
    
    // Find where new questions start (Q60 onwards)
    // The section has Q1-Q8 (repeats), Q60-Q89 (new)
    const q60Marker = '\nQuestion 60:';
    const q60Idx = section.indexOf(q60Marker);
    if (q60Idx !== -1) {
      section = section.substring(q60Idx);
    }
    
    // Remove trailing summary
    const sumIdx = section.indexOf('**Summary of Modifications:**');
    if (sumIdx !== -1) section = section.substring(0, sumIdx);
    groups.push(section.trim());
  }
  
  // Count total questions
  let combined = groups.join('\n\n');
  const qCount = (combined.match(/Question \d+:/g) || []).length;
  console.log(`MCQ: ${qCount} questions extracted (${combined.length} chars)`);
  
  fs.writeFileSync(path.join(FINAL, 'Shuva_MCQ_final.txt'), combined, 'utf8');
}

// ─── 2. Compile CQs ──────────────────────────────────────────────────────────
function extractCQs() {
  const cqOrig = fs.readFileSync(path.join(CHAPTER, 'CQ.txt'), 'utf8');
  const cqReview = fs.readFileSync(path.join(REVIEW, 'CQ_review.txt'), 'utf8');
  
  // Find Q4 in review (reproduced version)
  const q4ReviewMarker = 'Question 4:\n[Subject: বাংলা প্রথম পত্র]';
  const q4Start = cqReview.indexOf(q4ReviewMarker);
  let q4End = cqReview.indexOf('=== CQ Review Batch 2 ===', q4Start);
  if (q4End === -1) q4End = cqReview.length;
  const q4ReviewContent = cqReview.substring(q4Start, q4End).trim();
  
  // Find Q4 in original (the one to replace)
  const q4OrigMarker = 'Question 4:\n[Subject: বাংলা প্রথম পত্র]\n[Chapter: সুভা]\n[Lesson: সুভা]\n[Board: সি. বো. ২৪]';
  const q4OrigStart = cqOrig.indexOf(q4OrigMarker);
  const q4OrigEndMarker = '--- Batch 2 ---';
  const q4OrigEnd = cqOrig.indexOf(q4OrigEndMarker, q4OrigStart);
  
  let finalCq = cqOrig.substring(0, q4OrigStart) + q4ReviewContent + '\n\n' + cqOrig.substring(q4OrigEnd);
  
  // Find Q16 in review (reproduced version)
  const q16ReviewMarker = 'Question 16:\n[Subject: বাংলা প্রথম পত্র]';
  const q16ReviewStart = cqReview.indexOf(q16ReviewMarker);
  let q16ReviewEnd = cqReview.indexOf('=== CQ Review Batch 4 ===', q16ReviewStart);
  if (q16ReviewEnd === -1) q16ReviewEnd = cqReview.length;
  const q16ReviewContent = cqReview.substring(q16ReviewStart, q16ReviewEnd).trim();
  
  // Find Q16 in original (the one to replace)
  const q16OrigMarker = 'Question 16:\n[Subject: বাংলা প্রথম পত্র]\n[Chapter: সুভা]\n[Lesson: সুভা]\n[Board: চট্টগ্রাম ক্যান্টনমেন্ট পাবলিক কলেজ]';
  const q16OrigStart = finalCq.indexOf(q16OrigMarker);
  const q16OrigEndMarker = '--- Batch 5 ---';
  const q16OrigEnd = finalCq.indexOf(q16OrigEndMarker, q16OrigStart);
  
  finalCq = finalCq.substring(0, q16OrigStart) + q16ReviewContent + '\n\n---\n\n' + finalCq.substring(q16OrigEnd);
  
  // Remove any empty leading lines
  finalCq = finalCq.replace(/^\s*\n/, '');
  
  fs.writeFileSync(path.join(FINAL, 'Shuva_CQ_final.txt'), finalCq, 'utf8');
  console.log(`CQ: Written ${finalCq.length} chars`);
}

// ─── 3. Compile SQs ──────────────────────────────────────────────────────────
function extractSQs() {
  const sqOrig = fs.readFileSync(path.join(CHAPTER, 'SQ.txt'), 'utf8');
  
  // Remove the trailing "Category 2: MCQ" header and everything after
  const mcqHeader = '### **Category 2: MCQ (Multiple Choice Questions)**';
  let idx = sqOrig.indexOf(mcqHeader);
  // Try without the ###
  if (idx === -1) idx = sqOrig.indexOf('**Category 2: MCQ');
  if (idx === -1) idx = sqOrig.indexOf('Category 2');
  
  let finalSq = idx !== -1 ? sqOrig.substring(0, idx).trim() : sqOrig.trim();
  
  fs.writeFileSync(path.join(FINAL, 'Shuva_SQ_final.txt'), finalSq, 'utf8');
  console.log(`SQ: Written ${finalSq.length} chars`);
}

extractMCQs();
extractCQs();
extractSQs();
console.log('All compiled successfully!');
