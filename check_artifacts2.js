const fs = require('fs');
const path = require('path');
const d = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_ENGLISH_new.txt';
const c = fs.readFileSync(d, 'utf-8');
const lines = c.split('\n');
// Print lines around Q5 and Q6 to check artifacts
let inBadZone = false;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('Question 0')) {
    inBadZone = !inBadZone;
    if (!inBadZone) { inBadZone = false; }
    else { inBadZone = true; }
    console.log(`${i+1}: ${l}`);
    continue;
  }
  if (/Actually, |Following the |Based on the |Incorrect|Power of a Point|approximately|the logic of the figure/.test(l)) {
    console.log(`${i+1}: ${l.substring(0,150)}`);
  }
}
console.log('---Lines:', lines.length);
