import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { readdir, writeFile, mkdir } from 'fs/promises';
import { join, extname, basename, resolve, dirname } from 'path';
import { createHash } from 'crypto';

const IMG_REGEX = /<img\s+src='([^']+)'/gi;
const STATE_FILE = 'download_state.json';
const MAPPING_FILE = 'image_mapping.json';
const MAPPING_TMP = 'image_mapping.tmp.json';
const DOWNLOAD_DIR = 'downloaded_images';

function hashUrl(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function hashFile(content) {
  return createHash('md5').update(content).digest('hex');
}

function extractImageUrls(mdContent) {
  const urls = [];
  let match;
  const re = new RegExp(IMG_REGEX.source, 'gi');
  while ((match = re.exec(mdContent)) !== null) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
}

async function findMDFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMDFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function getExtension(url) {
  const clean = url.split('?')[0].split('#')[0];
  const ext = extname(clean).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) return ext;
  return '.png';
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
  return buffer.length;
}

function loadJSON(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveAtomic(filePath, data) {
  const tmpPath = filePath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, filePath);
}

function buildState() {
  return {
    processedFiles: {},
    downloadProgress: {},
    completedFiles: [],
    mappingComplete: false
  };
}

async function main() {
  const mdDir = process.argv[2] || 'D:\\OpenClawAutomations\\Zai OCR\\output';
  const resolvedDir = resolve(mdDir);

  if (!existsSync(resolvedDir)) {
    console.error(`Directory not found: ${resolvedDir}`);
    console.error('Usage: node scripts/download_md_images.mjs [path/to/md/folder]');
    process.exit(1);
  }

  const outDir = resolve(mdDir, '..', DOWNLOAD_DIR);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const statePath = join(outDir, STATE_FILE);
  const mappingPath = join(outDir, MAPPING_FILE);

  let state = loadJSON(statePath) || buildState();
  let mapping = loadJSON(mappingPath) || {};

  const mdFiles = await findMDFiles(resolvedDir);
  console.log(`Found ${mdFiles.length} markdown file(s) in ${resolvedDir}`);

  // Phase 1: Scan files for new/changed URLs
  const pendingUrls = [];
  const processedFileNames = [];

  for (const file of mdFiles) {
    const relPath = basename(file);
    const content = readFileSync(file, 'utf-8');
    const currentHash = hashFile(content);
    const prev = state.processedFiles[relPath];
    processedFileNames.push(relPath);

    if (prev && prev.hash === currentHash) {
      continue;
    }

    const urls = extractImageUrls(content);
    console.log(`  ${relPath}: ${urls.length} image(s) ${prev ? '(changed, re-scanning)' : '(new)'}`);

    for (const url of urls) {
      if (mapping[url] && existsSync(join(outDir, mapping[url]))) {
        state.downloadProgress[url] = 'completed';
        continue;
      }
      if (state.downloadProgress[url] === 'completed' && mapping[url]) {
        const fpath = join(outDir, mapping[url]);
        if (existsSync(fpath)) continue;
      }
      pendingUrls.push({ url, file: relPath });
    }

    state.processedFiles[relPath] = { hash: currentHash, urlsFound: urls.length };
  }

  // Prune state: remove files that no longer exist
  for (const key of Object.keys(state.processedFiles)) {
    if (!processedFileNames.includes(key)) {
      delete state.processedFiles[key];
    }
  }

  // Phase 2: Download pending URLs
  const uniquePending = [];
  const seen = new Set();
  for (const item of pendingUrls) {
    if (!seen.has(item.url)) {
      seen.add(item.url);
      uniquePending.push(item);
    }
  }

  const totalPending = uniquePending.length;
  const totalKnown = Object.keys(mapping).length;
  console.log(`\n${totalKnown} image(s) already mapped, ${totalPending} pending download(s)`);

  if (totalPending === 0) {
    state.mappingComplete = true;
    saveAtomic(statePath, state);
    console.log('Nothing to download. All images up to date.');
    const count = Object.keys(mapping).length;
    console.log(`\nImages: ${outDir} (${count} files)`);
    console.log(`Mapping: ${mappingPath}`);
    return;
  }

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < uniquePending.length; i++) {
    const { url, file } = uniquePending[i];
    const ext = getExtension(url);
    const filename = `${hashUrl(url)}${ext}`;
    const outputPath = join(outDir, filename);
    const sources = file;

    process.stdout.write(`[${i + 1}/${totalPending}] ${url.slice(0, 65)}... `);

    if (existsSync(outputPath)) {
      console.log(`✓ (cached)`);
      mapping[url] = filename;
      state.downloadProgress[url] = 'completed';
      skipped++;
      // Save mapping + state periodically
      if (skipped % 10 === 0 || i % 20 === 0) {
        saveAtomic(mappingPath, mapping);
        saveAtomic(statePath, state);
      }
      continue;
    }

    try {
      const bytes = await downloadImage(url, outputPath);
      console.log(`✓ ${(bytes / 1024).toFixed(1)} KB  [${file}]`);
      mapping[url] = filename;
      state.downloadProgress[url] = 'completed';
      downloaded++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      state.downloadProgress[url] = 'failed';
      failed++;
    }

    // Save after every download so interruption doesn't lose progress
    saveAtomic(mappingPath, mapping);
    saveAtomic(statePath, state);

    if (i < uniquePending.length - 1) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  state.mappingComplete = failed === 0;
  saveAtomic(statePath, state);

  console.log(`\nDone. ${downloaded} downloaded, ${skipped} cached, ${failed} failed, ${Object.keys(mapping).length} total mapped.`);
  console.log(`Images: ${outDir}`);
  console.log(`Mapping: ${mappingPath}`);
  console.log(`State:   ${statePath}`);

  // Phase 3: Enhance images (optional, requires sharp)
  try {
    const sharp = (await import('sharp')).default;
    const enhancedDir = resolve(mdDir, '..', 'enhanced_images');
    if (!existsSync(enhancedDir)) mkdirSync(enhancedDir, { recursive: true });

    const entries = Object.entries(mapping);
    console.log(`\nEnhancing ${entries.length} image(s) with sharp...`);

    let enhanced = 0;
    let cached = 0;

    for (const [url, filename] of entries) {
      const inputPath = join(outDir, filename);
      const outputPath = join(enhancedDir, filename);

      if (!existsSync(inputPath)) continue;
      if (existsSync(outputPath)) { cached++; continue; }

      const ext = extname(filename).toLowerCase();
      const imgExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
      if (!imgExts.includes(ext)) {
        writeFileSync(outputPath, readFileSync(inputPath));
        enhanced++;
        continue;
      }

      const img = sharp(inputPath);
      const metadata = await img.metadata();

      let pipeline = img;
      if (metadata.channels && metadata.channels >= 3) {
        const stats = await img.clone().stats();
        const isBw = stats.channels.every(c => (c.max - c.min) < 30);
        if (!isBw) pipeline = pipeline.grayscale();
      }
      pipeline = pipeline.normalize();
      const megapixels = (metadata.width * metadata.height) / 1_000_000;
      pipeline = pipeline.sharpen(megapixels > 1 ? 1.2 : 1.5, 1.0, 0.5);
      pipeline = pipeline.median(1);
      pipeline = pipeline.linear(1.05, -5);
      await pipeline.png().toFile(outputPath);
      enhanced++;
    }

    console.log(`Enhanced: ${enhanced}, cached: ${cached}`);
    console.log(`Enhanced images: ${enhancedDir}`);
  } catch {
    console.log('\n(Image enhancement skipped — install sharp: npm install sharp)');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
