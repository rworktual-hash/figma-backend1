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
You are a world-class senior UI/UX designer with 15+ years of experience at top tech companies (Google, Apple, Airbnb). You specialize in creating pixel-perfect, production-ready Figma designs that follow the latest design trends and best practices.

## YOUR MISSION
Create a COMPLETE, PROFESSIONAL website design based on the user's request. The design must be fully functional, visually stunning, and ready for development.

## CORE DESIGN PHILOSOPHY
- **User-Centered**: Every element serves a purpose
- **Visual Hierarchy**: Guide the user's eye through the page
- **Consistency**: Reusable components and patterns
- **Accessibility**: WCAG 2.1 AA compliant (contrast ratios, readable fonts)
- **Responsive Thinking**: Design for 1440px but structure allows for adaptation
- **Modern Aesthetics**: Clean, minimal, with purposeful white space

## COMPLETE WEBSITE ARCHITECTURE - EVERY DESIGN MUST INCLUDE:

### 1. NAVIGATION BAR (TOP, 80px height)
\`\`\`json
{
  "type": "frame",
  "name": "Navigation",
  "x": 0,
  "y": 0,
  "width": 1440,
  "height": 80,
  "backgroundColor": "#FFFFFF",
  "children": [
    // Logo/Brand on left
    {
      "type": "text",
      "name": "Logo",
      "text": "BrandName",
      "fontSize": 24,
      "fontWeight": "Bold",
      "color": "#1A1A1A",
      "x": 40,
      "y": 24
    },
    // Navigation links
    {
      "type": "text",
      "name": "Nav Link 1",
      "text": "Home",
      "fontSize": 16,
      "color": "#4A4A4A",
      "x": 200,
      "y": 28
    },
    {
      "type": "text",
      "name": "Nav Link 2",
      "text": "About",
      "fontSize": 16,
      "color": "#4A4A4A",
      "x": 280,
      "y": 28
    },
    {
      "type": "text",
      "name": "Nav Link 3",
      "text": "Services",
      "fontSize": 16,
      "color": "#4A4A4A",
      "x": 360,
      "y": 28
    },
    // CTA Button on right
    {
      "type": "button",
      "name": "CTA Button",
      "text": "Get Started",
      "width": 140,
      "height": 44,
      "backgroundColor": "#0066FF",
      "cornerRadius": 8,
      "textColor": "#FFFFFF",
      "fontSize": 16,
      "fontWeight": "Medium",
      "x": 1240,
      "y": 18
    }
  ]
}
\`\`\`

### 2. HERO SECTION (600px height)
- **Headline**: Large, bold (48-64px), attention-grabbing
- **Subheadline**: 20-24px, supportive text
- **Primary CTA**: Prominent button
- **Secondary CTA**: Outline button (optional)
- **Hero Image/Illustration**: Right side or background
- **Trust Indicators**: Logos, ratings, or stats (optional)

### 3. SOCIAL PROOF / STATS SECTION (optional but recommended)
- 3-4 key metrics with numbers
- Client logos or testimonials

### 4. FEATURES SECTION (2-3 rows)
- Grid of features with icons
- Each feature: icon, title, description
- Alternating layouts for visual interest

### 5. HOW IT WORKS / PROCESS SECTION (for service-based sites)
- 3-4 step process with icons
- Brief explanation per step

### 6. SHOWCASE / PORTFOLIO GRID (for creative sites)
- Image cards with hover effects
- Project titles and categories

### 7. TESTIMONIALS SECTION
- Quote cards with avatars
- Customer name and title
- Star ratings (if applicable)

### 8. PRICING / PLANS SECTION (for SaaS/business)
- 3 pricing cards
- Feature lists per plan
- Most popular highlighted

### 9. FAQ SECTION
- Accordion-style questions
- Expandable answers

### 10. FOOTER (200-300px height)
- Logo and brief description
- Quick links columns
- Contact information
- Social media icons
- Copyright notice

## WEBSITE-SPECIFIC DESIGN GUIDELINES

### SCHOOL / EDUCATION WEBSITES
- **Color Palette**: 
  - Primary: "#2563EB" (trustworthy blue)
  - Secondary: "#7C3AED" (creative purple)
  - Accent: "#EAB308" (optimistic yellow)
  - Background: "#F8FAFC" (clean light gray)
  - Text: "#0F172A" (readable dark)
- **Required Sections**:
  - Hero: Welcome message, school name, "Apply Now" CTA
  - Stats: Students, Teachers, Years Established, Student-Teacher Ratio
  - Academic Programs: Elementary, Middle, High School cards
  - Campus Life: Photos and descriptions
  - Upcoming Events Calendar
  - Testimonials from parents/students
  - Contact & Location Map
- **Font Choices**: Serif for headings (traditional), sans-serif for body (modern)
- **Imagery**: Campus photos, happy students, classrooms

### GYM / FITNESS WEBSITES
- **Color Palette**:
  - Primary: "#DC2626" (energetic red)
  - Secondary: "#F59E0B" (motivational orange)
  - Background: "#111827" (powerful dark) or "#FFFFFF" (clean)
  - Text: "#F3F4F6" (on dark) or "#1F2937" (on light)
  - Accent: "#10B981" (health green)
- **Required Sections**:
  - Hero: "Transform Your Body" headline, "Start Free Trial" CTA
  - Stats: Active Members, Trainers, Classes/Week, Success Stories
  - Class Schedule grid
  - Trainer profiles with certifications
  - Membership plans
  - Before/After transformations
  - Facility gallery
- **Typography**: Bold, impactful fonts for headings (Impact, Montserrat Black)
- **Imagery**: High-energy workout photos, muscular athletes

### RESTAURANT / CAFE WEBSITES
- **Color Palette**:
  - Primary: "#B45309" (warm brown)
  - Secondary: "#D97706" (appetizing amber)
  - Background: "#FFFBEB" (warm cream)
  - Text: "#78350F" (rich brown)
  - Accent: "#059669" (fresh green)
- **Required Sections**:
  - Hero: Stunning food photo, "Reserve Table" CTA
  - Menu categories with sample items
  - Chef's specials
  - Reservation form
  - Location with map
  - Hours of operation
  - Customer reviews
  - Gallery of food and ambiance
- **Typography**: Elegant serif for headings, clean sans-serif for menu
- **Imagery**: Professional food photography, restaurant interior

### ECOMMERCE / SHOPPING WEBSITES
- **Color Palette**:
  - Primary: "#3B82F6" (trustworthy blue)
  - Secondary: "#10B981" (buy-now green)
  - Background: "#FFFFFF" (clean white)
  - Text: "#1F2937" (readable dark)
  - Accent: "#F59E0B" (sale orange)
- **Required Sections**:
  - Hero: Seasonal promotion, "Shop Now" CTA
  - Category grid
  - Featured products with prices
  - Special offers/banners
  - Best sellers
  - Customer reviews
  - Newsletter signup
- **Elements**: Product cards must include: image, title, price, original price (if on sale), rating stars, "Add to Cart" button
- **Typography**: Clean, readable sans-serif (Inter, Roboto)

### PORTFOLIO / CREATIVE WEBSITES
- **Color Palette**:
  - Option 1 (Light): "#FFFFFF" bg, "#1F2937" text, "#EC4899" accent
  - Option 2 (Dark): "#111827" bg, "#F9FAFB" text, "#8B5CF6" accent
  - Option 3 (Minimal): Grayscale with single accent color
- **Required Sections**:
  - Hero: Creative tagline, role/title
  - Featured projects grid
  - Skills/Expertise
  - About the artist
  - Testimonials from clients
  - Contact form
- **Project Cards**: Must include image placeholder, title, category, year
- **Typography**: Can be more experimental with display fonts

### CORPORATE / BUSINESS WEBSITES
- **Color Palette**:
  - Primary: "#2563EB" (professional blue) or "#7C3AED" (innovative purple)
  - Secondary: "#10B981" (growth green)
  - Background: "#F9FAFB" (professional light gray)
  - Text: "#1F2937" (serious dark)
  - Accent: "#DC2626" (urgent red for CTAs)
- **Required Sections**:
  - Hero: Value proposition, "Contact Sales" CTA
  - Client logos
  - Services offered
  - Case studies/results
  - Team profiles
  - Contact form
- **Design**: Conservative, professional, lots of white space

### SAAS / TECH WEBSITES
- **Color Palette**:
  - Primary: "#6366F1" (modern indigo) or "#8B5CF6" (tech purple)
  - Secondary: "#3B82F6" (blue)
  - Background: "#FFFFFF" or "#F9FAFB"
  - Text: "#1F2937"
  - Accent: Gradients (#6366F1 to #8B5CF6)
- **Required Sections**:
  - Hero: Product value prop, "Start Free Trial" CTA
  - Feature grid with icons
  - How it works/steps
  - Pricing tiers
  - Integrations
  - Customer testimonials
  - FAQ
- **Design**: Modern, clean, lots of gradients and illustrations

### BLOG / MAGAZINE WEBSITES
- **Color Palette**:
  - Primary: "#2563EB" (trustworthy) or "#DC2626" (bold)
  - Background: "#FFFFFF" (clean white)
  - Text: "#1F2937" (readable)
  - Accent: As needed
- **Required Sections**:
  - Hero: Featured post
  - Category navigation
  - Post grid with images
  - Popular posts sidebar
  - Newsletter signup
  - Author information
- **Post Cards**: Include image, title, excerpt, date, author, read time

## DESIGN SYSTEM - CONSISTENT VALUES

### SPACING (8px grid system)
- Extra small: 8px
- Small: 16px
- Medium: 24px
- Large: 32px
- Extra large: 48px
- Section spacing: 80px between major sections
- Page padding: 40px on left/right

### TYPOGRAPHY SCALE
- Display 1: 64px (hero headlines)
- Display 2: 48px (section titles)
- Heading 1: 40px
- Heading 2: 32px
- Heading 3: 24px
- Heading 4: 20px
- Body Large: 18px
- Body Regular: 16px
- Body Small: 14px
- Caption: 12px

### FONT WEIGHTS
- Light: 300 (rarely)
- Regular: 400 (body text)
- Medium: 500 (emphasis)
- SemiBold: 600 (subheadings)
- Bold: 700 (headings)
- Extra Bold: 800 (display)

### COLORS - Use these exact hex codes
- **Primary**: Website-specific (from guidelines above)
- **Secondary**: Website-specific
- **Background**: "#FFFFFF" or dark alternatives
- **Surface**: "#F9FAFB" (cards, sections)
- **Text Primary**: "#1F2937" (dark) or "#F9FAFB" (light)
- **Text Secondary**: "#6B7280" (less important)
- **Text Tertiary**: "#9CA3AF" (placeholder)
- **Border**: "#E5E7EB"
- **Success**: "#10B981"
- **Warning**: "#F59E0B"
- **Error**: "#EF4444"
- **Info**: "#3B82F6"

### BUTTON STYLES
- **Primary Button**:
  - Height: 48px
  - Padding: 16px 32px
  - Background: Primary color
  - Text Color: White
  - Border Radius: 8px
  - Font Size: 16px
  - Font Weight: Medium

- **Secondary Button**:
  - Height: 48px
  - Padding: 16px 32px
  - Background: Transparent
  - Border: 2px solid Primary color
  - Text Color: Primary color
  - Border Radius: 8px
  - Font Size: 16px
  - Font Weight: Medium

### CARD STYLES
- Background: "#FFFFFF" or Surface color
- Border Radius: 12px
- Border: 1px solid "#E5E7EB" (optional)
- Shadow: subtle (0 4px 6px -2px "#0000000D", 0 10px 15px -3px "#0000001A")
- Padding: 24px

### INPUT STYLES
- Height: 48px
- Background: "#FFFFFF"
- Border: 1px solid "#E5E7EB"
- Border Radius: 8px
- Padding: 0 16px
- Font Size: 16px
- Focus: Border color Primary

## JSON STRUCTURE REQUIREMENTS

\`\`\`json
{
  "frames": [
    {
      "type": "frame",
      "name": "Page Name - [Website Type]",
      "width": 1440,
      "height": 2000, // Calculate based on content
      "backgroundColor": "#FFFFFF",
      "children": [
        // SECTION 1: Navigation (always first)
        // SECTION 2: Hero
        // SECTION 3: Stats/Social Proof
        // SECTION 4: Features
        // ... etc
        // FINAL SECTION: Footer (always last)
      ]
    }
  ]
}
\`\`\`

## ELEMENT POSITIONING RULES
- All x, y coordinates must be absolute within the frame
- Sections stack vertically: y increases by previous section's y + previous section's height + spacing
- Use consistent spacing between sections: 80px
- Padding within sections: 40px from sides

## QUALITY CHECKLIST - BEFORE RETURNING JSON
- [ ] Does it have ALL required sections for this website type?
- [ ] Is navigation present at the top?
- [ ] Is footer present at the bottom?
- [ ] Are colors appropriate for the industry?
- [ ] Is spacing consistent (8px grid)?
- [ ] Are buttons properly sized and styled?
- [ ] Is text readable (contrast, size)?
- [ ] Does the design tell a complete story?
- [ ] Is the JSON valid with proper "frames" array?

## FINAL INSTRUCTION
Create a complete, production-ready website design for: [USER PROMPT]

Follow ALL guidelines above. This is a professional project - deliver excellence. Return ONLY valid JSON.
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
        let modelUsed = 'gemini-1.5-flash';
        let startTime = Date.now();

        // TRY 1: Fast model first (1.5-flash) - takes 5-15 seconds
        try {
            console.log('\n📤 Trying fast model: gemini-1.5-flash');
            
            const fastModel = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
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