<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b1f57c2c-7af5-4bbf-9d90-5878ade0b0d1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy / Public preview (port 13002)

This repo is served as a static Vite build. To deploy the latest build publicly on **port 13002**:

1. Build + restart preview on 13002:
   `npm run deploy`

2. Or run manually:
   - `npm run build`
   - `npm run preview:13002`
