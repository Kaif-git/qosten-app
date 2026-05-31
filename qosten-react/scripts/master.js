const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'mcq_only_cleaned');
const DONE_DIR = path.join(__dirname, '..', 'mcq_processed');
const WORKER_SCRIPT = path.join(__dirname, 'worker.js');

if (!fs.existsSync(DONE_DIR)) fs.mkdirSync(DONE_DIR);

async function runWorker(filePath) {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(filePath);
        console.log(`\n🚀 Starting worker for: ${fileName}`);
        
        const child = spawn('node', [WORKER_SCRIPT, filePath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let fullOutput = '';
        let outputSaved = false;

        child.stdout.on('data', (data) => {
            const out = data.toString();
            process.stdout.write(out);
            if (out.includes('✅ Output saved:')) {
                outputSaved = true;
            } else if (outputSaved) {
                fullOutput += out;
            }
        });

        child.on('close', (code) => {
            if (code === 0 && outputSaved) {
                const responsePath = path.join(DONE_DIR, fileName + '.response.txt');
                fs.writeFileSync(responsePath, fullOutput);
                fs.renameSync(filePath, path.join(DONE_DIR, fileName));
                console.log(`\n✨ Finished ${fileName}`);
                resolve(true);
            } else {
                console.log(`\n❌ Failed ${fileName} with code ${code}`);
                resolve(false);
            }
        });
    });
}

async function main() {
    while (true) {
        const files = fs.readdirSync(SOURCE_DIR);
        if (files.length === 0) {
            console.log('No files. Waiting 30s...');
            await new Promise(r => setTimeout(r, 30000));
            continue;
        }

        for (const file of files) {
            const filePath = path.join(SOURCE_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.size <= 2) {
                console.log(`⏩ Skipping empty file: ${file}`);
                const donePath = path.join(DONE_DIR, file);
                if (!fs.existsSync(DONE_DIR)) fs.mkdirSync(DONE_DIR);
                fs.renameSync(filePath, donePath);
                continue;
            }
            await runWorker(filePath);
        }
    }
}

main();
