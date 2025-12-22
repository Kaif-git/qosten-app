const lines = [
    "a. What is dye? (1)",
    "b. Why is the human body called as organic machine? (2)",
    "c. Find the distance of the image of the bar. (3)",
    "d. \"If the bar is placed at F point the image will be both real and virtual.\" Explain with ray diagram. (4)"
];

const metadataRegex = /^(?:\(?:\[)?(Subject|Topic|Chapter|Lesson|Board|বিষয়|বিষয়|অধ্যায়|পাঠ|বোর্ড)[:ঃ]\s*([^\\\]\n]+?)(?:\)?\])?$/i;
const boardRegex = /^(board|বোর্ড)\s*:/i;
const stimulusHeaderRegex = /^উদ্দীপক\s*:/i;
const questionHeaderRegex = /^প্রশ্ন\s*:/i;
const answerHeaderRegex = /^উত্তর\s*:/i;
const genericHeaderRegex = /^(Question|প্রশ্ন|Q\. |সৃজনশীল\s+প্রশ্ন)\s*[\d০-৯টে]*/i;
const answerIndicatorRegex = /^(answer|উত্তর|ans)\s*[:=]?\s*$/i;
const partMatchRegex = /^([a-dک-ઘ])[.)]\s*(.+)$/;

lines.forEach((line, index) => {
    console.log(`\nLine ${index + 3}: \"${line}\"`);
    
    if (metadataRegex.test(line)) console.log("  Matches metadataRegex");
    if (boardRegex.test(line)) console.log("  Matches boardRegex");
    if (stimulusHeaderRegex.test(line)) console.log("  Matches stimulusHeaderRegex");
    if (questionHeaderRegex.test(line)) console.log("  Matches questionHeaderRegex");
    if (answerHeaderRegex.test(line)) console.log("  Matches answerHeaderRegex");
    if (genericHeaderRegex.test(line) && line.length < 50) console.log("  Matches genericHeaderRegex");
    if (answerIndicatorRegex.test(line)) console.log("  Matches answerIndicatorRegex");
    
    const partMatch = line.match(partMatchRegex);
    if (partMatch) {
        console.log(`  Matches partMatchRegex! Letter: ${partMatch[1]}`);
    } else {
        console.log("  Does NOT match partMatchRegex");
        
        // Check the else conditions
        const isMetadataBrackets = line.match(/^\(?:\[.*\].*\)?$/);
        const isGenericMetadata = line.match(/^[a-z]+\s*:/i);
        const isBoardMetadata = line.match(/^(board|বোর্ড)\s*:/i);
        
        if (isMetadataBrackets) console.log("  Matches [.*]");
        if (isGenericMetadata) console.log("  Matches [a-z]+:");
        if (isBoardMetadata) console.log("  Matches board:");
        
        if (!isMetadataBrackets && !isGenericMetadata && !isBoardMetadata) {
            console.log("  Would be added to questionTextLines");
        } else {
            console.log("  Skipped as metadata");
        }
    }
});