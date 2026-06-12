
async function run() {
    try {
        const response = await fetch("https://questions-api.edventure.workers.dev/questions/1766473794842");
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}
run();

