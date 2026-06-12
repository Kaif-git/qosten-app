import fs from 'fs';
const hierarchy = JSON.parse(fs.readFileSync('hierarchy_api.json', 'utf8'));

const bengaliSubjects = hierarchy.filter(s => /[\u0980-\u09FF]/.test(s.name));
console.log('Bengali-named subjects in API:', bengaliSubjects.length);

for (const s of bengaliSubjects) {
  console.log(`\n=== ${s.name} (${s.chapters.length} chapters) ===`);
  const hasBnChapters = s.chapters.filter(c => /[\u0980-\u09FF]/.test(c.name));
  console.log(`  Chapters with Bengali names: ${hasBnChapters.length}/${s.chapters.length}`);
  s.chapters.slice(0, 8).forEach(c => console.log(`  "${c.name}"`));
  if (s.chapters.length > 8) console.log(`  ... and ${s.chapters.length - 8} more`);
}
