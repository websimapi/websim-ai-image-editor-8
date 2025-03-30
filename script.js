import { generateImage } from './llm.js';
import { imageCanvas, inputCanvas, textInput, generateButton, imageUpload, uploadButton } from './ui.js';
import { config } from './config.js';

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let inputDrawingDataUrl = null;
let uploadedImageDataUrl = null;
let currentGeneratedImageUrl = null; // Store URL of the image on main canvas
let hasDrawnOnInput = false; // Flag to check if actual drawing occurred

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
                // Save current drawing before resize *if* it has content
                 const currentDrawing = hasDrawnOnInput ? inputCtx.getImageData(0, 0, canvas.width, canvas.height) : null;

                canvas.width = canvas.clientWidth; // Use clientWidth which reflects CSS size
                canvas.height = canvas.clientHeight; // Use clientHeight

                // Restore drawing after resize only if something was drawn
                if (currentDrawing) {
                     // A simple putImageData might distort. Consider redrawing or clearing.
                     // For now, let's clear and user redraws on resize, simpler.
                     clearInputCanvas(false); // Clear visual, keep data if needed (though data becomes outdated)
                     console.log("Input canvas resized, visual cleared due to resize complexity.");
                     // Or try to restore (might be inaccurate):
                     // inputCtx.putImageData(currentDrawing, 0, 0);
                } else {
                     // If nothing was drawn, or if it was an uploaded image preview, just ensure it's clear.
                     clearInputCanvas(false);
                }

                 // If an uploaded image was being previewed, redraw it
                 if (uploadedImageDataUrl && !hasDrawnOnInput) {
                     displayThumbnailOnInput(uploadedImageDataUrl);
                 }


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
                 const defaultAspectRatio = 16/9; // Use config or default
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
    hasDrawnOnInput = true; // Set flag: User has drawn
    const pos = getEventPos(inputCanvas, e);
    inputCtx.lineTo(pos.x, pos.y);
    inputCtx.strokeStyle = config.drawingColor;
    inputCtx.lineWidth = config.drawingLineWidth;
    inputCtx.lineCap = 'round';
    inputCtx.lineJoin = 'round';
    inputCtx.stroke();
    // Store current position for the next segment
    [lastX, lastY] = [pos.x, pos.y];
    // For smoother lines, start a new path segment for the next move event
    inputCtx.beginPath();
    inputCtx.moveTo(lastX, lastY);

}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    // Only generate data URL if something was actually drawn
    if (hasDrawnOnInput) {
        inputDrawingDataUrl = inputCanvas.toDataURL('image/png');
        // Clear uploaded image if user draws something AFTER uploading
        if (uploadedImageDataUrl) {
            uploadedImageDataUrl = null;
            imageUpload.value = null; // Reset file input visually
            console.log("Drawing captured. Previously uploaded image cleared.");
        } else {
            console.log("Drawing captured.");
        }
    } else {
        inputDrawingDataUrl = null; // Ensure it's null if no drawing happened
        console.log("Drawing stopped, but canvas seems empty.");
    }
}

inputCanvas.addEventListener('mousedown', startDrawing);
inputCanvas.addEventListener('mousemove', draw);
inputCanvas.addEventListener('mouseup', stopDrawing);
inputCanvas.addEventListener('mouseout', () => { if (isDrawing) stopDrawing(); }); // Stop if mouse leaves canvas

inputCanvas.addEventListener('touchstart', startDrawing, { passive: false });
inputCanvas.addEventListener('touchmove', draw, { passive: false });
inputCanvas.addEventListener('touchend', stopDrawing);
inputCanvas.addEventListener('touchcancel', stopDrawing);


// --- Image Upload Logic ---

uploadButton.addEventListener('click', () => {
    imageUpload.click();
});

function handleFileSelect(file) {
     if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageDataUrl = e.target.result;
            // Clear drawing data if image is uploaded/dropped
            clearInputCanvas(false); // Clear visual first
            inputDrawingDataUrl = null; // Clear drawing data
            hasDrawnOnInput = false; // Reset drawing flag
            console.log("Image selected/dropped. Drawing cleared.");
            displayThumbnailOnInput(uploadedImageDataUrl); // Show preview
        };
        reader.onerror = () => {
             console.error("Error reading file.");
             alert("Error reading the selected file.");
             uploadedImageDataUrl = null;
             imageUpload.value = null;
        }
        reader.readAsDataURL(file);
    } else if (file) {
         alert("Please select a valid image file (e.g., PNG, JPG, GIF).");
         imageUpload.value = null; // Reset file input if invalid file
    }
}

function displayThumbnailOnInput(imageUrl) {
     const img = new Image();
    img.onload = () => {
        // Clear previous content first
        clearInputCanvas(false); // Clear visual only
        inputCtx.fillStyle = 'rgba(230, 230, 230, 0.8)'; // Background for thumb area
        inputCtx.fillRect(0,0, inputCanvas.width, inputCanvas.height);
        // Draw a small preview, centered
        const aspect = img.width / img.height;
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
        console.log("Displayed uploaded image thumbnail on input canvas.");
    }
    img.onerror = () => {
        console.error("Error loading image thumbnail for input canvas");
        clearInputCanvas(false); // Clear on error too
    }
    img.src = imageUrl;
}


imageUpload.addEventListener('change', (event) => {
    if (event.target.files && event.target.files.length > 0) {
        handleFileSelect(event.target.files[0]);
    }
});

// --- Drag and Drop Image Upload ---
inputCanvas.addEventListener('dragover', (event) => {
    event.preventDefault(); // Necessary to allow drop
    inputCanvas.classList.add('drag-over');
});

inputCanvas.addEventListener('dragleave', () => {
    inputCanvas.classList.remove('drag-over');
});

inputCanvas.addEventListener('drop', (event) => {
    event.preventDefault();
    inputCanvas.classList.remove('drag-over');
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        handleFileSelect(event.dataTransfer.files[0]);
    }
});


// --- Generation Logic ---

function clearInputCanvas(clearStoredData = true) {
    inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    if (clearStoredData) {
        inputDrawingDataUrl = null;
        uploadedImageDataUrl = null; // Also clear uploaded if clearing data
        imageUpload.value = null; // Reset file input
        hasDrawnOnInput = false; // Reset drawing flag
        console.log("Input canvas cleared (visual + data).");
    } else {
        console.log("Input canvas cleared (visual only).");
    }
}

function drawImageOnCanvas(imageUrl) {
     const img = new Image();
    img.onload = () => {
        currentGeneratedImageUrl = imageUrl; // Store the URL
        const container = document.getElementById('image-container');
        const maxWidth = container.clientWidth - 40; // Account for padding
        const maxHeight = container.clientHeight - 40;

        // Use naturalWidth/Height for intrinsic aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
         if (!isFinite(aspectRatio) || aspectRatio <= 0) {
             console.error("Invalid image aspect ratio detected.");
             // Fallback to a default size or aspect ratio?
             imageCanvas.width = Math.min(maxWidth, 300);
             imageCanvas.height = Math.min(maxHeight, 200);
             imageCtx.fillStyle = '#eee';
             imageCtx.fillRect(0, 0, imageCanvas.width, imageCanvas.height);
             imageCtx.fillStyle = '#555';
             imageCtx.fillText("Error loading image", 10, 20);
             return;
         }

        let canvasWidth = maxWidth;
        let canvasHeight = canvasWidth / aspectRatio;

        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        // Ensure positive dimensions
        canvasWidth = Math.max(1, canvasWidth);
        canvasHeight = Math.max(1, canvasHeight);

        imageCanvas.width = canvasWidth;
        imageCanvas.height = canvasHeight;

        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); // Clear previous image
        imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
        console.log(`Main canvas updated with image: ${imageCanvas.width}x${imageCanvas.height}`);
    };
    img.onerror = (err) => {
        console.error("Error loading generated image onto canvas:", err, "URL:", imageUrl.substring(0,100)+"...");
        alert("Failed to load the generated image. See console for details.");
        currentGeneratedImageUrl = null; // Clear stored URL on error
        debouncedResizeMainCanvas(); // Reset to default state
    };
    img.src = imageUrl; // Start loading
}


async function handleGenerate() {
    const text = textInput.value.trim();
    const inputContent = [];
    console.log("Starting generation process..."); // Log start

    if (text) {
        inputContent.push({ type: "text", text });
        console.log("Added text to input:", text);
    }

    // Prioritize uploaded image over drawing
    if (uploadedImageDataUrl) {
        inputContent.push({ type: "image_url", image_url: { url: uploadedImageDataUrl } });
        console.log("Using uploaded image in prompt.");
    } else if (hasDrawnOnInput && inputDrawingDataUrl) { // Check flag and if dataURL exists
        inputContent.push({ type: "image_url", image_url: { url: inputDrawingDataUrl } });
        console.log("Using drawing input in prompt.");
    } else if (hasDrawnOnInput && !inputDrawingDataUrl) {
        console.warn("Drawing flag is true, but data URL is missing. Was drawing stopped correctly?");
        // Attempt to capture data URL again if drawing happened but URL is missing
        stopDrawing(); // Recapture if needed
        if(inputDrawingDataUrl) {
             inputContent.push({ type: "image_url", image_url: { url: inputDrawingDataUrl } });
             console.log("Using drawing input in prompt (recaptured).");
        } else {
            console.error("Failed to get drawing data URL even after recapture.");
        }
    } else {
         console.log("No drawing or uploaded image provided/selected for input.");
    }


    if (inputContent.length === 0) {
        alert("Please provide some input (text, drawing, or uploaded image) before generating.");
        console.log("Generation cancelled: No valid input provided.");
        return; // Stop execution
    }

    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';
    console.log("Inputs prepared, calling generateImage function...");

    try {
        // Log the content being sent, careful with large data URLs
        const loggableContent = inputContent.map(item =>
            item.type === 'image_url'
                ? { ...item, image_url: { url: item.image_url.url.substring(0, 100) + '...' } }
                : item
        );
        console.log("Sending inputContent to generateImage:", JSON.stringify(loggableContent));

        const result = await generateImage(inputContent, config.generationAspectRatio);
        console.log("Received result from generateImage:", result); // Log the raw result

        if (result && result.url) {
             console.log("Generation successful, drawing image URL:", result.url.substring(0,100)+"...");
             drawImageOnCanvas(result.url); // Display the image
        } else if (result && result.error) {
             // Error message already constructed in llm.js
             alert(`Image generation failed: ${result.error}`);
             console.error("Image generation failed (handled error):", result.error);
             debouncedResizeMainCanvas(); // Reset main canvas visually
        } else {
            // Unexpected: result exists but no url or error
            alert("Image generation failed unexpectedly. No URL or error message received. Check console.");
             console.warn("Image generation returned unexpected result structure:", result);
             debouncedResizeMainCanvas();
        }

    } catch (error) {
        // Catch errors thrown from generateImage or other synchronous issues here
        console.error("Error caught in handleGenerate process:", error);
        alert(`An unexpected error occurred during generation: ${error.message}`);
        debouncedResizeMainCanvas();
    } finally {
        // Re-enable button regardless of success or failure
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        console.log("Generation process finished (enable button).");
        // Optional: Clear inputs after generation? Generally better not to by default.
        // clearInputCanvas(true);
        // textInput.value = '';
    }
}

generateButton.addEventListener('click', handleGenerate);

// --- Initial setup ---
function initialize() {
    // Use setTimeout to defer initial resize until after first paint/layout
    setTimeout(() => {
        debouncedResizeInputCanvas();
        debouncedResizeMainCanvas(); // Set initial main canvas size/state
        console.log("AI Image Editor Initialized and Canvases Resized.");
    }, 0);
}

// Initialize the application
initialize();