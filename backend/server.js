const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini with your working key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enable CORS for Figma
app.use(cors({
    origin: ['null', 'https://www.figma.com', 'http://localhost:*', 'file://'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: '✅ Figma backend with Gemini 2.5 Flash is LIVE!',
        endpoints: {
            health: 'GET /',
            status: 'GET /api/status',
            generate: 'POST /api/generate-design',
            process: 'POST /api/process'
        },
        timestamp: new Date().toISOString()
    });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        model: 'gemini-2.5-flash',
        gemini_configured: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// GENERATE DESIGN FROM PROMPT - USING WORKING GEMINI 2.5 FLASH
// ===========================================
app.post('/api/generate-design', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ 
                success: false,
                error: 'Prompt is required' 
            });
        }

        console.log('🎨 Generating design for:', prompt);
        console.log('🤖 Using model: gemini-2.5-flash (confirmed working)');

        // Check if Gemini API key is configured
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'GEMINI_API_KEY not configured'
            });
        }

        // Get Gemini 2.5 Flash model
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            }
        });

        // Create the prompt for Gemini
        const designPrompt = `
        You are a UI/UX designer. Create a detailed JSON representation of a ${prompt} design.
        
        Return ONLY valid JSON with this EXACT structure - no markdown, no explanations:

        {
          "design": {
            "name": "${prompt} design",
            "width": 1920,
            "height": 1080,
            "type": "frame",
            "backgroundColor": "#ffffff"
          },
          "elements": [
            {
              "type": "frame",
              "name": "Header",
              "x": 0,
              "y": 0,
              "width": 1920,
              "height": 80,
              "backgroundColor": "#1a1a1a",
              "children": [
                {
                  "type": "text",
                  "name": "Logo",
                  "x": 40,
                  "y": 20,
                  "content": "Brand",
                  "fontSize": 24,
                  "fontFamily": "Inter",
                  "color": "#ffffff",
                  "fontWeight": 700
                },
                {
                  "type": "text",
                  "name": "Nav Item 1",
                  "x": 200,
                  "y": 28,
                  "content": "Home",
                  "fontSize": 16,
                  "fontFamily": "Inter",
                  "color": "#ffffff"
                },
                {
                  "type": "text",
                  "name": "Nav Item 2",
                  "x": 280,
                  "y": 28,
                  "content": "Products",
                  "fontSize": 16,
                  "fontFamily": "Inter",
                  "color": "#ffffff"
                }
              ]
            },
            {
              "type": "frame",
              "name": "Hero Section",
              "x": 0,
              "y": 80,
              "width": 1920,
              "height": 600,
              "backgroundColor": "#f5f5f5",
              "children": [
                {
                  "type": "text",
                  "name": "Hero Title",
                  "x": 400,
                  "y": 200,
                  "content": "Welcome to Our Store",
                  "fontSize": 48,
                  "fontFamily": "Inter",
                  "color": "#333333",
                  "fontWeight": 700
                },
                {
                  "type": "text",
                  "name": "Hero Subtitle",
                  "x": 400,
                  "y": 280,
                  "content": "Discover amazing products",
                  "fontSize": 24,
                  "fontFamily": "Inter",
                  "color": "#666666"
                },
                {
                  "type": "rectangle",
                  "name": "CTA Button",
                  "x": 400,
                  "y": 350,
                  "width": 200,
                  "height": 50,
                  "backgroundColor": "#007bff",
                  "cornerRadius": 8,
                  "children": [
                    {
                      "type": "text",
                      "name": "Button Text",
                      "x": 60,
                      "y": 15,
                      "content": "Shop Now",
                      "fontSize": 18,
                      "fontFamily": "Inter",
                      "color": "#ffffff",
                      "fontWeight": 600
                    }
                  ]
                }
              ]
            }
          ]
        }

        Important guidelines:
        1. Make the design appropriate for a ${prompt}
        2. Use modern UI/UX principles
        3. Include header, hero section, content sections, and footer
        4. Use realistic spacing and sizing (x, y, width, height)
        5. Use appropriate colors for the context
        6. Return ONLY the JSON, no other text
        `;

        console.log('📤 Sending to Gemini 2.5 Flash API...');

        // Generate content
        const result = await model.generateContent(designPrompt);
        const response = await result.response;
        let text = response.text();
        
        // Clean the response (remove markdown code blocks if present)
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Parse JSON
        const designJson = JSON.parse(text);
        
        console.log('✅ Design generated successfully with Gemini 2.5 Flash');

        res.json({
            success: true,
            prompt: prompt,
            model: 'gemini-2.5-flash',
            design: designJson,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Gemini API Error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to generate design with Gemini 2.5 Flash'
        });
    }
});

// ===========================================
// PROCESS DATA FROM FIGMA
// ===========================================
app.post('/api/process', (req, res) => {
    console.log('📥 Received from Figma:', req.body);
    res.json({
        success: true,
        message: 'Data processed successfully!',
        receivedAt: new Date().toISOString(),
        data: req.body
    });
});

// ===========================================
// 404 HANDLER
// ===========================================
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available: {
            'GET /': 'Health check',
            'GET /api/status': 'Server status',
            'POST /api/process': 'Process Figma data',
            'POST /api/generate-design': 'Generate design with Gemini 2.5 Flash'
        }
    });
});

// ===========================================
// START SERVER
// ===========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Backend running on port ${PORT}`);
    console.log(`📍 URL: https://figma-backend-rahul.onrender.com`);
    console.log(`🤖 Model: gemini-2.5-flash (confirmed working)`);
    console.log(`📡 Endpoints:`);
    console.log(`   GET  /`);
    console.log(`   GET  /api/status`);
    console.log(`   POST /api/process`);
    console.log(`   POST /api/generate-design`);
    console.log(`✨ Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing API key'}`);
    console.log(`\n`);
});