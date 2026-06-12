const API = 'https://questions-api.edventure.workers.dev';

// All unique suspect IDs from the previous scan
const PHYSICS_IDS = [
  1780923519162, 1780925898712, 1780925900359, 1780926362582,
  1780926500653, 1780926501687, 1780926502278, 1780927698009,
  1780927698398, 1780928490377, 1780928491048, 1780929807366,
  1780929809415, 1780929809776, 1780929810394, 1780931654124,
  1780932479024, 1780932479164
];

const CHEMISTRY_EN_IDS = [
  3, 6, 7, 1767415499565, 1767415867408, 1780858227864,
  1780858227968, 1780858228089, 1780858228198, 1780858228312,
  1780858228415, 1780858228530, 1780858228639, 1780858228986,
  1780858229092, 1780914599922, 1780914600778, 1780914601121,
  1780916079087, 1780916079423, 1780916081316, 1780916082704,
  1780916082973, 1780916088109, 1780916088382, 1780916088644,
  1780916389963, 1780916503748, 1780916506869, 1780916507552,
  1780916812984
];

const CHEMISTRY_BN_IDS = [
  1780914692864, 1780914693993, 1780916084988, 1780916413092,
  1780916479091, 1780916482389, 1780916483263
];

const BIOLOGY_IDS = [1776828033706, 1776828051427];

// Fetch full details for a list of IDs
async function getQuestions(ids, label) {
  const r = await fetch(API+'/questions?ids='+ids.join(',')+'&fields=id,subject,chapter,type,question_text,parts,correct_answer,is_flagged');
  const j = await r.json();
  const b = Array.isArray(j)?j:(j.data||[]);
  const flagged = [];
  for (const q of b) {
    console.log('\n--- '+label+' ID='+q.id+' | ch="'+(q.chapter||'?')+'" | flagged='+q.is_flagged+' ---');
    console.log('Q: '+(q.question_text||'').replace(/\n/g,' ').slice(0,120));
    let parts;
    try { parts = JSON.parse(q.parts); } catch(e) { parts = []; }
    if (Array.isArray(parts)) {
      for (const p of parts) {
        const l = (p.letter||p.label||'?').toUpperCase();
        if (l !== 'C' && l !== 'D') continue;
        const a = (p.answer||'').trim();
        console.log('  Part '+l+' ('+(p.marks||'?')+'mk): "'+a.slice(0,160)+'"');
        if (!a || a.length < 40 || /answer\s*(is\s+)?not\s+provided/i.test(a) || /no\s+answer/i.test(a) ||
            /not\s+provided/i.test(a) || /n\/a/i.test(a) ||
            /উত্তর.*নেই/i.test(a) || /উত্তর.*নাই/i.test(a) || /কোনো\s*উত্তর\s*নেই/i.test(a) ||
            /সমাধান\s*নেই/i.test(a) || /ব্যাখ্যা\s*নেই/i.test(a) ||
            /উৎস.*কোনো\s*উত্তর/i.test(a) || /মূল\s*উৎসে.*উত্তর\s*নেই/i.test(a) ||
            a === '---' || a === 'Element' || /For compound ---/.test(a) ||
            /^\s*\.\.\.\s*$/.test(a)) {
          flagged.push({id:q.id, part:l, answer:a, chapter:q.chapter, subject:q.subject});
        }
      }
    }
  }
  return flagged;
}

async function main() {
  const allFlags = [];
  allFlags.push(...await getQuestions(PHYSICS_IDS, 'Physics'));
  allFlags.push(...await getQuestions(CHEMISTRY_EN_IDS, 'Chem-EN'));
  allFlags.push(...await getQuestions(CHEMISTRY_BN_IDS, 'Chem-BN'));
  allFlags.push(...await getQuestions(BIOLOGY_IDS, 'Bio'));
  
  console.log('\n\n============ CONFIRMED BAD CQ PARTS ============');
  console.log('Total: '+allFlags.length);
  for (const f of allFlags) {
    console.log('ID='+f.id+' | '+f.subject+' | Part '+f.part+' | "'+(f.answer||'').slice(0,80)+'"');
  }
  
  // Write out for easy reference
  const fs = require('fs');
  fs.writeFileSync('bad_cq_parts.json', JSON.stringify(allFlags, null, 2));
  console.log('\nWritten to bad_cq_parts.json');
}
main().catch(console.error);
