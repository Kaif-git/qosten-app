
const bengaliLines = [
    "ক. জ্ঞানমূলক প্রশ্ন (১)",
    "খ. অনুধাবনমূলক প্রশ্ন (২)",
    "গ. প্রয়োগমূলক প্রশ্ন (৩)",
    "ঘ. উচ্চতর দক্ষতামূলক প্রশ্ন (৪)"
];

const regex = /^([a-dক-ঘ])[.)]\s*(.+)$/;

bengaliLines.forEach(line => {
    const match = line.match(regex);
    console.log(`Line: "${line}" -> Match: ${!!match}${match ? `, Letter: ${match[1]}` : ''}`);
});
