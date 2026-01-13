const userText = "উত্তর:";
const literalText = "উত্তর:";

function dump(s) {
    return s.split('').map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
}

console.log("User Text:", dump(userText));
console.log("Literal Text:", dump(literalText));

const userNormalized = userText.normalize('NFC');
const literalNormalized = literalText.normalize('NFC');

console.log("User Normalized:", dump(userNormalized));
console.log("Literal Normalized:", dump(literalNormalized));