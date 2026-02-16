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
3. Valid element types: text, rectangle, button, circle, line, icon, group, input, frame
4. All elements must have x, y coordinates
5. Buttons should have: type, text, width, height, backgroundColor, textColor, x, y, cornerRadius
6. Input fields should have: type, placeholder, width, height, backgroundColor, x, y
7. Use APPROPRIATE COLORS based on the project type - analyze the project description to determine the right color scheme
8. Each project type has distinct colors - do not use generic blue/white for everything

COLOR SCHEME GUIDELINES:
- Technology/SaaS: Blues (#2563EB, #3B82F6), whites, grays
- Healthcare/Medical: Teals (#14B8A6), soft blues (#60A5FA), clean whites
- Finance/Banking: Deep blues (#1E40AF), golds (#D97706), professional grays
- E-commerce/Retail: Vibrant oranges (#EA580C), reds (#DC2626), energetic colors
- Education: Warm yellows (#F59E0B), greens (#10B981), friendly blues
- Food/Restaurant: Warm reds (#B91C1C), oranges (#EA580C), appetizing yellows
- Fitness/Gym: Bold reds (#DC2626), blacks (#111827), energetic oranges
- Nature/Environment: Greens (#16A34A), earth tones (#92400E), sky blues
- Luxury/Premium: Blacks (#000000), golds (#D97706), deep purples (#7C3AED)
- Creative/Agency: Purples (#7C3AED), pinks (#EC4899), creative gradients

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
- Use PROJECT-SPECIFIC color scheme - analyze the project type and use appropriate colors
- Background should complement the brand colors
- Typography should be modern and readable

CRITICAL RULES:
1. Return ONLY valid JSON
2. Use colors that match the project type (not generic blue)
3. All interactive elements must be clearly labeled
4. Include proper visual hierarchy
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
- Professional, modern design with PROJECT-SPECIFIC colors
- Clear visual hierarchy with proper contrast
- Multiple interactive buttons that could link to other pages
- Use colors based on project type analysis:
  * Tech: Blues, modern grays
  * Food: Warm reds, oranges, yellows
  * Fitness: Bold reds, blacks, energetic tones
  * Healthcare: Teals, soft blues, clean whites
  * Finance: Deep blues, golds, professional tones
  * Education: Warm yellows, greens, friendly colors
  * E-commerce: Vibrant oranges, reds, energetic
  * Nature: Greens, earth tones, sky blues
  * Luxury: Blacks, golds, deep purples
  * Creative: Purples, pinks, creative gradients
- Responsive layout (1440px width)
- Proper spacing and typography
- Visual elements that reflect the project type

CRITICAL: 
1. Include multiple buttons that would require detail pages (e.g., "Learn More", "Get Started", "View Details", "Contact Us")
2. Use APPROPRIATE colors for the project type - do not default to blue
3. Return ONLY valid JSON with all interactive elements clearly labeled
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
- Use the SAME color scheme as the home page for consistency
- Professional layout with good readability
- Clear back navigation
- Relevant action buttons
- Content should be detailed and informative
- Visual elements should support the content

CRITICAL: 
1. Maintain color consistency with previous pages
2. Use the project-specific color scheme (not generic colors)
3. Return ONLY valid JSON
4. Ensure visual hierarchy is clear
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
    
    // ALWAYS start with login/signup first
    pages.push(PAGE_TYPES.LOGIN);
    
    // ALWAYS second: Home page
    pages.push(PAGE_TYPES.HOME);
    
    // Third: Features if mentioned
    if (lowerDesc.includes('feature') || lowerDesc.includes('service')) {
        pages.push(PAGE_TYPES.FEATURES);
    }
    
    // Fourth: About if mentioned
    if (lowerDesc.includes('about') || lowerDesc.includes('company') || lowerDesc.includes('team')) {
        pages.push(PAGE_TYPES.ABOUT);
    }
    
    // Fifth: Contact if mentioned
    if (lowerDesc.includes('contact') || lowerDesc.includes('reach') || lowerDesc.includes('support')) {
        pages.push(PAGE_TYPES.CONTACT);
    }
    
    // Add detail pages for interactive elements (always at least 2)
    pages.push(PAGE_TYPES.DETAIL);
    pages.push(PAGE_TYPES.DETAIL);
    
    // Add more detail pages if description suggests complexity
    if (lowerDesc.includes('product') || lowerDesc.includes('shop') || lowerDesc.includes('store')) {
        pages.push(PAGE_TYPES.DETAIL);
    }
    
    return pages;
}

function detectProjectType(description, projectName) {
    const text = (description + ' ' + projectName).toLowerCase();
    
    if (text.includes('food') || text.includes('restaurant') || text.includes('cafe') || text.includes('kitchen') || text.includes('dining') || text.includes('menu')) {
        return {
            type: 'food',
            primary: '#EA580C',
            secondary: '#F59E0B',
            background: '#FFFBEB',
            accent: '#B91C1C',
            description: 'Warm appetizing colors - oranges, reds, yellows'
        };
    }
    if (text.includes('fitness') || text.includes('gym') || text.includes('workout') || text.includes('health') || text.includes('exercise') || text.includes('training')) {
        return {
            type: 'fitness',
            primary: '#DC2626',
            secondary: '#111827',
            background: '#F3F4F6',
            accent: '#EA580C',
            description: 'Bold energetic colors - reds, blacks, oranges'
        };
    }
    if (text.includes('tech') || text.includes('software') || text.includes('app') || text.includes('digital') || text.includes('saas') || text.includes('platform')) {
        return {
            type: 'tech',
            primary: '#2563EB',
            secondary: '#3B82F6',
            background: '#F8FAFC',
            accent: '#1E40AF',
            description: 'Modern tech blues with clean grays'
        };
    }
    if (text.includes('finance') || text.includes('bank') || text.includes('money') || text.includes('invest') || text.includes('crypto') || text.includes('trading')) {
        return {
            type: 'finance',
            primary: '#1E40AF',
            secondary: '#D97706',
            background: '#F9FAFB',
            accent: '#059669',
            description: 'Professional deep blues with gold accents'
        };
    }
    if (text.includes('health') || text.includes('medical') || text.includes('hospital') || text.includes('clinic') || text.includes('doctor') || text.includes('care')) {
        return {
            type: 'healthcare',
            primary: '#14B8A6',
            secondary: '#60A5FA',
            background: '#F0FDFA',
            accent: '#0D9488',
            description: 'Clean teals and soft blues for trust'
        };
    }
    if (text.includes('education') || text.includes('school') || text.includes('learn') || text.includes('course') || text.includes('academy') || text.includes('student')) {
        return {
            type: 'education',
            primary: '#F59E0B',
            secondary: '#10B981',
            background: '#FFFBEB',
            accent: '#3B82F6',
            description: 'Warm friendly yellows and greens'
        };
    }
    if (text.includes('shop') || text.includes('store') || text.includes('ecommerce') || text.includes('retail') || text.includes('product') || text.includes('buy')) {
        return {
            type: 'ecommerce',
            primary: '#EA580C',
            secondary: '#DC2626',
            background: '#FFF7ED',
            accent: '#F97316',
            description: 'Vibrant oranges and reds for energy'
        };
    }
    if (text.includes('nature') || text.includes('eco') || text.includes('green') || text.includes('environment') || text.includes('organic') || text.includes('sustainable')) {
        return {
            type: 'nature',
            primary: '#16A34A',
            secondary: '#0EA5E9',
            background: '#F0FDF4',
            accent: '#15803D',
            description: 'Natural greens and earth tones'
        };
    }
    if (text.includes('luxury') || text.includes('premium') || text.includes('exclusive') || text.includes('high-end') || text.includes('elegant')) {
        return {
            type: 'luxury',
            primary: '#000000',
            secondary: '#D97706',
            background: '#FAFAFA',
            accent: '#7C3AED',
            description: 'Sophisticated blacks with gold accents'
        };
    }
    if (text.includes('creative') || text.includes('design') || text.includes('art') || text.includes('agency') || text.includes('studio') || text.includes('portfolio')) {
        return {
            type: 'creative',
            primary: '#7C3AED',
            secondary: '#EC4899',
            background: '#FAF5FF',
            accent: '#8B5CF6',
            description: 'Creative purples and pinks'
        };
    }
    
    // Default with variety based on project name hash
    const colors = [
        { primary: '#2563EB', secondary: '#3B82F6', background: '#F8FAFC', accent: '#1E40AF' }, // Blue
        { primary: '#16A34A', secondary: '#22C55E', background: '#F0FDF4', accent: '#15803D' }, // Green
        { primary: '#DC2626', secondary: '#EF4444', background: '#FEF2F2', accent: '#B91C1C' }, // Red
        { primary: '#7C3AED', secondary: '#8B5CF6', background: '#FAF5FF', accent: '#6D28D9' }, // Purple
        { primary: '#EA580C', secondary: '#F97316', background: '#FFF7ED', accent: '#C2410C' }, // Orange
    ];
    const index = projectName.length % colors.length;
    const color = colors[index];
    
    return {
        type: 'default',
        ...color,
        description: 'Modern professional colors'
    };
}

function buildGenerationPrompt(project, pageType) {
    const projectName = project.name;
    const description = project.description;
    const colorScheme = detectProjectType(description, projectName);
    
    const colorInstructions = `
COLOR SCHEME (USE THESE EXACT COLORS):
- Primary Color: ${colorScheme.primary} - Use for main buttons, headers, key elements
- Secondary Color: ${colorScheme.secondary} - Use for accents, hover states
- Background: ${colorScheme.background} - Use for page backgrounds
- Accent Color: ${colorScheme.accent} - Use for highlights, links
- Project Type: ${colorScheme.type} - ${colorScheme.description}

IMPORTANT: Use these specific hex colors throughout the design. Do not use generic blue #007AFF.
`;
    
    switch (pageType) {
        case PAGE_TYPES.LOGIN:
            return `Create a login page for: ${projectName}. ${description}. ${colorInstructions} Make it complete with form fields and buttons. Use the specified color scheme consistently.`;
        case PAGE_TYPES.HOME:
            return `Create a home/landing page for: ${projectName}. ${description}. ${colorInstructions} Include navigation, hero, features, and multiple CTA buttons. Use the specified colors for all UI elements.`;
        case PAGE_TYPES.DETAIL:
            const elementIndex = project.pages.length > 0 ? project.pages.length - 1 : 0;
            if (project.interactiveElements[elementIndex]) {
                const element = project.interactiveElements[elementIndex];
                return `Create a detail page for: "${element.text}" from ${projectName}. ${description}. ${colorInstructions} This page should expand on this feature. Maintain color consistency with the home page.`;
            }
            return `Create a detail/content page for: ${projectName}. ${description}. ${colorInstructions} Include detailed information about a specific feature or section.`;
        case PAGE_TYPES.CONTACT:
            return `Create a contact page for: ${projectName}. ${description}. ${colorInstructions} Include contact form, contact info, and business hours.`;
        case PAGE_TYPES.ABOUT:
            return `Create an about page for: ${projectName}. ${description}. ${colorInstructions} Include company story, team, mission/vision.`;
        case PAGE_TYPES.FEATURES:
            return `Create a features page for: ${projectName}. ${description}. ${colorInstructions} Include detailed feature descriptions and benefits.`;
        default:
            return `Create a page for: ${projectName}. ${description}. ${colorInstructions}`;
    }
}

function getPagePrompt(pageType, project = null) {
    let basePrompt;
    
    switch (pageType) {
        case PAGE_TYPES.LOGIN:
            basePrompt = LOGIN_PAGE_PROMPT;
            break;
        case PAGE_TYPES.HOME:
            basePrompt = HOME_PAGE_PROMPT;
            break;
        case PAGE_TYPES.DETAIL:
            basePrompt = DETAIL_PAGE_PROMPT;
            break;
        case PAGE_TYPES.CONTACT:
            basePrompt = DETAIL_PAGE_PROMPT + '\n\nThis is a CONTACT page. Include contact form, contact information, map placeholder, and business hours.';
            break;
        case PAGE_TYPES.ABOUT:
            basePrompt = DETAIL_PAGE_PROMPT + '\n\nThis is an ABOUT page. Include company story, team section, mission/vision, and company values.';
            break;
        case PAGE_TYPES.FEATURES:
            basePrompt = DETAIL_PAGE_PROMPT + '\n\nThis is a FEATURES page. Include detailed feature descriptions, benefits, pricing tables, and comparison sections.';
            break;
        default:
            basePrompt = BASE_SYSTEM_PROMPT;
    }
    
    // Add color reminder if project is available
    if (project) {
        const colorScheme = detectProjectType(project.description, project.name);
        basePrompt += `\n\nCOLOR REMINDER: Use ${colorScheme.type} color scheme - Primary: ${colorScheme.primary}, Background: ${colorScheme.background}`;
    }
    
    return basePrompt;
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
        let modelUsed = 'gemini-3-pro-preview';
        let startTime = Date.now(); 

        let rawResponse = null;

        try {
            console.log('\n📤 Trying model: gemini-3-pro-preview');
            
            const model = genAI.getGenerativeModel({ 
                model: "gemini-3-pro-preview",
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
        const systemPrompt = getPagePrompt(nextPageType, project);
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
                model: "gemini-3-pro-preview",
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
