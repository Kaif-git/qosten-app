
const lines = [
    "a. What is dye? (1)",
    "b. Why is the human body called as organic machine? (2)",
    "c. Find the distance of the image of the bar. (3)",
    "d. \"If the bar is placed at F point the image will be both real and virtual.\" Explain with ray diagram. (4)",
    "[There is a picture]",
    "Answer:",
    "d. If the object is placed at F, the focal point, its image can be both real and virtual."
];

function checkLine(line) {
    const isImagePlaceholder = 
      (line.startsWith('[') && line.endsWith(']') && (line.toLowerCase().includes('picture') || line.toLowerCase().includes('image') || line.includes('ছবি'))) ||
      (line.toLowerCase() === 'picture' || line.toLowerCase() === 'image' || line === 'ছবি');
    
    return isImagePlaceholder;
}

lines.forEach((line) => {
    const isImg = checkLine(line);
    console.log(`Line: \"${line}\" -> Image placeholder: ${isImg}`);
});
