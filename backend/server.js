const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enable CORS for Figma - more permissive for plugin environments
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or Figma plugins)
        // and any localhost origin
        if (!origin || 
            origin.includes('localhost') || 
            origin.includes('127.0.0.1') ||
            origin === 'null' ||
            origin.includes('figma.com')) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins for now (development)
        }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle OPTIONS preflight
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===========================================
// REQUEST LOGGING MIDDLEWARE
// ===========================================
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
});

// ===========================================
// CREATE DEBUG DIRECTORY IF IT DOESN'T EXIST
// ===========================================
const DEBUG_DIR = path.resolve(__dirname, 'debug');
console.log('📁 Debug directory path:', DEBUG_DIR);

try {
    if (!fs.existsSync(DEBUG_DIR)) {
        fs.mkdirSync(DEBUG_DIR, { recursive: true });
        console.log('✅ Created debug directory:', DEBUG_DIR);
    } else {
        console.log('✅ Debug directory exists:', DEBUG_DIR);
    }
    
    // Test write permissions
    const testFile = path.join(DEBUG_DIR, '.test_write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Debug directory is writable');
} catch (error) {
    console.error('❌ Debug directory error:', error.message);
    console.error('   Please check permissions for:', DEBUG_DIR);
}

// ===========================================
// SYSTEM PROMPT FOR GEMINI (Simplified for speed)
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
// FUNCTION TO SAVE JSON TO FILE
// ===========================================
function saveJsonToFile(prompt, jsonData, isRaw = false, status = 'SUCCESS') {
    try {
        // Ensure debug directory exists
        if (!fs.existsSync(DEBUG_DIR)) {
            fs.mkdirSync(DEBUG_DIR, { recursive: true });
            console.log('📁 Created debug directory on demand:', DEBUG_DIR);
        }

        const timestamp = Date.now();
        const date = new Date().toISOString().replace(/[:.]/g, '-');
        const promptSlug = (prompt || 'unknown').substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
        
        let filename;
        if (isRaw) {
            filename = `${status}_raw_${promptSlug}_${date}.txt`;
        } else {
            filename = `${status}_parsed_${promptSlug}_${date}.txt`;
        }
        
        const filePath = path.join(DEBUG_DIR, filename);
        
        // Ensure we have data to write
        if (!jsonData) {
            console.warn('⚠️ No data provided to save');
            return null;
        }
        
        fs.writeFileSync(filePath, jsonData, 'utf8');
        console.log(`💾 Saved to file: ${filename} (${Buffer.byteLength(jsonData, 'utf8')} bytes)`);
        return filePath;
    } catch (error) {
        console.error('❌ Error saving file:', error.message);
        console.error('   Directory:', DEBUG_DIR);
        console.error('   Error code:', error.code);
        return null;
    }
}

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
            process: 'POST /api/process',
            listFiles: 'GET /api/debug/files'
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
// DEBUG ENDPOINT - List all saved files
// ===========================================
app.get('/api/debug/files', (req, res) => {
    try {
        const files = fs.readdirSync(DEBUG_DIR);
        const fileDetails = files.map(file => {
            const filePath = path.join(DEBUG_DIR, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                url: `/api/debug/file/${file}`
            };
        }).sort((a, b) => b.created - a.created);
        
        res.json({
            success: true,
            count: files.length,
            directory: DEBUG_DIR,
            files: fileDetails
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// DEBUG ENDPOINT - Download specific file
// ===========================================
app.get('/api/debug/file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(DEBUG_DIR, filename);
        
        // Security check - prevent directory traversal
        if (!filePath.startsWith(DEBUG_DIR)) {
            return res.status(403).json({ error: 'Invalid filename' });
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// GENERATE DESIGN - WITH FILE SAVING
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
        let rawResponse = null;

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
            console.log('Response length:', text.length);
            
            // SAVE RAW RESPONSE TO FILE
            rawResponse = text;
            saveJsonToFile(prompt, text, true, 'SUCCESS');
            
            designJson = repairJSON(text);
            
            if (designJson && designJson.frames) {
                console.log('✅ Model succeeded');
                // SAVE PARSED JSON TO FILE
                saveJsonToFile(prompt, JSON.stringify(designJson, null, 2), false, 'SUCCESS');
            } else {
                console.log('⚠️ Invalid JSON structure');
                throw new Error('Invalid JSON structure');
            }

        } catch (error) {
            console.log('⚠️ Model failed:', error.message);
            
            // Save raw response that failed to parse with FAILED status
            if (rawResponse) {
                saveJsonToFile(prompt, rawResponse, true, 'FAILED');
            }
            
            // Save error info with FAILED status
            const errorInfo = {
                timestamp: new Date().toISOString(),
                prompt: prompt,
                error: error.message,
                rawResponse: rawResponse || 'No raw response'
            };
            saveJsonToFile('error_' + prompt, JSON.stringify(errorInfo, null, 2), false, 'FAILED');
            
            console.log('📦 Using fallback design');
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
        console.error('Stack:', error.stack);
        
        // ALWAYS return a valid design, even on error
        console.log('📦 Returning fallback design due to error');
        
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
// CREATE FALLBACK DESIGN FUNCTION
// ===========================================
function createFallbackDesign(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Determine colors based on prompt
    let primaryColor = "#007AFF";
    let bgColor = "#FFFFFF";
    let textColor = "#000000";
    
    if (promptLower.includes('farm') || promptLower.includes('agriculture')) {
        primaryColor = "#4CAF50";
        bgColor = "#F1F8E9";
        textColor = "#1B5E20";
    } else if (promptLower.includes('gym') || promptLower.includes('fitness')) {
        primaryColor = "#DC2626";
        bgColor = "#111827";
        textColor = "#F3F4F6";
    } else if (promptLower.includes('school') || promptLower.includes('education')) {
        primaryColor = "#2563EB";
        bgColor = "#F8FAFC";
        textColor = "#0F172A";
    } else if (promptLower.includes('restaurant') || promptLower.includes('food')) {
        primaryColor = "#B45309";
        bgColor = "#FFFBEB";
        textColor = "#78350F";
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
                    height: 400,
                    backgroundColor: bgColor,
                    children: [
                        {
                            type: "text",
                            text: prompt,
                            fontSize: 48,
                            fontWeight: "Bold",
                            color: primaryColor,
                            x: 100,
                            y: 120
                        },
                        {
                            type: "text",
                            text: "Professional design generated by AI",
                            fontSize: 20,
                            color: textColor,
                            x: 100,
                            y: 190
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
                            y: 260
                        }
                    ]
                },
                // Features Section
                {
                    type: "frame",
                    name: "Features",
                    x: 0,
                    y: 480,
                    width: 1440,
                    height: 300,
                    backgroundColor: "#F9FAFB",
                    children: [
                        {
                            type: "text",
                            text: "Our Features",
                            fontSize: 32,
                            fontWeight: "Bold",
                            color: textColor,
                            x: 100,
                            y: 520
                        }
                    ]
                },
                // Footer
                {
                    type: "frame",
                    name: "Footer",
                    x: 0,
                    y: 780,
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
                            y: 830
                        }
                    ]
                }
            ]
        }]
    };
}

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
// ERROR HANDLING MIDDLEWARE
// ===========================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// ===========================================
// 404 HANDLER
// ===========================================
app.use('*', (req, res) => {
    console.log(`⚠️ 404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        available: {
            'GET /': 'Health check',
            'GET /api/status': 'Server status',
            'POST /api/process': 'Process Figma data',
            'POST /api/generate-design': 'Generate design with Gemini',
            'GET /api/debug/files': 'List all saved JSON files',
            'GET /api/debug/file/:filename': 'Download specific file'
        }
    });
});

// ===========================================
// START SERVER
// ===========================================
const server = app.listen(port, '0.0.0.0', () => {
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    console.log('\n' + '='.repeat(60));
    console.log('🚀 BACKEND SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`📍 URL: ${host}`);
    console.log(`📡 Port: ${port}`);
    console.log(`📁 Debug directory: ${DEBUG_DIR}`);
    console.log(`✨ Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log('='.repeat(60));
    console.log('📡 Endpoints:');
    console.log('   GET  /');
    console.log('   GET  /api/status');
    console.log('   POST /api/process');
    console.log('   POST /api/generate-design');
    console.log('   GET  /api/debug/files      - List saved JSON files');
    console.log('   GET  /api/debug/file/:name  - Download specific file');
    console.log('='.repeat(60) + '\n');
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    if (error.code === 'EADDRINUSE') {
        console.error(`   Port ${port} is already in use`);
    }
});
