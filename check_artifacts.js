const fs = require('fs');
const path = require('path');
const d = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_ENGLISH_new.txt';
const c = fs.readFileSync(d, 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/Incorrect|Check readability|Check formatting|\*\*Question|Let's |Verdict|source says|the solution says|mark it as|filler words|Correct\.$|Check formatting|of a test paper/.test(l)) {
    console.log(`${i+1}: ${l.substring(0,120)}`);
  }
}
console.log('---Total lines:', lines.length);
