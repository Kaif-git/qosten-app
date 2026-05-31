import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir, writeFile, mkdir } from 'fs/promises';
import { join, extname, basename, resolve, parse } from 'path';
import sharp from 'sharp';

const MAPPING_FILE = 'image_mapping.json';
const DOWNLOAD_DIR = 'downloaded_images';
const ENHANCED_DIR = 'enhanced_images';
const STATE_FILE = 'enhance_state.json';

function loadJSON(filePath) {
  try { return JSON.parse(readFileSync(filePath, 'utf-8')); }
  catch { return null; }
}

async function enhanceImage(inputPath, outputPath) {
  const img = sharp(inputPath);
  const metadata = await img.metadata();

  let pipeline = img;

  // 1. Convert to grayscale if color (better OCR clarity for diagrams)
  if (metadata.channels && metadata.channels >= 3) {
    const stats = await img.clone().stats();
    const isBw = stats.channels.every(c => (c.max - c.min) < 30);
    if (!isBw) {
      pipeline = pipeline.grayscale();
    }
  }

  // 2. Normalize contrast (stretch tonal range)
  pipeline = pipeline.normalize();

  // 3. Adaptive sharpening based on image size
  const megapixels = (metadata.width * metadata.height) / 1_000_000;
  if (megapixels > 1) {
    pipeline = pipeline.sharpen(1.2, 1.0, 0.5);
  } else {
    pipeline = pipeline.sharpen(1.5, 1.2, 0.5);
  }

  // 4. Light denoise for scanned/textbook images
  pipeline = pipeline.median(1);

  // 5. Slight contrast boost
  pipeline = pipeline.linear(1.05, -5);

  await pipeline.png().toFile(outputPath);
}

async function main() {
  const mdDir = process.argv[2] || 'D:\\OpenClawAutomations\\Zai OCR\\output';
  const resolvedDir = resolve(mdDir);
  const outDir = resolve(mdDir, '..', DOWNLOAD_DIR);
  const enhancedDir = resolve(mdDir, '..', ENHANCED_DIR);

  if (!existsSync(outDir)) {
    console.error(`Downloaded images directory not found: ${outDir}`);
    console.error('Run download_md_images.mjs first.');
    process.exit(1);
  }

  if (!existsSync(enhancedDir)) mkdirSync(enhancedDir, { recursive: true });

  const mappingPath = join(outDir, MAPPING_FILE);
  const mapping = loadJSON(mappingPath);

  if (!mapping) {
    console.error(`Mapping file not found: ${mappingPath}`);
    console.error('Run download_md_images.mjs first.');
    process.exit(1);
  }

  const statePath = join(resolvedDir, '..', ENHANCED_DIR, STATE_FILE);
  let state = loadJSON(statePath) || {};

  const entries = Object.entries(mapping);
  console.log(`Found ${entries.length} image(s) to enhance.`);

  let enhanced = 0;
  let cached = 0;
  let failed = 0;

  for (const [url, filename] of entries) {
    const inputPath = join(outDir, filename);
    const outputPath = join(enhancedDir, filename);
    const ext = extname(filename).toLowerCase();

    if (!existsSync(inputPath)) {
      console.log(`  ✗ Source not found: ${filename}`);
      failed++;
      continue;
    }

    if (existsSync(outputPath) && state[filename] === 'done') {
      cached++;
      continue;
    }

    process.stdout.write(`  ${filename}... `);
    try {
      // Skip non-image files (mapping might include .tmp or other files)
      const imgExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
      if (!imgExts.includes(ext)) {
        // Copy as-is
        writeFileSync(outputPath, readFileSync(inputPath));
        console.log('✓ (copied, non-image)');
      } else {
        await enhanceImage(inputPath, outputPath);
        console.log('✓');
      }
      state[filename] = 'done';
      enhanced++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      state[filename] = 'failed';
      failed++;
    }

    // Save state after each
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  console.log(`\nDone. ${enhanced} enhanced, ${cached} cached, ${failed} failed.`);
  console.log(`Enhanced images: ${enhancedDir}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
