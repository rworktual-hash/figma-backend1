# Multi-Page Figma Generation Implementation

## ✅ NEW WORKFLOW IMPLEMENTED - Step-by-Step Page Generation

### Overview
The system now supports a **step-by-step workflow** where pages are generated one at a time and returned immediately as Figma JSON. This allows for:
1. Creating a blueprint/plan first
2. Generating Login page → immediate JSON response
3. Generating Home page → immediate JSON response  
4. Generating related pages one by one → immediate JSON responses

---

## NEW API WORKFLOW

### Step 1: Create Blueprint
**Endpoint:** `POST /api/create-blueprint`

**Request:**
```json
{
  "projectName": "My E-commerce Website",
  "description": "An online store selling handmade crafts with user accounts and product listings"
}
```

**Response:**
```json
{
  "success": true,
  "blueprint": {
    "projectId": "proj_1234567890",
    "projectName": "My E-commerce Website",
    "colorScheme": {
      "type": "ecommerce",
      "primary": "#EA580C",
      "secondary": "#DC2626",
      "background": "#FFF7ED",
      "accent": "#F97316"
    },
    "totalPages": 5,
    "pageSequence": [
      {"step": 1, "pageType": "login", "pageName": "Login/Authentication Page"},
      {"step": 2, "pageType": "home", "pageName": "Home/Landing Page"},
      {"step": 3, "pageType": "features", "pageName": "Features/Services Page"},
      {"step": 4, "pageType": "detail", "pageName": "Detail/Feature Page"},
      {"step": 5, "pageType": "detail", "pageName": "Detail/Feature Page"}
    ]
  }
}
```

### Step 2: Generate Pages One by One
**Endpoint:** `POST /api/generate-page`

**Request for Login Page:**
```json
{
  "projectId": "proj_1234567890",
  "pageType": "login"
}
```

**Response (Immediate JSON Return):**
```json
{
  "success": true,
  "projectId": "proj_1234567890",
  "page": {
    "type": "login",
    "name": "Login Page",
    "frameCount": 1,
    "generationTime": "8.5s"
  },
  "figmaJson": {
    "frames": [
      {
        "type": "frame",
        "name": "Login Page",
        "width": 1440,
        "height": 900,
        "backgroundColor": "#FFF7ED",
        "children": [
          {
            "type": "image",
            "name": "Hero Image",
            "width": 600,
            "height": 500,
            "x": 100,
            "y": 100,
            "borderRadius": 12
          },
          {
            "type": "input",
            "placeholder": "Email",
            "width": 320,
            "height": 48,
            "x": 800,
            "y": 200
          }
          // ... more elements
        ]
      }
    ]
  },
  "remainingPages": ["home", "features", "detail", "detail"],
  "message": "Page 'login' generated successfully. Call this endpoint again with next pageType to continue."
}
```

**Then call for Home Page:**
```json
{
  "projectId": "proj_1234567890",
  "pageType": "home"
}
```

**Then continue with remaining pages:**
```json
{
  "projectId": "proj_1234567890",
  "pageType": "features"
}
```

---

## Page Types Supported

| Page Type | Description | Image Placeholders |
|-----------|-------------|-------------------|
| `login` | Login/Signup page with form | 1 hero image (600x500) |
| `home` | Landing page with navigation, hero, features | 5-8 images (hero, features, gallery, testimonials) |
| `detail` | Feature/content detail page | 3-5 images (showcase, gallery) |
| `contact` | Contact form and information | 1-2 images (map, office) |
| `about` | Company/team information | 2-4 images (team photos, office) |
| `features` | Features/services showcase | 3-6 images (feature icons, screenshots) |

---

## Project Type Color Schemes

The system automatically detects project type and applies appropriate colors:

| Project Type | Primary | Secondary | Background | Accent |
|-------------|---------|-----------|------------|--------|
| Food/Restaurant | #EA580C (Orange) | #F59E0B (Amber) | #FFFBEB (Cream) | #B91C1C (Red) |
| Fitness/Gym | #DC2626 (Red) | #111827 (Black) | #F3F4F6 (Gray) | #EA580C (Orange) |
| Tech/SaaS | #2563EB (Blue) | #3B82F6 (Light Blue) | #F8FAFC (White) | #1E40AF (Dark Blue) |
| Finance/Banking | #1E40AF (Navy) | #D97706 (Gold) | #F9FAFB (White) | #059669 (Green) |
| Healthcare | #14B8A6 (Teal) | #60A5FA (Blue) | #F0FDFA (Mint) | #0D9488 (Dark Teal) |
| Education | #F59E0B (Yellow) | #10B981 (Green) | #FFFBEB (Cream) | #3B82F6 (Blue) |
| E-commerce | #EA580C (Orange) | #DC2626 (Red) | #FFF7ED (Cream) | #F97316 (Orange) |
| Nature/Eco | #16A34A (Green) | #0EA5E9 (Sky) | #F0FDF4 (Mint) | #15803D (Dark Green) |
| Luxury/Premium | #000000 (Black) | #D97706 (Gold) | #FAFAFA (White) | #7C3AED (Purple) |
| Creative/Agency | #7C3AED (Purple) | #EC4899 (Pink) | #FAF5FF (Lavender) | #8B5CF6 (Violet) |

---

## API Endpoints Reference

### New Workflow Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create-blueprint` | POST | Step 1: Create website blueprint/plan |
| `/api/generate-page` | POST | Step 2: Generate specific page (returns JSON immediately) |

### Legacy Endpoints (Still Available)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-design` | POST | Single page generation |
| `/api/generate-project` | POST | Initialize multi-page project (legacy) |
| `/api/generate-next-page` | POST | Generate next page (legacy) |
| `/api/project/:id/status` | GET | Check project progress |
| `/api/project/:id/pages` | GET | Get all project pages |
| `/api/debug/files` | GET | List saved JSON files |
| `/api/debug/file/:name` | GET | Download specific file |

---

## File Saving & Debugging

All generated JSON files are saved to `backend/debug/` with the following naming convention:
- `SUCCESS_PROJECT_{projectId}_PAGE_{pageType}_{timestamp}.txt` - Successful generations
- `FAILED_PROJECT_{projectId}_PAGE_{pageType}_{timestamp}.txt` - Failed generations
- `PROJECT_{projectId}_MANIFEST_{timestamp}.txt` - Project metadata
- `PROJECT_{projectId}_COMPLETE_{timestamp}.txt` - All pages combined

---

## Implementation Status

### ✅ Completed Features
- [x] Blueprint creation endpoint (`/api/create-blueprint`)
- [x] Individual page generation endpoint (`/api/generate-page`)
- [x] Step-by-step workflow: Login → Home → Related pages
- [x] Image placeholder support in all page types
- [x] Project-specific color scheme detection
- [x] Immediate JSON response for each generated page
- [x] File saving with project ID tracking
- [x] Fallback designs for all page types
- [x] Error handling and JSON repair

### 🔄 Next Steps
- [ ] Test the new workflow with real API calls
- [ ] Verify image placeholders are generated correctly
- [ ] Test color scheme application
- [ ] Validate JSON structure in Figma plugin
- [ ] Test error scenarios and fallback designs

---

## Usage Example

```bash
# Step 1: Create blueprint
curl -X POST http://localhost:3000/api/create-blueprint \
  -H "Content-Type: application/json" \
  -d '{"projectName": "Fitness App", "description": "A workout tracking app with exercise library"}'

# Step 2: Generate Login page (returns JSON immediately)
curl -X POST http://localhost:3000/api/generate-page \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_xxx", "pageType": "login"}'

# Step 3: Generate Home page (returns JSON immediately)
curl -X POST http://localhost:3000/api/generate-page \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_xxx", "pageType": "home"}'

# Step 4+: Generate remaining pages one by one
curl -X POST http://localhost:3000/api/generate-page \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_xxx", "pageType": "features"}'
```
