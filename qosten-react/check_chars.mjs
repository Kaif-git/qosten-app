
const regexPart = 'অধ্যায়';
const inputPart = 'অধ্যায়';

console.log('Regex Part:', regexPart, regexPart.split('').map(c => c.charCodeAt(0).toString(16)));
console.log('Input Part:', inputPart, inputPart.split('').map(c => c.charCodeAt(0).toString(16)));
console.log('Match?', regexPart === inputPart);
