# Deployment Guide for Vercel

## Setup for Vercel Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Set up your environment variables in Vercel:

- Go to your Vercel project dashboard
- Navigate to Settings > Environment Variables
- Add `OPENROUTER_API_KEY` with your actual API key

### 3. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy
vercel

# Follow the prompts to link your project
```

#### Option B: Using GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically detect the configuration and deploy

### 4. Build Process

The project is configured with Vite for optimized builds:

- **Development**: `npm run dev` (runs Vite dev server)
- **Build**: `npm run build` (creates optimized `dist` folder)
- **Production**: Vercel automatically runs the build process

### 5. File Structure After Build

```
dist/
├── index.html
├── mass-eval.html
├── copy-steers.html
├── json-visualizer.html
├── assets/
│   ├── css/
│   └── js/
└── mass-eval-sys-prompt.txt
```

## Development vs Production

### Development

- Run `npm run dev` for local development with hot reload
- API calls are proxied to `localhost:3001`
- Files are served directly from source

### Production

- Vercel builds the project using `npm run build`
- Static files are served from the `dist` directory
- API routes are handled by the Node.js server
- Environment variables are managed by Vercel

## Troubleshooting

### Common Issues

1. **API Key Not Found**: Ensure `OPENROUTER_API_KEY` is set in Vercel environment variables
2. **Build Failures**: Check that all dependencies are in `package.json`
3. **404 Errors**: Verify that all HTML files are included in `vite.config.js`

### Local Testing

```bash
# Build locally
npm run build

# Preview build
npm run preview

# Test production build
npm start
```
