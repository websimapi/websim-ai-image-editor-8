// Configuration settings (can be added later if needed)
export default {
    defaultAspectRatio: "16:9",
    // Add other configuration options here
};
`````` index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Image Editor</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="image-container">
        <canvas id="main-canvas"></canvas>
    </div>
    <div id="input-area">
        <canvas id="input-canvas"></canvas>
        <div id="input-controls">
            <input type="text" id="text-input" placeholder="Describe your image, draw above, or upload...">
            <button id="upload-button" title="Upload Image">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                </svg>
            </button>
            <input type="file" id="image-upload" accept="image/*" style="display: none;">
            <button id="generate-button">Generate</button>
        </div>
    </div>

    <script type="importmap">
    {
      "imports": {
        "@websim/ai-tools": "https://unpkg.com/@websim/ai-tools@latest/dist/index.js"
      }
    }
    </script>
    <script type="module" src="script.js"></script>
</body>
</html>

// Configuration settings
export const config = {
    // Drawing settings
    drawingColor: '#000000', // Black
    drawingLineWidth: 3,

    // Image Generation settings
    generationAspectRatio: "16:9", // Default aspect ratio for generated images

    // Other potential settings
    // defaultPrompt: "A curious cat exploring a vibrant garden",
};

