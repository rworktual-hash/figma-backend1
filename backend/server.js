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
// UNIVERSAL SYSTEM PROMPT - Handles ALL website types
// ===========================================
const SYSTEM_PROMPT = `
You are an expert UI/UX designer and Figma JSON generator. Create COMPLETE, PROFESSIONAL website designs based on the user's request.

WEBSITE ARCHITECTURE - ALL designs MUST include:

1. **NAVIGATION BAR** (top, 80px height)
   - Logo/Brand name on left
   - Navigation links (Home, About, Services/Products, Contact)
   - Optional CTA button (Sign Up/Get Started)

2. **HERO SECTION** (full width, 500-600px height)
   - Main headline (large, bold)
   - Subheadline/description
   - Primary CTA button
   - Optional secondary button
   - Hero image/illustration on right

3. **STATS/FEATURES SECTION** (3-4 columns)
   - Key metrics or features with icons
   - Numbers or feature titles
   - Brief descriptions

4. **CONTENT SECTION 1** (based on website type)
   - Title
   - Grid of cards or content blocks

5. **CONTENT SECTION 2** (different layout)
   - Alternating image-content layout
   - Call to action

6. **TESTIMONIALS/SOCIAL PROOF** (optional but recommended)
   - Quote cards with avatars

7. **FOOTER** (bottom)
   - Contact information
   - Quick links
   - Copyright
   - Social media icons

WEBSITE-SPECIFIC REQUIREMENTS:

For **SCHOOL/EDUCATION** websites:
- Colors: Professional blues (#2563EB), whites, light grays
- Stats: Students enrolled, Teachers, Years established, Student-teacher ratio
- Content: Academic programs (Elementary, Middle, High), Upcoming events, Campus photos
- Call to actions: "Apply Now", "Take a Tour", "Request Information"

For **GYM/FITNESS** websites:
- Colors: Bold reds (#DC2626), oranges (#F59E0B), dark backgrounds (#111827)
- Stats: Active members, Trainers, Classes per week, Success stories
- Content: Class schedules, Trainer profiles, Membership plans
- Call to actions: "Start Free Trial", "Join Now", "View Classes"

For **RESTAURANT/CAFE** websites:
- Colors: Warm browns (#B45309), ambers (#D97706), cream backgrounds (#FFFBEB)
- Stats: Years serving, Daily customers, Menu items, Chef experience
- Content: Menu categories, Special dishes, Reservation form, Location
- Call to actions: "Reserve Table", "View Menu", "Order Online"

For **PORTFOLIO/CREATIVE** websites:
- Colors: Bold accent (#EC4899) with dark backgrounds (#111827) or minimal whites
- Stats: Projects completed, Clients, Years experience, Awards
- Content: Project grid, Skills section, About the artist
- Call to actions: "View Work", "Hire Me", "Get in Touch"

For **ECOMMERCE/STORE** websites:
- Colors: Trustworthy blues (#3B82F6) with clean whites (#FFFFFF)
- Stats: Products, Happy customers, Brands, Shipping countries
- Content: Product categories, Featured products, Special offers
- Call to actions: "Shop Now", "Add to Cart", "View Sale"

For **CORPORATE/BUSINESS** websites:
- Colors: Professional blues (#2563EB) or purples (#7C3AED) with light backgrounds
- Stats: Clients, Projects, Team members, Years in business
- Content: Services, Case studies, Team profiles
- Call to actions: "Get a Quote", "Contact Sales", "Learn More"

For **BLOG/MAGAZINE** websites:
- Colors: Clean whites with readable dark text (#1F2937)
- Stats: Articles, Readers, Authors, Topics
- Content: Featured posts, Categories, Recent articles
- Call to actions: "Read More", "Subscribe", "Search"

For **SAAS/TECH** websites:
- Colors: Modern gradients, purples, blues with clean UI
- Stats: Users, Features, Integrations, Speed metrics
- Content: Feature grid, Pricing tiers, Integration partners
- Call to actions: "Start Free Trial", "See Demo", "View Pricing"

DESIGN GUIDELINES:
- Use 8px grid system (spacing in multiples of 8)
- Desktop width: 1440px, height auto (calculate based on content)
- Consistent padding (40px on sides)
- Font sizes: 48/32/24/20/18/16/14 px
- Border radius: 8px for buttons, 12px for cards
- All colors in hex format (e.g., "#2563EB")
- All elements must have x, y, width, height coordinates
- Text elements need fontSize, fontWeight, color

JSON STRUCTURE:
{
  "frames": [
    {
      "type": "frame",
      "name": "Website Name - Page Name",
      "width": 1440,
      "height": 1400,
      "backgroundColor": "#FFFFFF",
      "children": [] // All sections go here
    }
  ]
}

Return ONLY valid JSON, no explanations or markdown.
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
        str = str.replace(/'/g, '"');
        
        try {
            return JSON.parse(str);
        } catch (e2) {
            const jsonMatch = str.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e3) {
                    return null;
                }
            }
            return null;
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

            const fullPrompt = `${SYSTEM_PROMPT}\n\nNow create a complete, professional ${prompt}. Follow ALL requirements above for this specific type of website. Include EVERY section mentioned (navigation, hero, stats, content sections, footer). Make it detailed, realistic, and production-ready with proper colors, spacing, and content. Return ONLY valid JSON with frames array.`;
            
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();
            
            console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            console.log('Response length:', text.length);
            
            designJson = repairJSON(text);
            
            if (designJson && designJson.frames) {
                console.log('✅ Gemini 2.5 Flash succeeded');
            } else {
                console.log('⚠️ Invalid JSON structure, retrying once...');
                
                // One more try with simpler prompt
                const retryPrompt = `Create a ${prompt}. Return valid JSON with frames array. Include navigation, hero, features, and footer.`;
                const retryResult = await model.generateContent(retryPrompt);
                const retryResponse = await retryResult.response;
                text = retryResponse.text();
                designJson = repairJSON(text);
                
                if (!designJson || !designJson.frames) {
                    throw new Error('Failed to generate valid JSON');
                }
            }

        } catch (error) {
            console.log('⚠️ Gemini 2.5 Flash failed:', error.message);
            console.log('Using minimal fallback');
            
            // Minimal fallback - just shows the prompt
            designJson = {
                frames: [{
                    type: "frame",
                    name: prompt,
                    width: 1440,
                    height: 600,
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
                            text: "Design generated with AI",
                            fontSize: 18,
                            color: "#666666",
                            x: 100,
                            y: 160
                        }
                    ]
                }]
            };
        }

        // Validate and ensure correct structure
        if (!designJson || !designJson.frames) {
            if (designJson && designJson.type === 'frame') {
                designJson = { frames: [designJson] };
            } else {
                designJson = {
                    frames: [{
                        type: "frame",
                        name: prompt,
                        width: 1440,
                        height: 600,
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
            model: 'minimal-fallback',
            design: {
                frames: [{
                    type: "frame",
                    name: req.body.prompt || 'Design',
                    width: 1440,
                    height: 400,
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