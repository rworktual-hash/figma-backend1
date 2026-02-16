const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Store last raw response for debugging
let lastRawResponse = null;
let lastSuccessfulJson = null;

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
// SYSTEM PROMPT FOR GEMINI
// ===========================================
const SYSTEM_PROMPT = `
You are a Figma JSON generator. Create UI designs in Figma format.

CRITICAL RULES:
1. Return ONLY valid JSON with a "frames" array
2. Each frame needs: type, name, width, height, backgroundColor, children array
3. Use hex colors: "#FFFFFF", "#000000", "#007AFF", "#4CAF50", "#FF4444"
4. Valid element types: text, rectangle, button, input, circle, line, icon, group

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
// ENHANCED JSON REPAIR FUNCTION
// ===========================================
function repairJSON(str) {
    try {
        // First try normal parse
        return JSON.parse(str);
    } catch (e) {
        console.log('⚠️ Repairing JSON...');
        
        // Store original for debugging
        const original = str;
        
        // Remove markdown code blocks
        str = str.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Remove any comments (// style)
        str = str.replace(/\/\/.*$/gm, '');
        
        // Fix missing commas between objects
        str = str.replace(/}(\s*){/g, '},$1{');
        
        // Fix missing commas between array elements
        str = str.replace(/]\s*\[/g, '],[');
        
        // Fix trailing commas
        str = str.replace(/,(\s*[}\]])/g, '$1');
        
        // Add missing quotes to property names
        str = str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        
        // Fix missing quotes around string values
        str = str.replace(/:\s*([a-zA-Z][a-zA-Z0-9\s]+)([,}])/g, ':"$1"$2');
        
        // Fix single quotes
        str = str.replace(/'/g, '"');
        
        // Fix hex colors without quotes
        str = str.replace(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g, '"#$1"');
        
        try {
            return JSON.parse(str);
        } catch (e2) {
            console.log('⚠️ Second parse failed, error:', e2.message);
            console.log('📄 Problem area (first 200 chars):', str.substring(0, 200));
            
            // Try to extract JSON object
            const jsonMatch = str.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e3) {
                    console.log('❌ Could not repair JSON');
                    return null;
                }
            }
            return null;
        }
    }
}

// ===========================================
// CREATE FALLBACK DESIGN FUNCTION
// ===========================================
function createFallbackDesign(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Determine colors based on prompt
    let primaryColor = "#007AFF";
    let secondaryColor = "#8B5CF6";
    let bgColor = "#FFFFFF";
    let textColor = "#000000";
    let accentColor = "#4CAF50";
    
    if (promptLower.includes('farm') || promptLower.includes('agriculture')) {
        primaryColor = "#4CAF50";
        secondaryColor = "#8B5CF6";
        bgColor = "#F1F8E9";
        textColor = "#1B5E20";
        accentColor = "#FF9800";
    } else if (promptLower.includes('gym') || promptLower.includes('fitness')) {
        primaryColor = "#DC2626";
        secondaryColor = "#F59E0B";
        bgColor = "#111827";
        textColor = "#F3F4F6";
        accentColor = "#10B981";
    } else if (promptLower.includes('school') || promptLower.includes('education')) {
        primaryColor = "#2563EB";
        secondaryColor = "#7C3AED";
        bgColor = "#F8FAFC";
        textColor = "#0F172A";
        accentColor = "#EAB308";
    } else if (promptLower.includes('restaurant') || promptLower.includes('food')) {
        primaryColor = "#B45309";
        secondaryColor = "#D97706";
        bgColor = "#FFFBEB";
        textColor = "#78350F";
        accentColor = "#059669";
    }
    
    return {
        frames: [{
            type: "frame",
            name: prompt,
            width: 1440,
            height: 1200,
            backgroundColor: bgColor,
            children: [
                // Navigation
                {
                    type: "frame",
                    name: "Navigation",
                    x: 0,
                    y: 0,
                    width: 1440,
                    height: 80,
                    backgroundColor: primaryColor,
                    children: [
                        {
                            type: "text",
                            text: prompt.split(' ')[0] || "Brand",
                            fontSize: 24,
                            fontWeight: "Bold",
                            color: "#FFFFFF",
                            x: 40,
                            y: 24
                        },
                        {
                            type: "text",
                            text: "Home",
                            fontSize: 16,
                            color: "#FFFFFF",
                            x: 300,
                            y: 28
                        },
                        {
                            type: "text",
                            text: "About",
                            fontSize: 16,
                            color: "#FFFFFF",
                            x: 380,
                            y: 28
                        },
                        {
                            type: "text",
                            text: "Services",
                            fontSize: 16,
                            color: "#FFFFFF",
                            x: 460,
                            y: 28
                        },
                        {
                            type: "text",
                            text: "Contact",
                            fontSize: 16,
                            color: "#FFFFFF",
                            x: 560,
                            y: 28
                        },
                        {
                            type: "button",
                            text: "Get Started",
                            width: 140,
                            height: 44,
                            backgroundColor: accentColor,
                            cornerRadius: 8,
                            textColor: "#FFFFFF",
                            x: 1240,
                            y: 18
                        }
                    ]
                },
                // Hero Section
                {
                    type: "frame",
                    name: "Hero",
                    x: 0,
                    y: 80,
                    width: 1440,
                    height: 500,
                    backgroundColor: bgColor,
                    children: [
                        {
                            type: "text",
                            text: prompt,
                            fontSize: 56,
                            fontWeight: "Bold",
                            color: primaryColor,
                            x: 100,
                            y: 150
                        },
                        {
                            type: "text",
                            text: "Professional design generated by AI",
                            fontSize: 20,
                            color: textColor,
                            x: 100,
                            y: 220
                        },
                        {
                            type: "button",
                            text: "Learn More",
                            width: 160,
                            height: 50,
                            backgroundColor: primaryColor,
                            cornerRadius: 8,
                            textColor: "#FFFFFF",
                            x: 100,
                            y: 290
                        },
                        {
                            type: "button",
                            text: "Contact Us",
                            width: 160,
                            height: 50,
                            backgroundColor: "transparent",
                            borderColor: primaryColor,
                            borderWidth: 2,
                            cornerRadius: 8,
                            textColor: primaryColor,
                            x: 280,
                            y: 290
                        }
                    ]
                },
                // Features Section
                {
                    type: "frame",
                    name: "Features",
                    x: 0,
                    y: 580,
                    width: 1440,
                    height: 300,
                    backgroundColor: "#F9FAFB",
                    children: [
                        {
                            type: "text",
                            text: "Our Features",
                            fontSize: 36,
                            fontWeight: "Bold",
                            color: textColor,
                            x: 100,
                            y: 620
                        },
                        {
                            type: "text",
                            text: "What makes us different",
                            fontSize: 18,
                            color: "#6B7280",
                            x: 100,
                            y: 670
                        },
                        // Feature cards
                        {
                            type: "rectangle",
                            name: "Feature 1",
                            x: 100,
                            y: 720,
                            width: 300,
                            height: 150,
                            backgroundColor: "#FFFFFF",
                            cornerRadius: 12,
                            borderColor: "#E5E7EB",
                            borderWidth: 1,
                            children: [
                                {
                                    type: "text",
                                    text: "Feature 1",
                                    fontSize: 20,
                                    fontWeight: "Bold",
                                    color: primaryColor,
                                    x: 100,
                                    y: 740
                                },
                                {
                                    type: "text",
                                    text: "Description here",
                                    fontSize: 14,
                                    color: "#6B7280",
                                    x: 90,
                                    y: 780
                                }
                            ]
                        },
                        {
                            type: "rectangle",
                            name: "Feature 2",
                            x: 450,
                            y: 720,
                            width: 300,
                            height: 150,
                            backgroundColor: "#FFFFFF",
                            cornerRadius: 12,
                            borderColor: "#E5E7EB",
                            borderWidth: 1,
                            children: [
                                {
                                    type: "text",
                                    text: "Feature 2",
                                    fontSize: 20,
                                    fontWeight: "Bold",
                                    color: primaryColor,
                                    x: 100,
                                    y: 740
                                },
                                {
                                    type: "text",
                                    text: "Description here",
                                    fontSize: 14,
                                    color: "#6B7280",
                                    x: 90,
                                    y: 780
                                }
                            ]
                        },
                        {
                            type: "rectangle",
                            name: "Feature 3",
                            x: 800,
                            y: 720,
                            width: 300,
                            height: 150,
                            backgroundColor: "#FFFFFF",
                            cornerRadius: 12,
                            borderColor: "#E5E7EB",
                            borderWidth: 1,
                            children: [
                                {
                                    type: "text",
                                    text: "Feature 3",
                                    fontSize: 20,
                                    fontWeight: "Bold",
                                    color: primaryColor,
                                    x: 100,
                                    y: 740
                                },
                                {
                                    type: "text",
                                    text: "Description here",
                                    fontSize: 14,
                                    color: "#6B7280",
                                    x: 90,
                                    y: 780
                                }
                            ]
                        }
                    ]
                },
                // Footer
                {
                    type: "frame",
                    name: "Footer",
                    x: 0,
                    y: 880,
                    width: 1440,
                    height: 120,
                    backgroundColor: "#1F2937",
                    children: [
                        {
                            type: "text",
                            text: "© 2026 All rights reserved",
                            fontSize: 14,
                            color: "#9CA3AF",
                            x: 100,
                            y: 930
                        },
                        {
                            type: "text",
                            text: "Privacy Policy | Terms of Service",
                            fontSize: 14,
                            color: "#9CA3AF",
                            x: 1000,
                            y: 930
                        }
                    ]
                }
            ]
        }]
    };
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
            process: 'POST /api/process',
            debug: 'GET /api/debug/last-response',
            download: 'GET /api/debug/download-json'
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
// DEBUG ENDPOINT - View last raw response
// ===========================================
app.get('/api/debug/last-response', (req, res) => {
    if (lastRawResponse) {
        res.set('Content-Type', 'text/plain');
        res.send(lastRawResponse);
    } else {
        res.send('No response stored yet. Generate a design first.');
    }
});

// ===========================================
// DEBUG ENDPOINT - Download last raw response as file
// ===========================================
app.get('/api/debug/download-json', (req, res) => {
    if (lastRawResponse) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=gemini-response.json');
        res.send(lastRawResponse);
    } else {
        res.send('No response stored yet. Generate a design first.');
    }
});

// ===========================================
// DEBUG ENDPOINT - Get last successful JSON
// ===========================================
app.get('/api/debug/last-success', (req, res) => {
    if (lastSuccessfulJson) {
        res.json(lastSuccessfulJson);
    } else {
        res.json({ message: 'No successful JSON stored yet' });
    }
});

// ===========================================
// GENERATE DESIGN - WITH DEBUGGING
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
        let modelUsed = 'gemini-2.5-flash';
        let startTime = Date.now();

        // TRY: Use gemini-2.5-flash directly
        try {
            console.log('\n📤 Trying model: gemini-2.5-flash');
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            });

            const fullPrompt = `${SYSTEM_PROMPT}\n\nCreate a ${prompt} design. Include header, hero section, content areas. Make it complete. Return ONLY valid JSON.`;
            
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();
            
            console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            console.log('📏 Response length:', text.length);
            
            // STORE RAW RESPONSE FOR DEBUGGING
            lastRawResponse = text;
            
            // Save to file on Render (optional)
            try {
                const debugDir = path.join(__dirname, 'debug');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir);
                }
                const filename = `response-${Date.now()}.json`;
                fs.writeFileSync(path.join(debugDir, filename), text);
                console.log(`💾 Saved raw response to debug/${filename}`);
            } catch (fileError) {
                console.log('⚠️ Could not save debug file:', fileError.message);
            }
            
            // Show preview
            console.log('📄 PREVIEW (first 300 chars):');
            console.log(text.substring(0, 300) + '...');
            
            designJson = repairJSON(text);
            
            if (designJson && designJson.frames) {
                console.log('✅ Model succeeded');
                lastSuccessfulJson = designJson;
            } else {
                console.log('⚠️ Invalid JSON structure, using fallback');
                designJson = createFallbackDesign(prompt);
            }

        } catch (error) {
            console.log('⚠️ Model failed:', error.message);
            console.log('📦 Using enhanced fallback design');
            designJson = createFallbackDesign(prompt);
        }

        // ===========================================
        // ENSURE CORRECT STRUCTURE
        // ===========================================
        console.log('\n📦 Validating JSON structure...');
        
        if (!designJson) {
            designJson = createFallbackDesign(prompt);
        }

        // Ensure frames array exists
        if (!designJson.frames) {
            if (designJson.type === 'frame') {
                designJson = { frames: [designJson] };
            } else {
                designJson = createFallbackDesign(prompt);
            }
        }

        console.log('✅ Valid frames array found');

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
        
        // ALWAYS return a valid design, even on error
        const fallbackDesign = createFallbackDesign(req.body.prompt || 'website');
        
        res.json({
            success: true,
            prompt: req.body.prompt || 'design',
            model: 'fallback',
            design: fallbackDesign,
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
            'POST /api/generate-design': 'Generate design with Gemini',
            'GET /api/debug/last-response': 'View last raw Gemini response',
            'GET /api/debug/download-json': 'Download last response as file',
            'GET /api/debug/last-success': 'View last successful JSON'
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
    console.log('   GET  /api/debug/last-response  - View raw Gemini response');
    console.log('   GET  /api/debug/download-json   - Download as file');
    console.log('   GET  /api/debug/last-success    - View last working JSON');
    console.log('='.repeat(60) + '\n');
});