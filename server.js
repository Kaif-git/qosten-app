const express = require('express');
const app = express();

// Serve static files (your index.html)
app.use(express.static('.'));

// Endpoint to expose secrets
app.get('/env', (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

const port = 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));