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
// ENHANCED SYSTEM PROMPT - WITH JSON RULES
// ===========================================
const SYSTEM_PROMPT = `
You are a Figma JSON generator. Create COMPLETE, PROFESSIONAL website designs in Figma format.

## ⚠️ CRITICAL JSON RULES - READ CAREFULLY ⚠️

### 🚫 NEVER DO THESE:
❌ NO COMMENTS in JSON - NEVER use // or /* */ in your JSON
❌ NO MARKDOWN - NEVER wrap JSON in \`\`\`json tags
❌ NO EXPLANATIONS - Return ONLY the JSON object
❌ NO TRAILING COMMAS - Never end with comma before } or ]
❌ NO SINGLE QUOTES - Always use "double quotes"

### ✅ ALWAYS DO THESE:
✓ ALL property names in double quotes: "name"
✓ ALL strings in double quotes: "text"
✓ ALL hex colors in quotes: "#FFFFFF"
✓ Properly close all brackets: { } [ ]
✓ Numbers without quotes: 42, 3.14, 100
✓ Boolean as true/false (no quotes)

### YOUR OUTPUT MUST BE PURE JSON - NO COMMENTS ALLOWED
BAD: { "name": "Home" } // This is the navigation
GOOD: { "name": "Home" }

### BEFORE RETURNING, VERIFY:
1. Search for "//" - if found, REMOVE THEM
2. No text outside the JSON object
3. First character must be { or [
4. Last character must be } or ]

## DESIGN REQUIREMENTS:

1. **COMPLETE WEBSITE STRUCTURE** - Include ALL these sections:
   - Navigation bar (logo, menu links, CTA button)
   - Hero section (headline, subheadline, buttons, image)
   - Features/Stats section
   - Content sections (2-3 different layouts)
   - Testimonials section
   - Footer with contact info and links

2. **WEBSITE-SPECIFIC STYLES**:
   - For SCHOOL: Use blues (#2563EB), whites, include academic programs, events
   - For GYM: Use reds (#DC2626), dark backgrounds, include classes, trainers
   - For RESTAURANT: Use warm colors (#B45309), include menu, reservations
   - For ECOMMERCE: Use blues (#3B82F6), include products, categories
   - For PORTFOLIO: Use accent colors (#EC4899), include project grid

3. **VALID ELEMENT TYPES**: 
   - text, rectangle, button, input, circle, line, icon, group

4. **COORDINATES**: 
   - Use 8px grid system
   - Sections stack vertically: y increases by previous height + spacing
   - Padding from sides: 40px

## EXAMPLE STRUCTURE (WITHOUT COMMENTS):
{
  "frames": [
    {
      "type": "frame",
      "name": "Complete Website",
      "width": 1440,
      "height": 2000,
      "backgroundColor": "#FFFFFF",
      "children": [
        {
          "type": "frame",
          "name": "Navigation",
          "x": 0,
          "y": 0,
          "width": 1440,
          "height": 80,
          "backgroundColor": "#FFFFFF",
          "children": [
            {
              "type": "text",
              "name": "Logo",
              "text": "Brand",
              "fontSize": 24,
              "fontWeight": "Bold",
              "color": "#1A1A1A",
              "x": 40,
              "y": 24
            },
            {
              "type": "button",
              "name": "CTA",
              "text": "Get Started",
              "width": 140,
              "height": 44,
              "backgroundColor": "#0066FF",
              "cornerRadius": 8,
              "textColor": "#FFFFFF",
              "fontSize": 16,
              "x": 1240,
              "y": 18
            }
          ]
        },
        {
          "type": "frame",
          "name": "Hero",
          "x": 0,
          "y": 80,
          "width": 1440,
          "height": 600,
          "backgroundColor": "#F9FAFB",
          "children": [
            {
              "type": "text",
              "name": "Headline",
              "text": "Main Headline",
              "fontSize": 56,
              "fontWeight": "Bold",
              "color": "#111827",
              "x": 80,
              "y": 180
            }
          ]
        }
      ]
    }
  ]
}

Return ONLY valid JSON. No comments. No markdown.
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
        
        // Remove any comments (// style)
        str = str.replace(/\/\/.*$/gm, '');
        
        // Fix trailing commas
        str = str.replace(/,(\s*[}\]])/g, '$1');
        
        // Add missing quotes to property names
        str = str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        
        // Fix missing commas between objects
        str = str.replace(/}(\s*){/g, '},$1{');
        
        // Fix single quotes
        str = str.replace(/'/g, '"');
        
        try {
            return JSON.parse(str);
        } catch (e2) {
            // Try to extract JSON object
            const jsonMatch = str.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e3) {
                    return null;
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
// GENERATE DESIGN - WITH FIXED MODEL NAMES
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

        // TRY 1: Fast model first (2.0 flash)
        try {
            console.log('\n📤 Trying model: gemini-2.5-flash');
            
            const fastModel = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                }
            });

            const fastPrompt = `${SYSTEM_PROMPT}\n\nCreate a complete ${prompt} design. Include ALL sections. Return ONLY valid JSON with no comments.`;
            
            const fastResult = await fastModel.generateContent(fastPrompt);
            const fastResponse = await fastResult.response;
            let fastText = fastResponse.text();
            
            console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            console.log('Response length:', fastText.length);
            
            designJson = repairJSON(fastText);
            
            if (designJson && designJson.frames) {
                console.log('✅ Model succeeded');
            } else {
                throw new Error('Invalid JSON structure');
            }

        } catch (fastError) {
            console.log('⚠️ Model failed:', fastError.message);
            console.log('Trying 2.5 flash...');
            
            modelUsed = 'gemini-2.5-flash';
            
            // TRY 2: Try 2.5 flash
            try {
                const slowModel = genAI.getGenerativeModel({ 
                    model: "gemini-2.5-flash",
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    }
                });

                const fullPrompt = `${SYSTEM_PROMPT}\n\nCreate a complete ${prompt} design. Return ONLY valid JSON with no comments.`;
                
                const slowResult = await slowModel.generateContent(fullPrompt);
                const slowResponse = await slowResult.response;
                let slowText = slowResponse.text();
                
                console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
                console.log('Response length:', slowText.length);
                
                designJson = repairJSON(slowText);
                
                if (!designJson || !designJson.frames) {
                    throw new Error('Invalid JSON structure');
                }
                
                console.log('✅ 2.5 flash succeeded');

            } catch (slowError) {
                console.log('⚠️ All models failed, using fallback');
                // Create fallback design
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
                            }
                        ]
                    }]
                };
            }
        }

        // ===========================================
        // ENSURE CORRECT STRUCTURE
        // ===========================================
        console.log('\n📦 Validating JSON structure...');
        
        if (!designJson) {
            throw new Error('No design data generated');
        }

        // Ensure frames array exists
        if (!designJson.frames) {
            if (designJson.type === 'frame') {
                designJson = { frames: [designJson] };
            } else {
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
                                color: "#000000",
                                x: 100,
                                y: 100
                            }
                        ]
                    }]
                };
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
        
        res.json({
            success: true,
            prompt: req.body.prompt || 'design',
            model: 'fallback',
            design: {
                frames: [{
                    type: "frame",
                    name: req.body.prompt || 'Design',
                    width: 1440,
                    height: 600,
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