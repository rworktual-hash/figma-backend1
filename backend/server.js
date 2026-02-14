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
// STRICT SYSTEM PROMPT - FORCE JSON OUTPUT
// ===========================================
const SYSTEM_PROMPT = `
You are a Figma JSON generator. Create COMPLETE website designs in valid JSON format.

OUTPUT ONLY RAW JSON - NO MARKDOWN, NO EXPLANATIONS, NO COMMENTS.

CRITICAL: Start your response with { and end with } - NOTHING ELSE.

STRICT JSON RULES:
- All keys MUST be in double quotes
- All string values MUST be in double quotes  
- No trailing commas allowed
- No single quotes anywhere
- No // or /* comments

REQUIRED STRUCTURE:
{
  "frames": [
    {
      "type": "frame",
      "name": "Tech Startup Landing Page",
      "width": 1440,
      "height": 1024,
      "backgroundColor": "#FFFFFF",
      "children": [
        { "type": "frame", "name": "Navigation", ... },
        { "type": "frame", "name": "Hero Section", ... },
        { "type": "frame", "name": "Features Section", ... },
        { "type": "frame", "name": "Footer", ... }
      ]
    }
  ]
}

ELEMENT TYPES: text, rectangle, button, frame, circle, line, input, image

Return ONLY valid JSON starting with { and ending with }.
`;

// ===========================================
// ROBUST JSON PARSER WITH MULTIPLE FALLBACKS
// ===========================================
function parseJSONResponse(text) {
    console.log('🔧 Attempting to parse JSON...');
    console.log('📄 Raw response length:', text.length);
    console.log('📄 Raw response preview:', text.substring(0, 150));
    
    // 1. Try direct parse first
    try {
        const result = JSON.parse(text);
        if (result && result.frames) {
            console.log('✅ Direct parse succeeded');
            return result;
        }
    } catch (e) {
        console.log('⚠️ Direct parse failed:', e.message);
    }
    
    // 2. Remove markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // 3. Remove ALL comments (// and /* */)
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    try {
        const result = JSON.parse(cleaned);
        if (result && result.frames) {
            console.log('✅ Comment-stripped parse succeeded');
            return result;
        }
    } catch (e) {
        console.log('⚠️ Comment-stripped parse failed:', e.message);
    }
    
    // 4. Fix common JSON errors
    cleaned = cleaned
        .replace(/'/g, '"')  // Single quotes to double
        .replace(/,(\s*[}\]])/g, '$1')  // Trailing commas
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');  // Unquoted keys
    
    try {
        const result = JSON.parse(cleaned);
        if (result && result.frames) {
            console.log('✅ Common-fix parse succeeded');
            return result;
        }
    } catch (e) {
        console.log('⚠️ Common-fix parse failed:', e.message);
    }
    
    // 5. Extract JSON from anywhere in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        let extracted = jsonMatch[0];
        extracted = extracted
            .replace(/'/g, '"')
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        try {
            const result = JSON.parse(extracted);
            if (result && result.frames) {
                console.log('✅ Extracted JSON parse succeeded');
                return result;
            }
        } catch (e) {
            console.log('⚠️ Extracted parse failed:', e.message);
        }
    }
    
    // 6. Last resort - try to find and fix "frames" array
    const framesMatch = cleaned.match(/"frames"\s*:\s*\[[\s\S]*\]/);
    if (framesMatch) {
        try {
            const result = JSON.parse('{' + framesMatch[0] + '}');
            if (result && result.frames && Array.isArray(result.frames)) {
                console.log('✅ Frames-extraction succeeded');
                return result;
            }
        } catch (e) {
            console.log('⚠️ Frames-extraction failed:', e.message);
        }
    }
    
    console.log('❌ All parsing attempts failed');
    return null;
}

// ===========================================
// PROFESSIONAL FALLBACK DESIGN TEMPLATE
// ===========================================
function getFallbackDesign(prompt) {
    return {
        frames: [
            {
                type: "frame",
                name: prompt || "Website Design",
                width: 1440,
                height: 1024,
                backgroundColor: "#FFFFFF",
                children: [
                    {
                        type: "frame",
                        name: "Navigation Bar",
                        x: 0,
                        y: 0,
                        width: 1440,
                        height: 80,
                        backgroundColor: "#FFFFFF",
                        children: [
                            {
                                type: "text",
                                name: "Logo",
                                text: "BrandName",
                                fontSize: 24,
                                fontWeight: "Bold",
                                color: "#000000",
                                x: 40,
                                y: 28
                            },
                            {
                                type: "text",
                                name: "Nav Link 1",
                                text: "Features",
                                fontSize: 16,
                                color: "#6B7280",
                                x: 400,
                                y: 30
                            },
                            {
                                type: "text",
                                name: "Nav Link 2",
                                text: "Pricing",
                                fontSize: 16,
                                color: "#6B7280",
                                x: 520,
                                y: 30
                            },
                            {
                                type: "text",
                                name: "Nav Link 3",
                                text: "About",
                                fontSize: 16,
                                color: "#6B7280",
                                x: 640,
                                y: 30
                            },
                            {
                                type: "button",
                                name: "Get Started Button",
                                text: "Get Started",
                                width: 140,
                                height: 44,
                                backgroundColor: "#0066FF",
                                cornerRadius: 8,
                                textColor: "#FFFFFF",
                                fontSize: 16,
                                x: 1240,
                                y: 18
                            }
                        ]
                    },
                    {
                        type: "frame",
                        name: "Hero Section",
                        x: 0,
                        y: 80,
                        width: 1440,
                        height: 500,
                        backgroundColor: "#F9FAFB",
                        children: [
                            {
                                type: "text",
                                name: "Hero Headline",
                                text: prompt || "Build Amazing Products",
                                fontSize: 56,
                                fontWeight: "Bold",
                                color: "#111827",
                                x: 80,
                                y: 120,
                                width: 800
                            },
                            {
                                type: "text",
                                name: "Hero Subheadline",
                                text: "Create stunning designs faster than ever before with AI-powered tools",
                                fontSize: 20,
                                color: "#6B7280",
                                x: 80,
                                y: 210,
                                width: 600
                            },
                            {
                                type: "button",
                                name: "Primary CTA",
                                text: "Start Free Trial",
                                width: 200,
                                height: 56,
                                backgroundColor: "#0066FF",
                                cornerRadius: 8,
                                textColor: "#FFFFFF",
                                fontSize: 18,
                                x: 80,
                                y: 300
                            },
                            {
                                type: "button",
                                name: "Secondary CTA",
                                text: "Watch Demo",
                                width: 160,
                                height: 56,
                                backgroundColor: "#FFFFFF",
                                cornerRadius: 8,
                                textColor: "#0066FF",
                                fontSize: 18,
                                borderColor: "#0066FF",
                                borderWidth: 2,
                                x: 300,
                                y: 300
                            }
                        ]
                    },
                    {
                        type: "frame",
                        name: "Features Section",
                        x: 0,
                        y: 580,
                        width: 1440,
                        height: 300,
                        backgroundColor: "#FFFFFF",
                        children: [
                            {
                                type: "text",
                                name: "Features Title",
                                text: "Features",
                                fontSize: 36,
                                fontWeight: "Bold",
                                color: "#111827",
                                x: 80,
                                y: 40
                            },
                            {
                                type: "frame",
                                name: "Feature Card 1",
                                x: 80,
                                y: 100,
                                width: 380,
                                height: 180,
                                backgroundColor: "#F9FAFB",
                                cornerRadius: 12,
                                children: [
                                    {
                                        type: "text",
                                        name: "Feature 1 Title",
                                        text: "Lightning Fast",
                                        fontSize: 20,
                                        fontWeight: "SemiBold",
                                        color: "#111827",
                                        x: 24,
                                        y: 24
                                    },
                                    {
                                        type: "text",
                                        name: "Feature 1 Description",
                                        text: "Generate designs in seconds, not hours",
                                        fontSize: 14,
                                        color: "#6B7280",
                                        x: 24,
                                        y: 56,
                                        width: 332
                                    }
                                ]
                            },
                            {
                                type: "frame",
                                name: "Feature Card 2",
                                x: 500,
                                y: 100,
                                width: 380,
                                height: 180,
                                backgroundColor: "#F9FAFB",
                                cornerRadius: 12,
                                children: [
                                    {
                                        type: "text",
                                        name: "Feature 2 Title",
                                        text: "Easy to Use",
                                        fontSize: 20,
                                        fontWeight: "SemiBold",
                                        color: "#111827",
                                        x: 24,
                                        y: 24
                                    },
                                    {
                                        type: "text",
                                        name: "Feature 2 Description",
                                        text: "Intuitive interface for everyone",
                                        fontSize: 14,
                                        color: "#6B7280",
                                        x: 24,
                                        y: 56,
                                        width: 332
                                    }
                                ]
                            },
                            {
                                type: "frame",
                                name: "Feature Card 3",
                                x: 920,
                                y: 100,
                                width: 380,
                                height: 180,
                                backgroundColor: "#F9FAFB",
                                cornerRadius: 12,
                                children: [
                                    {
                                        type: "text",
                                        name: "Feature 3 Title",
                                        text: "Export Ready",
                                        fontSize: 20,
                                        fontWeight: "SemiBold",
                                        color: "#111827",
                                        x: 24,
                                        y: 24
                                    },
                                    {
                                        type: "text",
                                        name: "Feature 3 Description",
                                        text: "Export to any format instantly",
                                        fontSize: 14,
                                        color: "#6B7280",
                                        x: 24,
                                        y: 56,
                                        width: 332
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: "frame",
                        name: "Footer",
                        x: 0,
                        y: 880,
                        width: 1440,
                        height: 144,
                        backgroundColor: "#1F2937",
                        children: [
                            {
                                type: "text",
                                name: "Footer Text",
                                text: "© 2024 BrandName. All rights reserved.",
                                fontSize: 14,
                                color: "#9CA3AF",
                                x: 80,
                                y: 60
                            }
                        ]
                    }
                ]
            }
        ]
    };
}

// ===========================================
// HEALTH CHECK
// ===========================================
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: '✅ Figma backend is LIVE!',
        endpoints: {
            health: 'GET /',
            status: 'GET /api/status',
            generate: 'POST /api/generate-design',
            process: 'POST /api/process'
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        gemini_configured: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// TEST ENDPOINT - Returns a simple design
// ===========================================
app.get('/api/test-design', (req, res) => {
    res.json({
        success: true,
        model: 'test-endpoint',
        design: getFallbackDesign('Test Design'),
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// GENERATE DESIGN ENDPOINT
// ===========================================
app.post('/api/generate-design', async (req, res) => {
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

        console.log('\n' + '='.repeat(50));
        console.log('🎨 DESIGN REQUEST:', prompt);
        
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'GEMINI_API_KEY not configured'
            });
        }

        let designJson = null;
        let modelUsed = '';
        let startTime = Date.now();
        let attemptLog = [];

        // Try gemini-2.0-flash-exp
        try {
            modelUsed = 'gemini-2.0-flash-exp';
            console.log('📤 Trying:', modelUsed);
            
            const model = genAI.getGenerativeModel({ 
                model: modelUsed,
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 8192,
                }
            });

            const fullPrompt = `${SYSTEM_PROMPT}\n\nCreate a complete ${prompt} website design. Return ONLY valid JSON.`;
            
            const result = await model.generateContent(fullPrompt);
            const responseText = result.response.text();
            
            console.log(`📥 Response (${(Date.now() - startTime)/1000}s):`, responseText.substring(0, 100) + '...');
            
            designJson = parseJSONResponse(responseText);
            
            if (designJson && designJson.frames) {
                console.log('✅ SUCCESS with', modelUsed);
            } else {
                throw new Error('Invalid JSON structure');
            }

        } catch (error1) {
            console.log('⚠️ Failed:', error1.message);
            attemptLog.push({ model: modelUsed, error: error1.message });
            
            // Try gemini-2.5-flash as fallback
            try {
                modelUsed = 'gemini-2.5-flash';
                console.log('📤 Trying:', modelUsed);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelUsed,
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 8192,
                    }
                });

                const fullPrompt = `${SYSTEM_PROMPT}\n\nCreate a complete ${prompt} website design. Return ONLY valid JSON starting with { and ending with }.`;
                
                const result = await model.generateContent(fullPrompt);
                const responseText = result.response.text();
                
                console.log(`📥 Response (${(Date.now() - startTime)/1000}s):`, responseText.substring(0, 100) + '...');
                
                designJson = parseJSONResponse(responseText);
                
                if (designJson && designJson.frames) {
                    console.log('✅ SUCCESS with', modelUsed);
                } else {
                    throw new Error('Invalid JSON structure');
                }

            } catch (error2) {
                console.log('⚠️ Failed:', error2.message);
                attemptLog.push({ model: modelUsed, error: error2.message });
                
                // Try gemini-1.5-flash as last resort
                try {
                    modelUsed = 'gemini-1.5-flash';
                    console.log('📤 Trying:', modelUsed);
                    
                    const model = genAI.getGenerativeModel({ 
                        model: modelUsed,
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 8192,
                        }
                    });

                    const fullPrompt = `${SYSTEM_PROMPT}\n\nReturn ONLY valid JSON for ${prompt}.`;
                    
                    const result = await model.generateContent(fullPrompt);
                    const responseText = result.response.text();
                    
                    designJson = parseJSONResponse(responseText);
                    
                    if (designJson && designJson.frames) {
                        console.log('✅ SUCCESS with', modelUsed);
                    } else {
                        throw new Error('Invalid JSON structure');
                    }

                } catch (error3) {
                    console.log('⚠️ All models failed, using fallback');
                    attemptLog.push({ model: modelUsed, error: error3.message });
                    modelUsed = 'fallback-template';
                    designJson = getFallbackDesign(prompt);
                }
            }
        }

        // Validate final structure
        if (!designJson || !designJson.frames) {
            console.log('⚠️ Invalid structure, using fallback');
            designJson = getFallbackDesign(prompt);
            modelUsed = 'fallback-template';
        }

        const totalTime = ((Date.now() - startTime)/1000).toFixed(1);
        console.log('='.repeat(50));
        console.log(`✅ DONE (${totalTime}s) - Model: ${modelUsed}`);
        console.log('📦 Frames count:', designJson.frames ? designJson.frames.length : 0);
        console.log('📦 First frame name:', designJson.frames[0] ? designJson.frames[0].name : 'N/A');
        console.log('📦 Response keys:', Object.keys(designJson));
        console.log('='.repeat(50));

        const response = {
            success: true,
            prompt: prompt,
            model: modelUsed,
            generationTime: `${totalTime}s`,
            design: designJson,
            timestamp: new Date().toISOString()
        };

        console.log('📤 Sending response:', JSON.stringify(response, null, 2).substring(0, 500) + '...');

        res.json(response);

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        
        res.json({
            success: true,
            prompt: req.body.prompt || 'design',
            model: 'emergency-fallback',
            design: getFallbackDesign(req.body.prompt || 'Design'),
            timestamp: new Date().toISOString()
        });
    }
});

// ===========================================
// PROCESS ENDPOINT
// ===========================================
app.post('/api/process', (req, res) => {
    console.log('📥 Process request:', req.body);
    res.json({
        success: true,
        message: 'Processed!',
        receivedAt: new Date().toISOString()
    });
});

// ===========================================
// 404 HANDLER
// ===========================================
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// ===========================================
// START SERVER
// ===========================================
app.listen(port, '0.0.0.0', () => {
    console.log('\n🚀 SERVER STARTED');
    console.log('📍 URL: https://figma-backend-rahul.onrender.com');
    console.log('📡 Port:', port);
    console.log('✨ Gemini:', process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing');
    console.log('========================\n');
});

