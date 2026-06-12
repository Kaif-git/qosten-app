function cleanResponse(text) {
    const markers = ["Question 1:", "[ID:"];
    let firstIndex = Infinity;
    for (const marker of markers) {
        const idx = text.indexOf(marker);
        if (idx !== -1 && idx < firstIndex) {
            firstIndex = idx;
        }
    }
    return firstIndex === Infinity ? text : text.slice(firstIndex);
}
console.log("Testing cleanResponse:");
console.log("Result 1: " + cleanResponse("I think these are good.\nQuestion 1:\n[ID: 123]..."));
console.log("Result 2: " + cleanResponse("Checking delimiters...\n[ID: 456]..."));
console.log("Result 3: " + cleanResponse("No markers here."));
