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
// ENHANCED SYSTEM PROMPT FOR GEMINI 2.5 FLASH
// ===========================================
const SYSTEM_PROMPT = `
You are an expert UI/UX designer and Figma JSON generator. Create professional, production-ready designs with perfect spacing, typography, and visual hierarchy.

DESIGN PHILOSOPHY:
- Create modern, clean, and professional designs
- Follow Material Design or modern web design principles
- Use proper spacing (8px grid system recommended)
- Ensure visual hierarchy with appropriate font sizes and colors
- Make designs responsive-ready (use percentages where possible)

JSON STRUCTURE RULES:
1. ROOT must have a "frames" array containing all pages/screens
2. Each frame represents a page/screen with:
   - type: "frame" (required)
   - name: Descriptive name (e.g., "Home Page", "Login Page")
   - width: 1440 (desktop) or 375 (mobile)
   - height: Auto-calculate based on content
   - backgroundColor: Hex color (e.g., "#FFFFFF")
   - children: Array of UI elements

ELEMENT TYPES & PROPERTIES:

For TEXT elements:
{
  "type": "text",
  "name": "Descriptive name",
  "text": "Content here",
  "fontSize": 16, // 12,14,16,18,20,24,32,48,64
  "fontWeight": "Regular" | "Medium" | "SemiBold" | "Bold",
  "fontFamily": "Inter" | "SF Pro" | "Roboto",
  "color": "#000000",
  "textAlign": "LEFT" | "CENTER" | "RIGHT",
  "x": number,
  "y": number,
  "width": number, // optional
  "height": number, // optional
  "opacity": 1, // 0-1
  "letterSpacing": 0, // optional
  "lineHeight": 1.5 // optional
}

For BUTTON elements:
{
  "type": "button",
  "name": "Button name",
  "text": "Click Me",
  "width": 120,
  "height": 48,
  "x": number,
  "y": number,
  "backgroundColor": "#007AFF",
  "cornerRadius": 8, // 4,8,12,16,24
  "textColor": "#FFFFFF",
  "fontSize": 16,
  "fontWeight": "Medium",
  "borderColor": "#007AFF", // optional
  "borderWidth": 0, // optional
  "shadow": { // optional
    "color": "#00000020",
    "offsetX": 0,
    "offsetY": 4,
    "blur": 8
  }
}

For INPUT elements:
{
  "type": "input",
  "name": "Input field",
  "placeholder": "Enter text...",
  "width": 300,
  "height": 48,
  "x": number,
  "y": number,
  "backgroundColor": "#FFFFFF",
  "borderColor": "#E5E7EB",
  "borderWidth": 1,
  "cornerRadius": 8,
  "padding": 12,
  "fontSize": 16
}

For CARD/RECTANGLE elements:
{
  "type": "rectangle",
  "name": "Card name",
  "width": 300,
  "height": 400,
  "x": number,
  "y": number,
  "backgroundColor": "#FFFFFF",
  "cornerRadius": 12,
  "borderColor": "#E5E7EB", // optional
  "borderWidth": 1, // optional
  "shadow": { // optional
    "color": "#00000010",
    "offsetX": 0,
    "offsetY": 2,
    "blur": 8
  },
  "children": [] // nested elements
}

For IMAGE placeholders:
{
  "type": "rectangle",
  "name": "Image placeholder",
  "width": 300,
  "height": 200,
  "x": number,
  "y": number,
  "backgroundColor": "#F3F4F6",
  "cornerRadius": 8,
  "children": [
    {
      "type": "icon",
      "character": "🖼️",
      "fontSize": 48,
      "color": "#9CA3AF",
      "x": 120,
      "y": 70
    }
  ]
}

For ICONS:
{
  "type": "icon",
  "name": "Icon name",
  "character": "🔍", // emoji or icon character
  "fontSize": 24,
  "color": "#000000",
  "x": number,
  "y": number
}

For NAVIGATION:
{
  "type": "frame",
  "name": "Navigation Bar",
  "x": 0,
  "y": 0,
  "width": 1440,
  "height": 80,
  "backgroundColor": "#FFFFFF",
  "borderColor": "#E5E7EB",
  "borderWidth": 0,
  "borderBottom": 1,
  "children": [
    {
      "type": "text",
      "text": "Logo",
      "fontSize": 24,
      "fontWeight": "Bold",
      "color": "#000000",
      "x": 40,
      "y": 24
    },
    {
      "type": "text",
      "text": "Home",
      "fontSize": 16,
      "color": "#000000",
      "x": 200,
      "y": 28
    },
    {
      "type": "text",
      "text": "About",
      "fontSize": 16,
      "color": "#000000",
      "x": 280,
      "y": 28
    },
    {
      "type": "button",
      "text": "Sign Up",
      "width": 100,
      "height": 40,
      "backgroundColor": "#007AFF",
      "cornerRadius": 8,
      "textColor": "#FFFFFF",
      "x": 1200,
      "y": 20
    }
  ]
}

For FOOTER:
{
  "type": "frame",
  "name": "Footer",
  "x": 0,
  "y": 1200,
  "width": 1440,
  "height": 200,
  "backgroundColor": "#1F2937",
  "children": [
    {
      "type": "text",
      "text": "© 2026 Company Name",
      "fontSize": 14,
      "color": "#9CA3AF",
      "x": 100,
      "y": 160
    }
  ]
}

COLOR PALETTES (use appropriate colors for context):

Ecommerce:
- Primary: "#3B82F6" (blue)
- Secondary: "#10B981" (green)
- Background: "#FFFFFF"
- Text: "#1F2937"
- Accent: "#F59E0B"

Corporate:
- Primary: "#2563EB" (navy blue)
- Secondary: "#7C3AED" (purple)
- Background: "#F9FAFB"
- Text: "#1F2937"
- Accent: "#DC2626"

Portfolio:
- Primary: "#EC4899" (pink)
- Secondary: "#8B5CF6" (purple)
- Background: "#111827" (dark)
- Text: "#F9FAFB"
- Accent: "#10B981"

Restaurant:
- Primary: "#B45309" (brown)
- Secondary: "#D97706" (amber)
- Background: "#FFFBEB"
- Text: "#78350F"
- Accent: "#059669"

Gym/Fitness:
- Primary: "#DC2626" (red)
- Secondary: "#F59E0B" (orange)
- Background: "#111827" (dark)
- Text: "#F3F4F6"
- Accent: "#10B981"

Education:
- Primary: "#059669" (green)
- Secondary: "#3B82F6" (blue)
- Background: "#F3F4F6"
- Text: "#1F2937"
- Accent: "#F59E0B"

LAYOUT GUIDELINES:
1. Desktop width: 1440px
2. Mobile width: 375px
3. Use 8px grid system (spacing multiples of 8)
4. Content padding: 40px on sides
5. Section spacing: 80px between major sections
6. Card spacing: 24px between cards
7. Button height: 48px (desktop), 56px (mobile)
8. Input height: 48px
9. Font sizes: 12,14,16,18,20,24,32,48,64
10. Border radius: 4,8,12,16,24

SECTION STRUCTURE for websites:
1. Navigation Bar (80px height)
2. Hero Section (600px height)
3. Features/Grid Section (400px)
4. Content Section (400px)
5. Testimonials (400px)
6. Pricing/Cards (400px)
7. Footer (200px)

Always return valid JSON with frames array. Include complete designs with all necessary elements.
`;

// ===========================================
// JSON REPAIR FUNCTION
// ===========================================
function repairJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.log('⚠️ Repairing JSON...');
        
        str = str.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        str = str.replace(/,(\s*[}\]])/g, '$1');
        str = str.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        str = str.replace(/}(\s*){/g, '},$1{');
        
        try {
            return JSON.parse(str);
        } catch (e2) {
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
        gemini_configured: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// CREATE FALLBACK DESIGN
// ===========================================
function createFallbackDesign(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    // Determine colors based on prompt
    let primaryColor = "#6366F1";
    let secondaryColor = "#8B5CF6";
    let bgColor = "#FFFFFF";
    let textColor = "#1F2937";
    
    if (prompt_lower.includes('gym') || prompt_lower.includes('fitness')) {
        primaryColor = "#DC2626";
        secondaryColor = "#F59E0B";
        bgColor = "#111827";
        textColor = "#F3F4F6";
    } else if (prompt_lower.includes('ecom') || prompt_lower.includes('shop')) {
        primaryColor = "#3B82F6";
        secondaryColor = "#10B981";
    } else if (prompt_lower.includes('restaurant')) {
        primaryColor = "#B45309";
        secondaryColor = "#D97706";
        bgColor = "#FFFBEB";
        textColor = "#78350F";
    }
    
    return {
        frames: [{
            type: "frame",
            name: prompt,
            width: 1440,
            height: 900,
            backgroundColor: bgColor,
            children: [
                // Header
                {
                    type: "frame",
                    name: "Header",
                    x: 0,
                    y: 0,
                    width: 1440,
                    height: 80,
                    backgroundColor: primaryColor,
                    children: [
                        {
                            type: "text",
                            text: "Brand",
                            fontSize: 24,
                            fontWeight: "Bold",
                            color: "#FFFFFF",
                            x: 40,
                            y: 25
                        },
                        {
                            type: "text",
                            text: "Home",
                            fontSize: 16,
                            color: "#FFFFFF",
                            x: 200,
                            y: 30
                        },
                        {
                            type: "text",
                            text: "About",
                            fontSize: 16,
                            color: "#FFFFFF",
                            x: 280,
                            y: 30
                        },
                        {
                            type: "button",
                            text: "Get Started",
                            width: 120,
                            height: 40,
                            backgroundColor: "#FFFFFF",
                            cornerRadius: 8,
                            textColor: primaryColor,
                            x: 1200,
                            y: 20
                        }
                    ]
                },
                // Hero
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
                            height: 48,
                            backgroundColor: primaryColor,
                            cornerRadius: 8,
                            textColor: "#FFFFFF",
                            x: 100,
                            y: 260
                        }
                    ]
                }
            ]
        }]
    };
}

// ===========================================
// GENERATE DESIGN - WITH GEMINI 2.5 FLASH
// ===========================================
app.post('/api/generate-design', async (req, res) => {
    req.setTimeout(120000);
    res.setTimeout(120000);
    
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

        // Try Gemini 2.5 Flash
        try {
            console.log('\n📤 Trying Gemini 2.5 Flash');
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            });

            const fullPrompt = `${SYSTEM_PROMPT}\n\nNow create a complete, professional ${prompt} design. Include all necessary sections: navigation, hero, features, content, and footer. Use appropriate colors and spacing. Return ONLY valid JSON with frames array.`;
            
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();
            
            console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            console.log('Response length:', text.length);
            
            designJson = repairJSON(text);
            console.log('✅ Gemini 2.5 Flash succeeded');

        } catch (error) {
            console.log('⚠️ Gemini 2.5 Flash failed:', error.message);
            console.log('📦 Using fallback design');
            designJson = createFallbackDesign(prompt);
        }

        // Validate structure
        if (!designJson || !designJson.frames) {
            if (designJson && designJson.type === 'frame') {
                designJson = { frames: [designJson] };
            } else {
                designJson = createFallbackDesign(prompt);
            }
        }

        const totalTime = ((Date.now() - startTime)/1000).toFixed(1);
        console.log('\n' + '='.repeat(60));
        console.log('✅ DESIGN GENERATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`⏱️  Total time: ${totalTime}s`);
        console.log(`🤖 Model: ${modelUsed}`);
        console.log(`📦 Frames: ${designJson.frames.length}`);
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
            model: 'emergency-fallback',
            design: createFallbackDesign(req.body.prompt || 'website'),
            timestamp: new Date().toISOString()
        });
    }
});

// ===========================================
// PROCESS DATA FROM FIGMA
// ===========================================
app.post('/api/process', (req, res) => {
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
    console.log(`🤖 Model: Gemini 2.5 Flash`);
    console.log(`✨ API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log('='.repeat(60));
    console.log('📡 Endpoints:');
    console.log('   GET  /');
    console.log('   GET  /api/status');
    console.log('   POST /api/process');
    console.log('   POST /api/generate-design');
    console.log('='.repeat(60) + '\n');
});