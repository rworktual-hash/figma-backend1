const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for Figma
app.use(cors({
    origin: ['null', 'https://www.figma.com', 'http://localhost:*', 'file://'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: '✅ Figma backend is LIVE!',
        timestamp: new Date().toISOString()
    });
});

// Process data from Figma
app.post('/api/process', (req, res) => {
    console.log('📥 Received from Figma:', req.body);
    res.json({
        success: true,
        message: 'Data processed successfully!',
        receivedAt: new Date().toISOString(),
        data: req.body
    });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// CRITICAL: Bind to 0.0.0.0 for Render
app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 Backend running on port ${port}`);
    console.log(`📍 Test: http://localhost:${port}\n`);
});