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
// SYSTEM PROMPT FOR GEMINI (Simplified for speed)
// ===========================================
const SYSTEM_PROMPT = `
You are a world powerful Figma JSON generator. Create UI designs in Figma format.

- If user asking to generate any kind of figma mean you want to provide

CRITICAL RULES:
1. Return ONLY valid JSON with a "frames" array
2. Each frame needs: type, name, width, height, backgroundColor, children array
3. Valid element types: text, rectangle, button, input, circle, line, icon, group
4. Always want to provide the advance level json.

EXAMPLE STRUCTURE:
{
  "frames": [
    {
      "type": "frame",
      "name": "Design Name",
      "width": 1440,
      "height": 900,
      "backgroundColor": "#FFFFFF",
      "children": [
        {
          "type": "text",
          "text": "Hello World",
          "fontSize": 32,
          "color": "#000000",
          "x": 100,
          "y": 100
        }
      ]
    }
  ]
}

Keep designs clean and modern. Return ONLY the JSON, no other text.
`;

// ===========================================
// JSON REPAIR FUNCTION
// ===========================================
function repairJSON(str) {
    try {
        // First try normal parse
        return JSON.parse(str);
    } catch (e) {
        console.log('⚠️ Repairing JSON...');
        
        // Remove markdown code blocks
        str = str.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Fix trailing commas
        str = str.replace(/,(\s*[}\]])/g, '$1');
        
        // Add missing quotes to property names
        str = str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        
        // Fix missing commas between objects
        str = str.replace(/}(\s*){/g, '},$1{');
        
        try {
            return JSON.parse(str);
        } catch (e2) {
            // Try to extract JSON object
            const jsonMatch = str.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
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
        message: '✅ Figma backend with Gemini is LIVE!',
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
        gemini_configured: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// GENERATE DESIGN - WITH FASTER MODEL & LONGER TIMEOUT
// ===========================================
app.post('/api/generate-design', async (req, res) => {
    // Set longer timeout (90 seconds)
    req.setTimeout(90000);
    res.setTimeout(90000);
    
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ 
                success: false,
                error: 'Prompt is required' 
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎨 GENERATE DESIGN REQUEST');
        console.log('='.repeat(60));
        console.log('Prompt:', prompt);
        console.log('Time:', new Date().toISOString());

        // Check API key
        if (!process.env.GEMINI_API_KEY) {
            console.log('❌ GEMINI_API_KEY not configured');
            return res.status(500).json({
                success: false,
                error: 'GEMINI_API_KEY not configured'
            });
        }

        let designJson;
        let modelUsed = 'gemini-2.5-pro';
        let startTime = Date.now();

        // TRY 1: Fast model first (1.5-flash) - takes 5-15 seconds
        try {
            console.log('\n📤 Trying fast model: gemini-2.5-pro');
            
            const fastModel = genAI.getGenerativeModel({ 
                model: "gemini-2.5-pro",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                }
            });

            // Simpler prompt for faster response
            const fastPrompt = `Create a ${prompt} design. Return JSON with frames array. Include header, content sections. Use hex colors. Keep it clean.`;
            
            const fastResult = await fastModel.generateContent(fastPrompt);
            const fastResponse = await fastResult.response;
            let fastText = fastResponse.text();
            
            console.log(`📥 Fast model response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            console.log('Response length:', fastText.length);
            
            designJson = repairJSON(fastText);
            console.log('✅ Fast model succeeded');

        } catch (fastError) {
            console.log('⚠️ Fast model failed:', fastError.message);
            console.log('Trying 2.5 flash model...');
            
            modelUsed = 'gemini-2.5-flash';
            
            // TRY 2: Slower but more capable model (2.5-flash) - takes 20-40 seconds
            try {
                const slowModel = genAI.getGenerativeModel({ 
                    model: "gemini-2.5-flash",
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    }
                });

                const fullPrompt = `${SYSTEM_PROMPT}\n\nCreate a ${prompt} design. Include header, hero section, content areas. Make it complete.`;
                
                const slowResult = await slowModel.generateContent(fullPrompt);
                const slowResponse = await slowResult.response;
                let slowText = slowResponse.text();
                
                console.log(`📥 2.5 flash response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
                console.log('Response length:', slowText.length);
                
                designJson = repairJSON(slowText);
                console.log('✅ 2.5 flash model succeeded');

            } catch (slowError) {
                console.log('⚠️ Both models failed:', slowError.message);
                throw new Error('All models failed to generate design');
            }
        }

        // ===========================================
        // ENSURE CORRECT STRUCTURE (frames array)
        // ===========================================
        console.log('\n📦 Validating JSON structure...');
        
        if (!designJson) {
            throw new Error('No design data generated');
        }

        // Case 1: Already has frames array
        if (designJson.frames && Array.isArray(designJson.frames)) {
            console.log('✅ Valid frames array found');
        }
        // Case 2: Single frame object
        else if (designJson.type === 'frame') {
            console.log('📦 Converting single frame to frames array');
            designJson = { frames: [designJson] };
        }
        // Case 3: Has design property with frames
        else if (designJson.design && designJson.design.frames) {
            console.log('📦 Extracting frames from design property');
            designJson = { frames: designJson.design.frames };
        }
        // Case 4: Array of frames
        else if (Array.isArray(designJson)) {
            console.log('📦 Converting array to frames object');
            designJson = { frames: designJson };
        }
        // Case 5: No recognizable structure - create fallback
        else {
            console.log('⚠️ No frames found, creating fallback');
            designJson = {
                frames: [{
                    type: "frame",
                    name: prompt,
                    width: 1440,
                    height: 900,
                    backgroundColor: "#FFFFFF",
                    children: [
                        {
                            type: "text",
                            text: prompt,
                            fontSize: 32,
                            fontWeight: "Bold",
                            color: "#000000",
                            x: 100,
                            y: 100
                        },
                        {
                            type: "text",
                            text: "Generated with AI",
                            fontSize: 18,
                            color: "#666666",
                            x: 100,
                            y: 160
                        },
                        {
                            type: "rectangle",
                            width: 1240,
                            height: 2,
                            color: "#EEEEEE",
                            x: 100,
                            y: 200
                        },
                        {
                            type: "button",
                            text: "Get Started",
                            width: 200,
                            height: 50,
                            backgroundColor: "#007AFF",
                            cornerRadius: 8,
                            textColor: "#FFFFFF",
                            x: 100,
                            y: 250
                        }
                    ]
                }]
            };
        }

        // Ensure each frame has required properties
        designJson.frames = designJson.frames.map(frame => ({
            type: 'frame',
            name: frame.name || prompt,
            width: frame.width || 1440,
            height: frame.height || 900,
            backgroundColor: frame.backgroundColor || '#FFFFFF',
            children: frame.children || [],
            ...frame
        }));

        const totalTime = ((Date.now() - startTime)/1000).toFixed(1);
        console.log('\n' + '='.repeat(60));
        console.log('✅ DESIGN GENERATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`⏱️  Total time: ${totalTime}s`);
        console.log(`🤖 Model used: ${modelUsed}`);
        console.log(`📦 Frames created: ${designJson.frames.length}`);
        console.log('='.repeat(60));

        // Send successful response
        res.json({
            success: true,
            prompt: prompt,
            model: modelUsed,
            generationTime: `${totalTime}s`,
            design: designJson,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        
        // ALWAYS return a valid design, even on error
        console.log('📦 Returning fallback design due to error');
        
        res.json({
            success: true,
            prompt: req.body.prompt || 'design',
            model: 'fallback',
            design: {
                frames: [{
                    type: "frame",
                    name: req.body.prompt || 'Design',
                    width: 1440,
                    height: 900,
                    backgroundColor: "#FFFFFF",
                    children: [
                        {
                            type: "text",
                            text: req.body.prompt || 'Design',
                            fontSize: 32,
                            fontWeight: "Bold",
                            color: "#000000",
                            x: 100,
                            y: 100
                        },
                        {
                            type: "text",
                            text: "Generated with fallback (API error)",
                            fontSize: 18,
                            color: "#FF4444",
                            x: 100,
                            y: 160
                        },
                        {
                            type: "rectangle",
                            width: 1240,
                            height: 2,
                            color: "#EEEEEE",
                            x: 100,
                            y: 200
                        },
                        {
                            type: "button",
                            text: "Try Again",
                            width: 200,
                            height: 50,
                            backgroundColor: "#007AFF",
                            cornerRadius: 8,
                            textColor: "#FFFFFF",
                            x: 100,
                            y: 250
                        }
                    ]
                }]
            },
            timestamp: new Date().toISOString()
        });
    }
});

// ===========================================
// PROCESS DATA FROM FIGMA
// ===========================================
app.post('/api/process', (req, res) => {
    console.log('📥 Process endpoint received:', req.body);
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
            'POST /api/generate-design': 'Generate design with Gemini'
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
    console.log(`✨ Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log('='.repeat(60));
    console.log('📡 Endpoints:');
    console.log('   GET  /');
    console.log('   GET  /api/status');
    console.log('   POST /api/process');
    console.log('   POST /api/generate-design');
    console.log('='.repeat(60) + '\n');
});
