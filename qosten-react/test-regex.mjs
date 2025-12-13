const testLine = "ব্যাখ্যা:";

console.log("Testing line:", testLine);
console.log("Line length:", testLine.length);
console.log("Line char codes:", Array.from(testLine).map(c => c.charCodeAt(0)));

const pattern = /^(explanation|explain|exp|ব্যাখ্যা|bekkha)\s*[:=]\s*/i;
console.log("\nPattern test result:", pattern.test(testLine));

const matchResult = testLine.match(pattern);
console.log("Match result:", matchResult);

// Test different variations
const testCases = [
  "ব্যাখ্যা:",
  "ব্যাখ্যা: ",
  "ব্যাখ্যা ::",
  "Bekkha:",
  "explanation:",
  "Explanation:"
];

testCases.forEach(tc => {
  const result = pattern.test(tc);
  console.log(`"${tc}" matches: ${result}`);
});
