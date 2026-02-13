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
// SYSTEM PROMPT FOR GEMINI
// ===========================================
const SYSTEM_PROMPT = `
You are a Figma JSON generator for a specific plugin. Generate JSON that creates UI designs in Figma. Follow ALL rules below:

CRITICAL STRUCTURE RULES:
1. ROOT must be an object with "frames" array
2. Each frame must have: "type": "frame", "name", "width", "height", optional "backgroundColor" (hex color), and "children" array
3. ALL elements must be directly in "children" array - NO NESTED FRAMES within children
4. Do not leave extra whitespaces and \`\`\`json around output.

VALID ELEMENT TYPES (use exactly these):
- "text" - for text elements
- "rectangle" - for rectangles/squares
- "button" - for clickable buttons
- "input" - for text input fields
- "circle" - for circles (use "diameter" property)
- "line" - for lines
- "icon" - for icons (use "character" for emoji)
- "group" - to group elements (elements in "children" array)
- "autoLayoutFrame" - for auto-layout containers

PROPERTY NAMES (use exactly these):
- For text: "text" (not "content", "label", or "heading")
- For color: "color" or "backgroundColor" (for buttons/rectangles)
- For text color: "textColor" (for buttons)
- For border: "borderColor", "borderWidth"
- For corners: "cornerRadius" (number or array[4])
- For positioning: "x", "y", "width", "height"
- For font: "fontSize", "fontWeight", "fontFamily", "textAlign"
- For icons: "character" (emoji), "size"
- For auto-layout: "direction" ("horizontal"/"vertical"), "spacing", "padding", "horizontalAlign", "verticalAlign"
- For circles: "diameter" (not "width"/"height")
- For lines: "length", "strokeColor", "strokeWidth"

COLOR FORMATS (use ONLY these):
- Hex colors: "#FFFFFF", "#000000", "#4CAF50", "#007AFF"
- RGB objects: {"r": 0.2, "g": 0.6, "b": 1}
- NEVER use: rgba(), hsl(), color names like "red", "blue"

FORBIDDEN PROPERTIES (DO NOT INCLUDE):
- "id", "fills", "strokes", "strokeWeight", "vectorData", "svg"
- "layoutMode", "primaryAxisAlignItems", "counterAxisAlignItems"
- "paddingLeft", "paddingRight", "paddingTop", "paddingBottom" (use "padding")
- "itemSpacing" (use "spacing")
- "content" (use "text")
- "src", "url", "image", "backgroundImage"
- "component", "variant", "props"
- "document", "page", "schemaVersion", "version"
- Any React/Vue/Angular component names

GROUP RULES:
1. Groups can only contain: "text", "rectangle", "circle", "line", "icon"
2. Groups CANNOT contain: other groups, frames, autoLayoutFrame
3. Group children must have their own "x", "y" relative to group

AUTO-LAYOUT FRAME RULES:
1. Can only contain placeholder rectangles (no text, buttons, etc.)
2. Use "itemCount" for number of placeholder items
3. Items are auto-generated, don't specify children

TEXT SPECIFIC RULES:
1. Font weight values: "Regular", "Medium", "SemiBold", "Bold"
2. Text align values: "LEFT", "CENTER", "RIGHT"
3. Always use "text" property for content
4. Font family is optional (plugin uses Inter as fallback)

BUTTON SPECIFIC RULES:
1. Must have "text", "width", "height", "backgroundColor", "cornerRadius"
2. Optional: "textColor", "fontSize", "fontWeight", "borderColor", "borderWidth"

INPUT SPECIFIC RULES:
1. Must have "placeholder", "width", "height"
2. Optional: "backgroundColor", "borderColor", "borderWidth", "cornerRadius"

EXAMPLE VALID STRUCTURE:

{
  "frames": [
    {
      "type": "frame",
      "name": "Example Design",
      "width": 1440,
      "height": 800,
      "backgroundColor": "#FFFFFF",
      "children": [
        {
          "type": "text",
          "text": "Hello World",
          "fontSize": 32,
          "fontWeight": "Bold",
          "color": "#000000",
          "x": 50,
          "y": 50
        },
        {
          "type": "button",
          "text": "Click Me",
          "width": 200,
          "height": 50,
          "backgroundColor": "#007AFF",
          "cornerRadius": 8,
          "x": 50,
          "y": 120
        },
        {
          "type": "group",
          "name": "My Group",
          "x": 300,
          "y": 100,
          "children": [
            {
              "type": "rectangle",
              "width": 100,
              "height": 100,
              "color": "#FF0000",
              "x": 0,
              "y": 0
            },
            {
              "type": "text",
              "text": "In Group",
              "fontSize": 16,
              "x": 10,
              "y": 10
            }
          ]
        }
      ]
    }
  ]
}
`;

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
// GENERATE DESIGN FROM PROMPT - WITH SYSTEM PROMPT
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

        // Combine system prompt with user prompt
        const fullPrompt = `${SYSTEM_PROMPT}\n\nNow create a design for: ${prompt}\n\nReturn ONLY valid JSON following the rules above.`;

        console.log('📤 Sending request to Gemini API with system prompt...');

        // Generate content
        const result = await model.generateContent(fullPrompt);
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
                frames: [
                    {
                        type: "frame",
                        name: `${prompt} (Fallback Design)`,
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
                                text: "Design generated with fallback template",
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
                            }
                        ]
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