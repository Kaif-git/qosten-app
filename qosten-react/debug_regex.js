
const lines = [
    "a. What is dye? (1)",
    "b. Why is the human body called as organic machine? (2)",
    "c. Find the distance of the image of the bar. (3)",
    "d. \"If the bar is placed at F point the image will be both real and virtual.\" Explain with ray diagram. (4)"
];

const regex = /^([a-dک-ઘ])[.)]\s*(.+)$/;

console.log("Testing regex:", regex);

lines.forEach(line => {
    const match = line.match(regex);
    console.log(`Line: "${line}"`);
    if (match) {
        console.log(`  MATCHED! Letter: '${match[1]}'`);
    } else {
        console.log(`  FAILED to match.`);
    }
});

