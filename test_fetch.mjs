import fetch from 'node-fetch';

async function test() {
    const id = '1768297236078';
    const response = await fetch(`https://questions-api.edventure.workers.dev/questions/${id}`);
    if (response.ok) {
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log('Error:', response.status);
    }
}

test();
