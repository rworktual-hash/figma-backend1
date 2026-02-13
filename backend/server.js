const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enable CORS for Figma
app.use(cors({
    origin: ['null', 'https://www.figma.com', 'http://localhost:*', 'file://'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// ===========================================
// JSON REPAIR FUNCTION
// ===========================================
function repairJSON(str) {
    try {
        // First try normal parse
        return JSON.parse(str);
    } catch (e) {
        console.log('⚠️ Initial JSON parse failed, attempting repair...');
        
        // Remove markdown code blocks if present
        str = str.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Remove any trailing commas before closing braces/brackets
        str = str.replace(/,(\s*[}\]])/g, '$1');
        
        // Add missing quotes to property names if needed
        str = str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        
        // Fix missing commas between array elements
        str = str.replace(/}(\s*){/g, '},$1{');
        
        // Try parsing again
        try {
            return JSON.parse(str);
        } catch (e2) {
            console.log('⚠️ Second parse failed, trying to extract JSON object...');
            
            // Try to extract JSON from the response
            const jsonMatch = str.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e3) {
                    console.log('⚠️ Extraction failed, returning fallback');
                    throw e3;
                }
            }
            throw e2;
        }
    }
}

// ===========================================
// HEALTH CHECK ENDPOINT
// ===========================================
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

// ===========================================
// STATUS ENDPOINT
// ===========================================
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
// GENERATE DESIGN FROM PROMPT - WITH JSON REPAIR
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

        console.log('='.repeat(60));
        console.log('🎨 GENERATE DESIGN REQUEST');
        console.log('='.repeat(60));
        console.log('Prompt:', prompt);
        console.log('API Key present:', !!process.env.GEMINI_API_KEY);
        console.log('Model: gemini-2.5-flash');

        // Check if Gemini API key is configured
        if (!process.env.GEMINI_API_KEY) {
            console.log('❌ GEMINI_API_KEY not configured');
            return res.status(500).json({
                success: false,
                error: 'GEMINI_API_KEY not configured on server'
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

        // Create a simplified prompt to reduce JSON errors
        const designPrompt = `
        Create a JSON representation for a ${prompt} design.
        
        Return ONLY valid JSON with this exact structure - no other text, no markdown:
        
        {
          "design": {
            "name": "${prompt} design",
            "width": 1920,
            "height": 1080,
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
                  "content": "Brand Name",
                  "fontSize": 24,
                  "fontFamily": "Inter",
                  "color": "#ffffff",
                  "fontWeight": 700
                }
              ]
            },
            {
              "type": "frame",
              "name": "Hero Section",
              "x": 0,
              "y": 80,
              "width": 1920,
              "height": 400,
              "backgroundColor": "#f5f5f5",
              "children": [
                {
                  "type": "text",
                  "name": "Hero Title",
                  "x": 200,
                  "y": 150,
                  "content": "Welcome",
                  "fontSize": 48,
                  "fontFamily": "Inter",
                  "color": "#333333",
                  "fontWeight": 700
                }
              ]
            }
          ]
        }
        
        Important: 
        1. Make the design appropriate for a ${prompt}
        2. Add 3-5 relevant elements
        3. Use realistic x, y, width, height values
        4. Return ONLY the JSON object, nothing else
        `;

        console.log('📤 Sending request to Gemini API...');

        // Generate content
        const result = await model.generateContent(designPrompt);
        const response = await result.response;
        let text = response.text();
        
        console.log('📥 Received response from Gemini');
        console.log('Raw response length:', text.length);
        
        // Parse JSON with repair function
        let designJson;
        try {
            designJson = repairJSON(text);
            console.log('✅ JSON parsed successfully');
        } catch (parseError) {
            console.error('❌ JSON parsing failed completely:', parseError.message);
            console.error('First 200 chars of response:', text.substring(0, 200));
            
            // Return a fallback design
            designJson = {
                design: {
                    name: `${prompt} design (fallback)`,
                    width: 1920,
                    height: 1080,
                    backgroundColor: "#ffffff"
                },
                elements: [
                    {
                        type: "frame",
                        name: "Header",
                        x: 0,
                        y: 0,
                        width: 1920,
                        height: 80,
                        backgroundColor: "#1a1a1a",
                        children: [
                            {
                                type: "text",
                                name: "Logo",
                                x: 40,
                                y: 20,
                                content: prompt,
                                fontSize: 24,
                                fontFamily: "Inter",
                                color: "#ffffff"
                            }
                        ]
                    },
                    {
                        type: "frame",
                        name: "Content",
                        x: 0,
                        y: 80,
                        width: 1920,
                        height: 400,
                        backgroundColor: "#f5f5f5"
                    }
                ]
            };
            console.log('✅ Using fallback design');
        }
        
        console.log('✅ Design generation complete');
        console.log('='.repeat(60));

        res.json({
            success: true,
            prompt: prompt,
            model: 'gemini-2.5-flash',
            design: designJson,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ ERROR:', error);
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        console.error('='.repeat(60));
        
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to generate design'
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
app.listen(port, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 BACKEND SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`📍 URL: https://figma-backend-rahul.onrender.com`);
    console.log(`📡 Port: ${port}`);
    console.log(`🤖 Model: gemini-2.5-flash`);
    console.log(`✨ Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log('='.repeat(60));
    console.log('📡 Endpoints:');
    console.log('   GET  /');
    console.log('   GET  /api/status');
    console.log('   POST /api/process');
    console.log('   POST /api/generate-design');
    console.log('='.repeat(60) + '\n');
});