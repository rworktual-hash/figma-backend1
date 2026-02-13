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
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: '✅ Figma backend with Gemini is LIVE!',
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// 🔥 NEW: GENERATE DESIGN FROM PROMPT
// ===========================================
app.post('/api/generate-design', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('🎨 Generating design for:', prompt);

        // Get Gemini model
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro",
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 0.8,
                maxOutputTokens: 8192,
            }
        });

        // Create the prompt for Gemini
        const designPrompt = `
        You are a UI/UX designer. Create a JSON representation of a ${prompt} design.
        
        Return ONLY valid JSON with this EXACT structure:

        {
          "design": {
            "name": "${prompt} design",
            "width": 1920,
            "height": 1080,
            "type": "frame",
            "backgroundColor": "#ffffff"
          },
          "elements": [
            {
              "type": "frame",
              "name": "Header",
              "x": 0,
              "y": 0,
              "width": 1920,
              "height": 80,
              "backgroundColor": "#1a1a1a",
              "children": [
                {
                  "type": "text",
                  "name": "Logo",
                  "x": 40,
                  "y": 20,
                  "content": "Brand",
                  "fontSize": 24,
                  "fontFamily": "Inter",
                  "color": "#ffffff",
                  "fontWeight": 700
                },
                {
                  "type": "text",
                  "name": "Nav Item 1",
                  "x": 200,
                  "y": 28,
                  "content": "Home",
                  "fontSize": 16,
                  "fontFamily": "Inter",
                  "color": "#ffffff"
                },
                {
                  "type": "text",
                  "name": "Nav Item 2",
                  "x": 280,
                  "y": 28,
                  "content": "Products",
                  "fontSize": 16,
                  "fontFamily": "Inter",
                  "color": "#ffffff"
                }
              ]
            },
            {
              "type": "frame",
              "name": "Hero Section",
              "x": 0,
              "y": 80,
              "width": 1920,
              "height": 600,
              "backgroundColor": "#f5f5f5",
              "children": [
                {
                  "type": "text",
                  "name": "Hero Title",
                  "x": 400,
                  "y": 200,
                  "content": "Welcome to Our Store",
                  "fontSize": 48,
                  "fontFamily": "Inter",
                  "color": "#333333",
                  "fontWeight": 700
                },
                {
                  "type": "text",
                  "name": "Hero Subtitle",
                  "x": 400,
                  "y": 280,
                  "content": "Discover amazing products",
                  "fontSize": 24,
                  "fontFamily": "Inter",
                  "color": "#666666"
                },
                {
                  "type": "rectangle",
                  "name": "CTA Button",
                  "x": 400,
                  "y": 350,
                  "width": 200,
                  "height": 50,
                  "backgroundColor": "#007bff",
                  "cornerRadius": 8,
                  "children": [
                    {
                      "type": "text",
                      "name": "Button Text",
                      "x": 60,
                      "y": 15,
                      "content": "Shop Now",
                      "fontSize": 18,
                      "fontFamily": "Inter",
                      "color": "#ffffff",
                      "fontWeight": 600
                    }
                  ]
                }
              ]
            },
            {
              "type": "frame",
              "name": "Products Grid",
              "x": 0,
              "y": 680,
              "width": 1920,
              "height": 400,
              "backgroundColor": "#ffffff",
              "children": [
                {
                  "type": "rectangle",
                  "name": "Product 1",
                  "x": 200,
                  "y": 720,
                  "width": 250,
                  "height": 300,
                  "backgroundColor": "#e0e0e0",
                  "cornerRadius": 8,
                  "children": [
                    {
                      "type": "text",
                      "name": "Product Name",
                      "x": 50,
                      "y": 200,
                      "content": "Product 1",
                      "fontSize": 18,
                      "fontFamily": "Inter",
                      "color": "#333333"
                    },
                    {
                      "type": "text",
                      "name": "Product Price",
                      "x": 90,
                      "y": 230,
                      "content": "$99",
                      "fontSize": 16,
                      "fontFamily": "Inter",
                      "color": "#007bff",
                      "fontWeight": 600
                    }
                  ]
                },
                {
                  "type": "rectangle",
                  "name": "Product 2",
                  "x": 500,
                  "y": 720,
                  "width": 250,
                  "height": 300,
                  "backgroundColor": "#e0e0e0",
                  "cornerRadius": 8,
                  "children": [
                    {
                      "type": "text",
                      "name": "Product Name",
                      "x": 50,
                      "y": 200,
                      "content": "Product 2",
                      "fontSize": 18,
                      "fontFamily": "Inter",
                      "color": "#333333"
                    },
                    {
                      "type": "text",
                      "name": "Product Price",
                      "x": 90,
                      "y": 230,
                      "content": "$149",
                      "fontSize": 16,
                      "fontFamily": "Inter",
                      "color": "#007bff",
                      "fontWeight": 600
                    }
                  ]
                },
                {
                  "type": "rectangle",
                  "name": "Product 3",
                  "x": 800,
                  "y": 720,
                  "width": 250,
                  "height": 300,
                  "backgroundColor": "#e0e0e0",
                  "cornerRadius": 8,
                  "children": [
                    {
                      "type": "text",
                      "name": "Product Name",
                      "x": 50,
                      "y": 200,
                      "content": "Product 3",
                      "fontSize": 18,
                      "fontFamily": "Inter",
                      "color": "#333333"
                    },
                    {
                      "type": "text",
                      "name": "Product Price",
                      "x": 90,
                      "y": 230,
                      "content": "$199",
                      "fontSize": 16,
                      "fontFamily": "Inter",
                      "color": "#007bff",
                      "fontWeight": 600
                    }
                  ]
                }
              ]
            }
          ]
        }

        Important guidelines:
        1. Make the design appropriate for a ${prompt}
        2. Use modern UI/UX principles
        3. Include header, hero section, content sections, and footer
        4. Use realistic spacing and sizing
        5. Use appropriate colors for the context
        6. Return ONLY the JSON, no other text
        `;

        // Generate content
        const result = await model.generateContent(designPrompt);
        const response = await result.response;
        let text = response.text();
        
        // Clean the response (remove markdown code blocks if present)
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Parse JSON
        const designJson = JSON.parse(text);
        
        console.log('✅ Design generated successfully');

        res.json({
            success: true,
            prompt: prompt,
            design: designJson,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Gemini API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to generate design'
        });
    }
});

// ===========================================
// PROCESS DATA FROM FIGMA (existing)
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

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        features: ['gemini-design-generation']
    });
});

// Bind to 0.0.0.0 for Render
app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 Backend running on port ${port}`);
    console.log(`📍 Test: http://localhost:${port}`);
    console.log(`✨ Gemini Design Generation: POST /api/generate-design\n`);
<<<<<<< HEAD
});
=======
});
>>>>>>> (Add Gemini AI design generation)
