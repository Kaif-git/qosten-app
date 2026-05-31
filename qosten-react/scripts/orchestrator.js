const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'mcq_to_fix');
const DONE_DIR = path.join(__dirname, 'mcq_processed');
const WORKER_SCRIPT = path.join(__dirname, 'worker.js');
const SCAN_SCRIPT = path.join(__dirname, 'scan_mcqs.mjs');

// Ensure directories exist
if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR);
if (!fs.existsSync(DONE_DIR)) fs.mkdirSync(DONE_DIR);

/**
 * Runs a child process and waits for it to finish
 */
async function runScript(scriptPath, args = []) {
    return new Promise((resolve) => {
        console.log(`\n▶️ Running script: ${path.basename(scriptPath)} ${args.join(' ')}`);
        const child = spawn('node', [scriptPath, ...args], {
            stdio: 'inherit' // Show output in the main terminal
        });

        child.on('close', (code) => {
            resolve(code === 0);
        });
    });
}

/**
 * Processes a single file using the Playwright worker
 */
async function runWorker(filePath) {
    return new Promise((resolve) => {
        const fileName = path.basename(filePath);
        console.log(`\n🚀 [Orchestrator] Starting worker for: ${fileName}`);
        
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

        child.stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });

        child.on('close', (code) => {
            if (code === 0 && outputSaved) {
                const responsePath = path.join(DONE_DIR, fileName + '.response.txt');
                fs.writeFileSync(responsePath, fullOutput);
                fs.renameSync(filePath, path.join(DONE_DIR, fileName));
                console.log(`\n✨ Finished ${fileName}`);
                resolve(true);
            } else {
                console.log(`\n❌ Worker failed for ${fileName} with code ${code}`);
                // Move to a 'failed' dir or just leave it to retry? 
                // Let's leave it in SOURCE_DIR for the next loop to attempt again
                resolve(false);
            }
        });
    });
}

async function main() {
    console.log('🤖 Starting Autonomous MCQ Orchestrator...');
    
    while (true) {
        let files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));

        if (files.length === 0) {
            console.log('\n🔍 Queue empty. Scanning database for new work...');
            const success = await runScript(SCAN_SCRIPT);
            if (!success) {
                console.log('⚠️ Scan script failed. Waiting 60s before retry...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }
            files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));
        }

        if (files.length === 0) {
            console.log('\n✅ No unverified/flagged questions found. Database is clean!');
            console.log('💤 Sleeping for 30 minutes before next check...');
            await new Promise(r => setTimeout(r, 30 * 60 * 1000));
            continue;
        }

        console.log(`\n📦 Found ${files.length} batches in queue. Starting processing...`);

        for (const file of files) {
            const success = await runWorker(path.join(SOURCE_DIR, file));
            // Small cooldown between fresh browser launches
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('\n🔄 Cycle complete. Checking for remaining files...');
    }
}

main().catch(err => {
    console.error('🔥 Orchestrator Critical Error:', err);
    process.exit(1);
});
