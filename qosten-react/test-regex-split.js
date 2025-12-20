const text = `Header
Question 1
Content 1
Question 2
Content 2`;

const regex = /(?=^Question\s+\d+)/m;
const parts = text.split(regex);

console.log('Parts count:', parts.length);
parts.forEach((p, i) => console.log(`Part ${i}:`, JSON.stringify(p)));
