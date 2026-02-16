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
        if (!origin || 
            origin.includes('localhost') || 
            origin.includes('127.0.0.1') ||
            origin === 'null' ||
            origin.includes('figma.com')) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

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
    
    const testFile = path.join(DEBUG_DIR, '.test_write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Debug directory is writable');
} catch (error) {
    console.error('❌ Debug directory error:', error.message);
}

// ===========================================
// SYSTEM PROMPTS FOR DIFFERENT PAGE TYPES
// ===========================================

const BASE_SYSTEM_PROMPT = `
You are a Figma JSON generator. Create UI designs in Figma format.

CRITICAL RULES:
1. Return ONLY valid JSON with a "frames" array
2. Each frame needs: type, name, width, height, backgroundColor, children array
3. Use hex colors: "#FFFFFF", "#000000", "#007AFF", "#4CAF50", "#FF4444"
4. Valid element types: text, rectangle, button, circle, line, icon, group, input, frame
5. All elements must have x, y coordinates
6. Buttons should have: type, text, width, height, backgroundColor, textColor, x, y, cornerRadius
7. Input fields should have: type, placeholder, width, height, backgroundColor, x, y

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

const LOGIN_PAGE_PROMPT = `
You are a Figma JSON generator specializing in Login/Authentication pages.

Create a professional login page with:
- Clean centered layout
- Email/username input field
- Password input field
- Login button (primary action)
- "Forgot password?" link
- "Sign up" or "Create account" link
- Optional: Social login buttons (Google, Facebook, etc.)
- Logo/branding at top

Design requirements:
- Center all elements vertically and horizontally
- Use consistent spacing (24-32px between elements)
- Input fields: 320px width, 48px height, rounded corners (8px)
- Primary button: Full width of inputs, 48px height, prominent color
- Professional color scheme (blues, whites, light grays)

CRITICAL: Return ONLY valid JSON. All interactive elements must be clearly labeled.
`;

const HOME_PAGE_PROMPT = `
You are a Figma JSON generator specializing in Home/Landing pages.

Create a comprehensive home page with these sections:
1. Navigation bar with logo and menu items (Home, Features, About, Contact, Login)
2. Hero section with headline, subheadline, and CTA button
3. Features/Services section (3-4 feature cards with icons)
4. About/Content section
5. Call-to-action section
6. Footer with links and copyright

Design requirements:
- Professional, modern design
- Clear visual hierarchy
- Multiple interactive buttons that could link to other pages
- Consistent color scheme
- Responsive layout (1440px width)

CRITICAL: Include multiple buttons that would require detail pages (e.g., "Learn More", "Get Started", "View Details", "Contact Us").
Return ONLY valid JSON with all interactive elements clearly labeled.
`;

const DETAIL_PAGE_PROMPT = `
You are a Figma JSON generator specializing in Detail/Content pages.

Create a detailed content page based on the specific feature or section provided.

Page structure:
1. Navigation bar (consistent with home page)
2. Page header with title and breadcrumb
3. Main content area with detailed information, images or icons, feature highlights
4. Call-to-action section
5. Related links or next steps
6. Footer (consistent with home page)

Design requirements:
- Match the design system from previous pages (colors, typography, spacing)
- Professional layout with good readability
- Clear back navigation
- Relevant action buttons

CRITICAL: Return ONLY valid JSON. Maintain consistency with the overall website design.
`;

// ===========================================
// PROJECT STATE MANAGEMENT
// ===========================================
const projects = new Map();
const PROJECT_TIMEOUT = 24 * 60 * 60 * 1000;

const PAGE_TYPES = {
    LOGIN: 'login',
    HOME: 'home',
    DETAIL: 'detail',
    CONTACT: 'contact',
    ABOUT: 'about',
    FEATURES: 'features'
};

// ===========================================
// PROJECT MANAGEMENT FUNCTIONS
// ===========================================

function createProject(projectName, description, requestedPages) {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const project = {
        id: projectId,
        name: projectName,
        description: description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        pages: [],
        pendingPages: [...requestedPages],
        completedPages: [],
        currentPageIndex: 0,
        totalPages: requestedPages.length,
        designSystem: { colors: {}, typography: {}, spacing: {} },
        interactiveElements: [],
        context: {}
    };
    
    projects.set(projectId, project);
    
    setTimeout(() => {
        if (projects.has(projectId)) {
            console.log(`🧹 Cleaning up project: ${projectId}`);
            projects.delete(projectId);
        }
    }, PROJECT_TIMEOUT);
    
    return project;
}

function getProject(projectId) {
    return projects.get(projectId);
}

function updateProject(projectId, updates) {
    const project = projects.get(projectId);
    if (project) {
        Object.assign(project, updates, { updatedAt: new Date().toISOString() });
        projects.set(projectId, project);
    }
    return project;
}

function addPageToProject(projectId, pageData) {
    const project = projects.get(projectId);
    if (!project) return null;
    
    project.pages.push(pageData);
    project.completedPages.push(pageData.type);
    project.currentPageIndex++;
    
    const pendingIndex = project.pendingPages.indexOf(pageData.type);
    if (pendingIndex > -1) {
        project.pendingPages.splice(pendingIndex, 1);
    }
    
    const interactiveElements = extractInteractiveElements(pageData.json);
    project.interactiveElements.push(...interactiveElements);
    updateDesignSystem(project, pageData.json);
    
    projects.set(projectId, project);
    return project;
}

function updateDesignSystem(project, pageJson) {
    if (pageJson.frames && pageJson.frames[0]) {
        const frame = pageJson.frames[0];
        if (frame.backgroundColor) {
            project.designSystem.colors.background = frame.backgroundColor;
        }
        
        if (frame.children) {
            const button = frame.children.find(c => c.type === 'button');
            if (button && button.backgroundColor) {
                project.designSystem.colors.primary = button.backgroundColor;
            }
        }
    }
}

function extractInteractiveElements(pageJson) {
    const elements = [];
    if (!pageJson.frames || !pageJson.frames[0]) return elements;
    
    const frame = pageJson.frames[0];
    if (!frame.children) return elements;
    
    frame.children.forEach((child, index) => {
        if (child.type === 'button' || child.type === 'input') {
            elements.push({
                id: `${frame.name}_element_${index}`,
                type: child.type,
                text: child.text || child.placeholder || 'Unnamed',
                action: inferActionFromText(child.text || child.placeholder || ''),
                x: child.x,
                y: child.y,
                sourcePage: frame.name
            });
        }
    });
    
    return elements;
}

function inferActionFromText(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('login') || lowerText.includes('sign in')) return 'login';
    if (lowerText.includes('sign up') || lowerText.includes('register')) return 'register';
    if (lowerText.includes('contact') || lowerText.includes('reach')) return 'contact';
    if (lowerText.includes('learn') || lowerText.includes('more')) return 'detail';
    if (lowerText.includes('start') || lowerText.includes('begin')) return 'get_started';
    if (lowerText.includes('feature')) return 'features';
    if (lowerText.includes('about')) return 'about';
    return 'detail';
}

function getNextPageType(project) {
    if (project.pendingPages.length > 0) {
        return project.pendingPages[0];
    }
    
    if (project.interactiveElements.length > project.pages.length - 2) {
        return PAGE_TYPES.DETAIL;
    }
    
    return null;
}

function analyzeDescriptionForPages(description) {
    const lowerDesc = description.toLowerCase();
    const pages = [];
    
    if (lowerDesc.includes('login') || lowerDesc.includes('auth')) {
        pages.push(PAGE_TYPES.LOGIN);
    }
    
    pages.push(PAGE_TYPES.HOME);
    
    if (lowerDesc.includes('feature')) {
        pages.push(PAGE_TYPES.FEATURES);
    }
    
    if (lowerDesc.includes('about')) {
        pages.push(PAGE_TYPES.ABOUT);
    }
    
    if (lowerDesc.includes('contact')) {
        pages.push(PAGE_TYPES.CONTACT);
    }
    
    if (pages.length < 3) {
        pages.push(PAGE_TYPES.DETAIL);
        pages.push(PAGE_TYPES.DETAIL);
    }
    
    return pages;
}

function buildGenerationPrompt(project, pageType) {
    const projectName = project.name;
    const description = project.description;
    
    switch (pageType) {
        case PAGE_TYPES.LOGIN:
            return `Create a login page for: ${projectName}. ${description}. Make it complete with form fields and buttons.`;
        case PAGE_TYPES.HOME:
            return `Create a home/landing page for: ${projectName}. ${description}. Include navigation, hero, features, and multiple CTA buttons.`;
        case PAGE_TYPES.DETAIL:
            const elementIndex = project.pages.length > 0 ? project.pages.length - 1 : 0;
            if (project.interactiveElements[elementIndex]) {
                const element = project.interactiveElements[elementIndex];
                return `Create a detail page for: "${element.text}" from ${projectName}. ${description}. This page should expand on this feature.`;
            }
            return `Create a detail/content page for: ${projectName}. ${description}. Include detailed information about a specific feature or section.`;
        case PAGE_TYPES.CONTACT:
            return `Create a contact page for: ${projectName}. ${description}. Include contact form, contact info, and business hours.`;
        case PAGE_TYPES.ABOUT:
            return `Create an about page for: ${projectName}. ${description}. Include company story, team, mission/vision.`;
        case PAGE_TYPES.FEATURES:
            return `Create a features page for: ${projectName}. ${description}. Include detailed feature descriptions and benefits.`;
        default:
            return `Create a page for: ${projectName}. ${description}`;
    }
}

function getPagePrompt(pageType) {
    switch (pageType) {
        case PAGE_TYPES.LOGIN:
            return LOGIN_PAGE_PROMPT;
        case PAGE_TYPES.HOME:
            return HOME_PAGE_PROMPT;
        case PAGE_TYPES.DETAIL:
            return DETAIL_PAGE_PROMPT;
        case PAGE_TYPES.CONTACT:
            return DETAIL_PAGE_PROMPT + '\n\nThis is a CONTACT page. Include contact form, contact information, map placeholder, and business hours.';
        case PAGE_TYPES.ABOUT:
            return DETAIL_PAGE_PROMPT + '\n\nThis is an ABOUT page. Include company story, team section, mission/vision, and company values.';
        case PAGE_TYPES.FEATURES:
            return DETAIL_PAGE_PROMPT + '\n\nThis is a FEATURES page. Include detailed feature descriptions, benefits, pricing tables, and comparison sections.';
        default:
            return BASE_SYSTEM_PROMPT;
    }
}

function buildPageContext(project, pageType) {
    let context = '';
    
    if (project.designSystem.colors.primary) {
        context += `\nDesign System - Primary Color: ${project.designSystem.colors.primary}\n`;
    }
    if (project.designSystem.colors.background) {
        context += `Design System - Background: ${project.designSystem.colors.background}\n`;
    }
    
    if (project.pages.length > 0) {
        const lastPage = project.pages[project.pages.length - 1];
        context += `\nPrevious Page: ${lastPage.name} (${lastPage.type})\n`;
    }
    
    return context;
}

// ===========================================
// ENHANCED FILE SAVING FUNCTIONS
// ===========================================

function saveJsonToFile(prompt, jsonData, isRaw = false, status = 'SUCCESS', projectId = null) {
    try {
        if (!fs.existsSync(DEBUG_DIR)) {
            fs.mkdirSync(DEBUG_DIR, { recursive: true });
        }

        const timestamp = Date.now();
        const date = new Date().toISOString().replace(/[:.]/g, '-');
        const promptSlug = (prompt || 'unknown').substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
        
        let filename;
        if (projectId) {
            if (isRaw) {
                filename = `${status}_PROJECT_${projectId}_PAGE_${promptSlug}_${date}.txt`;
            } else {
                filename = `${status}_PROJECT_${projectId}_PARSED_${promptSlug}_${date}.txt`;
            }
        } else {
            if (isRaw) {
                filename = `${status}_raw_${promptSlug}_${date}.txt`;
            } else {
                filename = `${status}_parsed_${promptSlug}_${date}.txt`;
            }
        }
        
        const filePath = path.join(DEBUG_DIR, filename);
        
        if (!jsonData) {
            console.warn('⚠️ No data provided to save');
            return null;
        }
        
        let contentToWrite = jsonData;
        if (projectId && typeof jsonData === 'string') {
            const metadata = `/*\nProject ID: ${projectId}\nTimestamp: ${new Date().toISOString()}\nStatus: ${status}\nPrompt: ${prompt}\n*/\n\n`;
            contentToWrite = metadata + jsonData;
        }
        
        fs.writeFileSync(filePath, contentToWrite, 'utf8');
        console.log(`💾 Saved to file: ${filename} (${Buffer.byteLength(contentToWrite, 'utf8')} bytes)`);
        return filePath;
    } catch (error) {
        console.error('❌ Error saving file:', error.message);
        return null;
    }
}

function saveProjectManifest(project) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `PROJECT_${project.id}_MANIFEST_${timestamp}.txt`;
        const filePath = path.join(DEBUG_DIR, filename);
        
        const manifest = {
            projectId: project.id,
            projectName: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            status: project.status,
            totalPages: project.pages.length,
            completedPages: project.completedPages,
            pendingPages: project.pendingPages,
            designSystem: project.designSystem,
            interactiveElementsCount: project.interactiveElements.length,
            pages: project.pages.map(p => ({
                name: p.name,
                type: p.type,
                frameCount: p.json.frames ? p.json.frames.length : 0,
                fileSaved: p.filePath || 'Not saved'
            }))
        };
        
        const content = `/*\nPROJECT MANIFEST\n================\nGenerated: ${new Date().toISOString()}\n*/\n\n${JSON.stringify(manifest, null, 2)}`;
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`📋 Project manifest saved: ${filename}`);
        return filename;
    } catch (error) {
        console.error('❌ Error saving project manifest:', error.message);
        return null;
    }
}

function saveCompleteProject(project) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `PROJECT_${project.id}_COMPLETE_${timestamp}.txt`;
        const filePath = path.join(DEBUG_DIR, filename);
        
        const completeProject = {
            projectId: project.id,
            projectName: project.name,
            description: project.description,
            createdAt: project.createdAt,
            generatedAt: new Date().toISOString(),
            status: 'completed',
            designSystem: project.designSystem,
            allPages: project.pages.map(p => p.json)
        };
        
        const content = `/*\nCOMPLETE PROJECT JSON\n=====================\nProject: ${project.name}\nGenerated: ${new Date().toISOString()}\nTotal Pages: ${project.pages.length}\n*/\n\n${JSON.stringify(completeProject, null, 2)}`;
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`📦 Complete project saved: ${filename}`);
        return filename;
    } catch (error) {
        console.error('❌ Error saving complete project:', error.message);
        return null;
    }
}

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
// FALLBACK DESIGN FUNCTIONS
// ===========================================

function createFallbackDesign(prompt) {
    const promptLower = prompt.toLowerCase();
    
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
                {
                    type: "frame",
                    name: "Navigation",
                    x: 0,
                    y: 0,
                    width: 1440,
                    height: 80,
                    backgroundColor: primaryColor,
                    children: [
                        { type: "text", text: prompt.split(' ')[0] || "Brand", fontSize: 24, fontWeight: "Bold", color: "#FFFFFF", x: 40, y: 24 },
                        { type: "text", text: "Home", fontSize: 16, color: "#FFFFFF", x: 300, y: 28 },
                        { type: "text", text: "About", fontSize: 16, color: "#FFFFFF", x: 380, y: 28 },
                        { type: "text", text: "Services", fontSize: 16, color: "#FFFFFF", x: 460, y: 28 },
                        { type: "text", text: "Contact", fontSize: 16, color: "#FFFFFF", x: 560, y: 28 }
                    ]
                },
                {
                    type: "frame",
                    name: "Hero",
                    x: 0,
                    y: 80,
                    width: 1440,
                    height: 400,
                    backgroundColor: bgColor,
                    children: [
                        { type: "text", text: prompt, fontSize: 48, fontWeight: "Bold", color: primaryColor, x: 100, y: 120 },
                        { type: "text", text: "Professional design generated by AI", fontSize: 20, color: textColor, x: 100, y: 190 },
                        { type: "button", text: "Learn More", width: 160, height: 50, backgroundColor: primaryColor, cornerRadius: 8, textColor: "#FFFFFF", x: 100, y: 260 }
                    ]
                },
                {
                    type: "frame",
                    name: "Features",
                    x: 0,
                    y: 480,
                    width: 1440,
                    height: 300,
                    backgroundColor: "#F9FAFB",
                    children: [
                        { type: "text", text: "Our Features", fontSize: 32, fontWeight: "Bold", color: textColor, x: 100, y: 520 }
                    ]
                },
                {
                    type: "frame",
                    name: "Footer",
                    x: 0,
                    y: 780,
                    width: 1440,
                    height: 120,
                    backgroundColor: "#1F2937",
                    children: [
                        { type: "text", text: "© 2026 All rights reserved", fontSize: 14, color: "#9CA3AF", x: 100, y: 830 }
                    ]
                }
            ]
        }]
    };
}

function createFallbackDesignForPage(pageType, project) {
    const primaryColor = project.designSystem.colors.primary || "#007AFF";
    const bgColor = project.designSystem.colors.background || "#FFFFFF";
    const textColor = project.designSystem.colors.primary ? "#000000" : "#333333";
    
    if (pageType === PAGE_TYPES.LOGIN) {
        return {
            frames: [{
                type: "frame",
                name: "Login Page",
                width: 1440,
                height: 900,
                backgroundColor: "#F3F4F6",
                children: [
                    {
                        type: "frame",
                        name: "Login Container",
                        x: 560,
                        y: 200,
                        width: 320,
                        height: 400,
                        backgroundColor: "#FFFFFF",
                        cornerRadius: 16,
                        children: [
                            { type: "text", text: "Welcome Back", fontSize: 28, fontWeight: "Bold", color: "#000000", x: 80, y: 40 },
                            { type: "text", text: "Sign in to continue", fontSize: 14, color: "#6B7280", x: 100, y: 80 },
                            { type: "input", placeholder: "Email", width: 280, height: 48, backgroundColor: "#F9FAFB", x: 20, y: 120 },
                            { type: "input", placeholder: "Password", width: 280, height: 48, backgroundColor: "#F9FAFB", x: 20, y: 180 },
                            { type: "button", text: "Sign In", width: 280, height: 48, backgroundColor: primaryColor, cornerRadius: 8, textColor: "#FFFFFF", x: 20, y: 250 },
                            { type: "text", text: "Forgot password?", fontSize: 14, color: primaryColor, x: 90, y: 320 },
                            { type: "text", text: "Don't have an account? Sign up", fontSize: 14, color: primaryColor, x: 50, y: 350 }
                        ]
                    }
                ]
            }]
        };
    }
    
    return createFallbackDesign(`${pageType} page for ${project.name}`);
}

// ===========================================
// API ENDPOINTS
// ===========================================

app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: '✅ Figma backend with Gemini is LIVE!',
        endpoints: {
            health: 'GET /',
            status: 'GET /api/status',
            generate: 'POST /api/generate-design',
            generateProject: 'POST /api/generate-project',
            generateNextPage: 'POST /api/generate-next-page',
            projectStatus: 'GET /api/project/:projectId/status',
            projectPages: 'GET /api/project/:projectId/pages',
            listFiles: 'GET /api/debug/files'
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        gemini_configured: !!process.env.GEMINI_API_KEY,
        activeProjects: projects.size,
        timestamp: new Date().toISOString()
    });
});

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

app.get('/api/debug/file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(DEBUG_DIR, filename);
        
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
// SINGLE PAGE GENERATION (Legacy Endpoint)
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

        console.log('\n' + '='.repeat(60));
        console.log('🎨 SINGLE PAGE GENERATION REQUEST');
        console.log('='.repeat(60));
        console.log('Prompt:', prompt);

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'GEMINI_API_KEY not configured'
            });
        }

        let designJson;
        let modelUsed = 'gemini-2.5-flash';
        let startTime = Date.now();
        let rawResponse = null;

        try {
            console.log('\n📤 Trying model: gemini-2.5-flash');
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            });

            const fullPrompt = `${BASE_SYSTEM_PROMPT}\n\nCreate a ${prompt} design. Include header, hero section, content areas. Make it complete. Return ONLY valid JSON.`;
            
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();
            
            console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            
            rawResponse = text;
            saveJsonToFile(prompt, text, true, 'SUCCESS');
            
            designJson = repairJSON(text);
            
            if (designJson && designJson.frames) {
                console.log('✅ Model succeeded');
                saveJsonToFile(prompt, JSON.stringify(designJson, null, 2), false, 'SUCCESS');
            } else {
                console.log('⚠️ Invalid JSON structure');
                throw new Error('Invalid JSON structure');
            }

        } catch (error) {
            console.log('⚠️ Model failed:', error.message);
            
            if (rawResponse) {
                saveJsonToFile(prompt, rawResponse, true, 'FAILED');
            }
            
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

        if (!designJson) {
            designJson = createFallbackDesign(prompt);
        }

        if (!designJson.frames) {
            if (designJson.type === 'frame') {
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
// MULTI-PAGE PROJECT ENDPOINTS
// ===========================================

// 1. Initialize a new multi-page project
app.post('/api/generate-project', async (req, res) => {
    try {
        const { projectName, description, pages } = req.body;
        
        if (!projectName || !description) {
            return res.status(400).json({
                success: false,
                error: 'projectName and description are required'
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('🚀 CREATE MULTI-PAGE PROJECT');
        console.log('='.repeat(60));
        console.log('Project:', projectName);
        console.log('Description:', description);

        let pageSequence;
        if (pages && Array.isArray(pages) && pages.length > 0) {
            pageSequence = pages;
        } else {
            pageSequence = analyzeDescriptionForPages(description);
        }

        const project = createProject(projectName, description, pageSequence);

        console.log('✅ Project created:', project.id);
        console.log('📋 Page sequence:', pageSequence.join(' → '));

        res.json({
            success: true,
            projectId: project.id,
            projectName: project.name,
            description: project.description,
            totalPages: pageSequence.length,
            pageSequence: pageSequence,
            status: 'initialized',
            message: 'Project initialized. Use /api/generate-next-page to start generating pages.',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error creating project:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 2. Generate next page in sequence
app.post('/api/generate-next-page', async (req, res) => {
    req.setTimeout(90000);
    res.setTimeout(90000);
    
    try {
        const { projectId } = req.body;
        
        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId is required'
            });
        }

        const project = getProject(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found or expired'
            });
        }

        const nextPageType = getNextPageType(project);
        
        if (!nextPageType) {
            const manifestPath = saveProjectManifest(project);
            const completePath = saveCompleteProject(project);
            updateProject(projectId, { status: 'completed' });
            
            return res.json({
                success: true,
                projectId: project.id,
                status: 'completed',
                message: 'All pages generated successfully',
                totalPages: project.pages.length,
                pages: project.pages.map(p => ({
                    name: p.name,
                    type: p.type,
                    frameCount: p.json.frames ? p.json.frames.length : 0
                })),
                manifestFile: manifestPath,
                completeProjectFile: completePath,
                timestamp: new Date().toISOString()
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log(`📄 GENERATING PAGE: ${nextPageType.toUpperCase()}`);
        console.log('='.repeat(60));
        console.log('Project:', project.name);
        console.log('Project ID:', projectId);
        console.log('Page:', project.currentPageIndex + 1, 'of', project.totalPages);

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'GEMINI_API_KEY not configured'
            });
        }

        const pageContext = buildPageContext(project, nextPageType);
        const systemPrompt = getPagePrompt(nextPageType);
        const generationPrompt = buildGenerationPrompt(project, nextPageType);

        let designJson;
        let modelUsed = 'gemini-3-pro-preview';
        let startTime = Date.now();
        let rawResponse = null;
        let filePath = null;

        // Generate with AI
        try {
            console.log('\n📤 Generating with Gemini...');
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            });

            const fullPrompt = `${systemPrompt}\n\n${generationPrompt}\n\n${pageContext}\n\nReturn ONLY valid JSON with a "frames" array.`;
            
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();
            
            console.log(`📥 Response received in ${((Date.now() - startTime)/1000).toFixed(1)}s`);
            
            // Save raw response
            rawResponse = text;
            saveJsonToFile(`${nextPageType}_raw`, text, true, 'SUCCESS', projectId);
            
            // Parse and validate
            designJson = repairJSON(text);
            
            if (designJson && designJson.frames) {
                console.log('✅ Valid JSON generated');
                
                // Save parsed JSON
                const parsedJson = JSON.stringify(designJson, null, 2);
                filePath = saveJsonToFile(nextPageType, parsedJson, false, 'SUCCESS', projectId);
            } else {
                throw new Error('Invalid JSON structure - no frames array');
            }

        } catch (error) {
            console.log('⚠️ Generation failed:', error.message);
            
            // Save failed responses
            if (rawResponse) {
                saveJsonToFile(`${nextPageType}_raw`, rawResponse, true, 'FAILED', projectId);
            }
            
            const errorInfo = {
                timestamp: new Date().toISOString(),
                pageType: nextPageType,
                error: error.message,
                projectId: projectId
            };
            saveJsonToFile(`${nextPageType}_error`, JSON.stringify(errorInfo, null, 2), false, 'FAILED', projectId);
            
            // Use fallback
            console.log('📦 Using fallback design');
            designJson = createFallbackDesignForPage(nextPageType, project);
            filePath = saveJsonToFile(nextPageType, JSON.stringify(designJson, null, 2), false, 'FALLBACK', projectId);
        }

        // Create page data object
        const pageData = {
            id: `${projectId}_page_${project.currentPageIndex}`,
            type: nextPageType,
            name: designJson.frames[0]?.name || `${nextPageType}_page`,
            index: project.currentPageIndex,
            json: designJson,
            filePath: filePath,
            generatedAt: new Date().toISOString(),
            modelUsed: modelUsed,
            generationTime: ((Date.now() - startTime)/1000).toFixed(1)
        };

        // Add to project
        addPageToProject(projectId, pageData);

        const totalTime = ((Date.now() - startTime)/1000).toFixed(1);
        console.log('\n' + '='.repeat(60));
        console.log('✅ PAGE GENERATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`⏱️  Total time: ${totalTime}s`);
        console.log(`🤖 Model used: ${modelUsed}`);
        console.log(`📄 Page type: ${nextPageType}`);
        console.log(`📦 Frames created: ${designJson.frames.length}`);
        console.log(`💾 File saved: ${filePath}`);
        console.log('='.repeat(60));

        // Send response
        res.json({
            success: true,
            projectId: project.id,
            page: {
                type: nextPageType,
                name: pageData.name,
                index: pageData.index,
                frameCount: designJson.frames.length,
                filePath: filePath
            },
            status: 'in_progress',
            progress: {
                current: project.currentPageIndex,
                total: project.totalPages,
                remaining: project.pendingPages.length
            },
            nextPage: project.pendingPages.length > 0 ? project.pendingPages[0] : null,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error generating page:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 3. Get project status
app.get('/api/project/:projectId/status', (req, res) => {
    try {
        const { projectId } = req.params;
        const project = getProject(projectId);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found or expired'
            });
        }

        res.json({
            success: true,
            projectId: project.id,
            projectName: project.name,
            status: project.status,
            progress: {
                current: project.currentPageIndex,
                total: project.totalPages,
                completed: project.completedPages,
                pending: project.pendingPages
            },
            designSystem: project.designSystem,
            interactiveElementsCount: project.interactiveElements.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 4. Get all project pages
app.get('/api/project/:projectId/pages', (req, res) => {
    try {
        const { projectId } = req.params;
        const project = getProject(projectId);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found or expired'
            });
        }

        res.json({
            success: true,
            projectId: project.id,
            projectName: project.name,
            totalPages: project.pages.length,
            pages: project.pages.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                index: p.index,
                frameCount: p.json.frames ? p.json.frames.length : 0,
                generatedAt: p.generatedAt,
                filePath: p.filePath
            })),
            allDesigns: {
                frames: project.pages.flatMap(p => p.json.frames || [])
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
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
            'POST /api/generate-design': 'Generate single design (legacy)',
            'POST /api/generate-project': 'Initialize multi-page project',
            'POST /api/generate-next-page': 'Generate next page in project',
            'GET /api/project/:projectId/status': 'Get project status',
            'GET /api/project/:projectId/pages': 'Get all project pages',
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
    console.log('   POST /api/generate-design     - Single page generation');
    console.log('   POST /api/generate-project    - Initialize multi-page project');
    console.log('   POST /api/generate-next-page  - Generate next page');
    console.log('   GET  /api/project/:id/status  - Project status');
    console.log('   GET  /api/project/:id/pages   - All project pages');
    console.log('   GET  /api/debug/files         - List saved JSON files');
    console.log('   GET  /api/debug/file/:name    - Download specific file');
    console.log('='.repeat(60) + '\n');
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    if (error.code === 'EADDRINUSE') {
        console.error(`   Port ${port} is already in use`);
    }
});
