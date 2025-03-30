import { generateImage } from './llm.js';
import { imageCanvas, inputCanvas, textInput, generateButton, imageUpload, uploadButton } from './ui.js';
import { config } from './config.js';

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let inputDrawingDataUrl = null;
let uploadedImageDataUrl = null;
let currentGeneratedImageUrl = null; // Store URL of the image on main canvas

const inputCtx = inputCanvas.getContext('2d');
const imageCtx = imageCanvas.getContext('2d');

// --- Canvas Resizing ---
function resizeCanvas(canvas, container) {
    // Debounce function
    let timeoutId;
    return function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
             // For input canvas, match CSS dimensions
            if (canvas === inputCanvas) {
                const style = window.getComputedStyle(canvas);
                // Save current drawing before resize
                const currentDrawing = inputCtx.getImageData(0, 0, canvas.width, canvas.height);
                canvas.width = canvas.clientWidth; // Use clientWidth which reflects CSS size
                canvas.height = canvas.clientHeight; // Use clientHeight
                // Restore drawing after resize (optional, might distort)
                // inputCtx.putImageData(currentDrawing, 0, 0); // Simple restore, might be offset/scaled incorrectly
                // Or clear and let user redraw:
                // clearInputCanvas(false); // Don't clear stored data, just visual
                console.log(`Input canvas resized to: ${canvas.width}x${canvas.height}`);
            }
            // For main canvas, resize based on container and aspect ratio of loaded image
            else if (canvas === imageCanvas && currentGeneratedImageUrl) {
                drawImageOnCanvas(currentGeneratedImageUrl); // Redraw with new size
            }
            // Initial/default size for main canvas if no image loaded
            else if (canvas === imageCanvas && !currentGeneratedImageUrl) {
                 // Set a modest default size or leave as is
                 const defaultWidth = Math.min(container.clientWidth - 40, 400); // Use container's current clientWidth
                 const defaultHeight = Math.min(container.clientHeight - 40, 300); // Use container's current clientHeight
                 // Maintain a default aspect ratio if desired
                 const defaultAspectRatio = 4/3;
                 let canvasWidth = defaultWidth;
                 let canvasHeight = canvasWidth / defaultAspectRatio;
                 if(canvasHeight > defaultHeight) {
                    canvasHeight = defaultHeight;
                    canvasWidth = canvasHeight * defaultAspectRatio;
                 }
                 // Ensure minimum dimensions
                 canvas.width = Math.max(1, canvasWidth);
                 canvas.height = Math.max(1, canvasHeight);

                 imageCtx.fillStyle = '#fff'; // Clear with background color
                 imageCtx.fillRect(0, 0, canvas.width, canvas.height);
                 imageCtx.strokeStyle = '#ccc';
                 imageCtx.strokeRect(0.5, 0.5, canvas.width-1, canvas.height-1); // Add border visually inside
                 console.log(`Main canvas set to default size: ${canvas.width}x${canvas.height}`);
            }
        }, 150); // Debounce resize events
    }
}

// Use the correct parent elements for container dimensions
const debouncedResizeInputCanvas = resizeCanvas(inputCanvas, inputCanvas.parentElement); // input-area
const debouncedResizeMainCanvas = resizeCanvas(imageCanvas, imageCanvas.parentElement); // image-container

window.addEventListener('resize', () => {
    debouncedResizeInputCanvas();
    debouncedResizeMainCanvas();
});

// --- Input Canvas Drawing Logic ---

function getEventPos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
        evt.preventDefault(); // Prevent scrolling/zooming
    } else if (evt.changedTouches && evt.changedTouches.length > 0) { // For touchend
         clientX = evt.changedTouches[0].clientX;
         clientY = evt.changedTouches[0].clientY;
    } else {
        clientX = evt.clientX;
        clientY = evt.clientY;
    }
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getEventPos(inputCanvas, e);
    [lastX, lastY] = [pos.x, pos.y];
    inputCtx.beginPath(); // Start a new path
    inputCtx.moveTo(lastX, lastY);
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getEventPos(inputCanvas, e);
    inputCtx.lineTo(pos.x, pos.y);
    inputCtx.strokeStyle = config.drawingColor;
    inputCtx.lineWidth = config.drawingLineWidth;
    inputCtx.lineCap = 'round';
    inputCtx.lineJoin = 'round';
    inputCtx.stroke();
    // Optimization: instead of beginPath+moveTo on every move, only do it after lifting the pen/finger
    // This creates a single continuous path which might be better for some interpretations.
    // Keeping the current approach for now as it works visually.
    // inputCtx.beginPath(); // Begin new path segment for smoother drawing
    // inputCtx.moveTo(pos.x, pos.y);
    [lastX, lastY] = [pos.x, pos.y];
}

function stopDrawing() {
    if (!isDrawing) return;
    // Don't call closePath if just drawing lines, only needed for filled shapes
    // inputCtx.closePath();
    isDrawing = false;
    inputDrawingDataUrl = inputCanvas.toDataURL('image/png');
    // Clear uploaded image if user draws something
    uploadedImageDataUrl = null;
    imageUpload.value = null; // Reset file input visually
    console.log("Drawing captured. Uploaded image cleared.");
}

inputCanvas.addEventListener('mousedown', startDrawing);
inputCanvas.addEventListener('mousemove', draw);
inputCanvas.addEventListener('mouseup', stopDrawing);
inputCanvas.addEventListener('mouseout', () => { if (isDrawing) stopDrawing(); }); // Stop if mouse leaves canvas

inputCanvas.addEventListener('touchstart', startDrawing, { passive: false }); // Need passive: false to call preventDefault
inputCanvas.addEventListener('touchmove', draw, { passive: false }); // Need passive: false to call preventDefault
inputCanvas.addEventListener('touchend', stopDrawing);
inputCanvas.addEventListener('touchcancel', stopDrawing); // Handle interruption


// --- Image Upload Logic ---

uploadButton.addEventListener('click', () => {
    imageUpload.click();
});

function handleFileSelect(file) {
     if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageDataUrl = e.target.result;
            // Clear drawing if image is uploaded/dropped
            clearInputCanvas(false); // Don't clear the stored drawing data URL yet, just visually
            inputDrawingDataUrl = null; // Clear drawing data since image takes precedence
            console.log("Image selected/dropped. Drawing cleared.");
            // Optional: Display a thumbnail on input canvas or indicate upload success
            displayThumbnailOnInput(uploadedImageDataUrl);
        };
        reader.readAsDataURL(file);
    } else if (file) {
         alert("Please select a valid image file.");
         imageUpload.value = null; // Reset file input if invalid file
    }
}

function displayThumbnailOnInput(imageUrl) {
     const img = new Image();
    img.onload = () => {
        // Clear previous content first
        clearInputCanvas(false);
        inputCtx.fillStyle = 'rgba(230, 230, 230, 0.8)'; // Clear with slight overlay
        inputCtx.fillRect(0,0, inputCanvas.width, inputCanvas.height);
        // Draw a small preview, centered
        const aspect = img.width / img.height;
        // Make thumbnail smaller relative to input canvas size
        const maxDim = Math.min(inputCanvas.width * 0.7, inputCanvas.height * 0.7);
        let w = maxDim;
        let h = w / aspect;
        if (h > maxDim) {
            h = maxDim;
            w = h * aspect;
        }
        const x = (inputCanvas.width - w) / 2;
        const y = (inputCanvas.height - h) / 2;
        inputCtx.drawImage(img, x, y, w, h);
        inputCtx.strokeStyle = '#aaa';
        inputCtx.lineWidth = 1;
        inputCtx.strokeRect(x,y,w,h);
    }
    img.onerror = () => {
        console.error("Error loading image thumbnail for input canvas");
        clearInputCanvas(false); // Clear on error too
    }
    img.src = imageUrl;
}


imageUpload.addEventListener('change', (event) => {
    handleFileSelect(event.target.files[0]);
});

// --- Drag and Drop Image Upload ---
inputCanvas.addEventListener('dragover', (event) => {
    event.preventDefault();
    inputCanvas.classList.add('drag-over');
});

inputCanvas.addEventListener('dragleave', () => {
    inputCanvas.classList.remove('drag-over');
});

inputCanvas.addEventListener('drop', (event) => {
    event.preventDefault();
    inputCanvas.classList.remove('drag-over');
    handleFileSelect(event.dataTransfer.files[0]);
});


// --- Generation Logic ---

function clearInputCanvas(clearStoredData = true) {
    inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    if (clearStoredData) {
        inputDrawingDataUrl = null;
         uploadedImageDataUrl = null; // Also clear uploaded if clearing data
         imageUpload.value = null; // Reset file input
         console.log("Input canvas cleared (visual + data).");
    } else {
        console.log("Input canvas cleared (visual only).");
    }
}

function drawImageOnCanvas(imageUrl) {
     const img = new Image();
    img.onload = () => {
        currentGeneratedImageUrl = imageUrl; // Store the URL of the currently displayed image
        const container = document.getElementById('image-container');
        // Use clientWidth/clientHeight which account for CSS sizing and padding
        const maxWidth = container.clientWidth - 40; // Account for padding
        const maxHeight = container.clientHeight - 40;

        const aspectRatio = img.naturalWidth / img.naturalHeight;

        let canvasWidth = maxWidth;
        let canvasHeight = canvasWidth / aspectRatio;

        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        // Ensure minimum size if needed, or handle 0 dimensions
        canvasWidth = Math.max(1, canvasWidth);
        canvasHeight = Math.max(1, canvasHeight);

        imageCanvas.width = canvasWidth;
        imageCanvas.height = canvasHeight;

        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); // Clear previous image
        imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
        console.log(`Main canvas updated with image: ${imageCanvas.width}x${imageCanvas.height}`);
    };
    img.onerror = (err) => {
        console.error("Error loading generated image onto canvas:", err);
        alert("Failed to load the generated image.");
        currentGeneratedImageUrl = null; // Clear stored URL on error
        // Optionally clear the main canvas or show an error state
        debouncedResizeMainCanvas(); // Reset to default state
    };
    // IMPORTANT: Check if the image URL needs proxying or is CORS-enabled.
    // For websim.imageGen, the URL should generally be usable directly.
    img.src = imageUrl;
}


async function handleGenerate() {
    const text = textInput.value.trim();
    const inputContent = [];

    if (text) {
        inputContent.push({ type: "text", text });
    }
    // Prioritize uploaded image over drawing if both exist (drawing is cleared on upload)
    if (uploadedImageDataUrl) {
        inputContent.push({ type: "image_url", image_url: { url: uploadedImageDataUrl } });
        console.log("Using uploaded image in prompt.");
    } else if (inputDrawingDataUrl) {
        // Check if the drawing canvas is effectively empty (e.g., all transparent)
        // This avoids sending an empty drawing.
        // A simple check: is the data URL very short? (Might not be robust)
        // A better check would involve analyzing pixel data, but let's keep it simple:
        if (inputDrawingDataUrl && inputDrawingDataUrl.length > 100) { // Arbitrary threshold for non-empty PNG
             inputContent.push({ type: "image_url", image_url: { url: inputDrawingDataUrl } });
             console.log("Using drawing input in prompt.");
        } else {
             console.log("Drawing input seems empty, skipping.");
        }
    }


    if (inputContent.length === 0) {
        alert("Please provide some input (text, drawing, or uploaded image).");
        return;
    }

    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    try {
        console.log("Sending input to generateImage:", JSON.stringify(inputContent).substring(0, 200) + "..."); // Log start of content
        const result = await generateImage(inputContent, config.generationAspectRatio);

        if (result && result.url) {
             drawImageOnCanvas(result.url);
        } else if (result && result.error) {
             alert(`Image generation failed: ${result.error}`);
             console.error("Image generation failed:", result.error);
             debouncedResizeMainCanvas(); // Reset main canvas on failure
        } else {
            alert("Image generation failed. No URL received. Check console for details.");
             console.warn("Image generation returned unexpected result:", result);
             debouncedResizeMainCanvas(); // Reset main canvas
        }

    } catch (error) {
        console.error("Error during image generation process:", error);
        alert(`An error occurred during generation: ${error.message}`);
        debouncedResizeMainCanvas(); // Reset main canvas on error
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        // Decide whether to clear inputs after generation. Let's not clear automatically.
        // clearInputCanvas(true); // Clears drawing/upload thumbnail + data
        // textInput.value = '';
    }
}

generateButton.addEventListener('click', handleGenerate);

// --- Initial setup ---
function initialize() {
    // Initial resize needs to happen after elements are potentially sized by CSS
    // Use setTimeout to ensure layout is complete
    setTimeout(() => {
        debouncedResizeInputCanvas();
        debouncedResizeMainCanvas(); // Set initial main canvas size/state
        console.log("AI Image Editor Initialized");
    }, 0);
}

initialize();