import { conversationHistory, generateImage } from './llm.js';
import { imageCanvas, inputCanvas, textInput, generateButton, imageUpload, uploadButton } from './ui.js';

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let inputDrawingDataUrl = null;
let uploadedImageDataUrl = null;

const inputCtx = inputCanvas.getContext('2d');
const imageCtx = imageCanvas.getContext('2d');

// --- Input Canvas Drawing Logic ---

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function getTouchPos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.touches[0].clientX - rect.left,
        y: evt.touches[0].clientY - rect.top
    };
}


function startDrawing(e) {
    isDrawing = true;
    let pos;
    if (e.touches) {
        pos = getTouchPos(inputCanvas, e);
        e.preventDefault(); // Prevent scrolling
    } else {
        pos = getMousePos(inputCanvas, e);
    }
    [lastX, lastY] = [pos.x, pos.y];
}

function draw(e) {
    if (!isDrawing) return;
    let pos;
     if (e.touches) {
        pos = getTouchPos(inputCanvas, e);
        e.preventDefault(); // Prevent scrolling
    } else {
        pos = getMousePos(inputCanvas, e);
    }
    inputCtx.beginPath();
    inputCtx.moveTo(lastX, lastY);
    inputCtx.lineTo(pos.x, pos.y);
    inputCtx.strokeStyle = '#000'; // Basic black stroke for now
    inputCtx.lineWidth = 2;
    inputCtx.stroke();
    [lastX, lastY] = [pos.x, pos.y];
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    inputDrawingDataUrl = inputCanvas.toDataURL('image/png');
    // Optionally clear the input canvas visually after storing data URL,
    // or keep it until next generation. Let's keep it for now.
}

inputCanvas.addEventListener('mousedown', startDrawing);
inputCanvas.addEventListener('mousemove', draw);
inputCanvas.addEventListener('mouseup', stopDrawing);
inputCanvas.addEventListener('mouseout', stopDrawing); // Stop if mouse leaves canvas

inputCanvas.addEventListener('touchstart', startDrawing);
inputCanvas.addEventListener('touchmove', draw);
inputCanvas.addEventListener('touchend', stopDrawing);


// --- Image Upload Logic ---

uploadButton.addEventListener('click', () => {
    imageUpload.click();
});

imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageDataUrl = e.target.result;
            // Optional: Display a thumbnail or indicator that an image is loaded
            console.log("Image uploaded");
             // Clear any drawing on the input canvas if an image is uploaded
            clearInputCanvas();
        };
        reader.readAsDataURL(file);
    }
});

// --- Drag and Drop Image Upload ---
inputCanvas.addEventListener('dragover', (event) => {
    event.preventDefault(); // Prevent default behavior (opening image in browser)
    inputCanvas.classList.add('drag-over');
});

inputCanvas.addEventListener('dragleave', () => {
    inputCanvas.classList.remove('drag-over');
});

inputCanvas.addEventListener('drop', (event) => {
    event.preventDefault();
    inputCanvas.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageDataUrl = e.target.result;
            console.log("Image dropped and uploaded");
            // Clear any drawing on the input canvas if an image is dropped
            clearInputCanvas();
        };
        reader.readAsDataURL(file);
    }
});


// --- Generation Logic ---

function clearInputCanvas() {
    inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    inputDrawingDataUrl = null;
}


async function handleGenerate() {
    const text = textInput.value.trim();
    const inputContent = [];

    if (text) {
        inputContent.push({ type: "text", text });
    }
    if (uploadedImageDataUrl) {
        inputContent.push({ type: "image_url", image_url: { url: uploadedImageDataUrl } });
        console.log("Using uploaded image.");
    } else if (inputDrawingDataUrl) {
        // Only use drawing if no image was uploaded
        inputContent.push({ type: "image_url", image_url: { url: inputDrawingDataUrl } });
        console.log("Using drawing input.");
    }


    if (inputContent.length === 0) {
        alert("Please provide some input (text, drawing, or uploaded image).");
        return;
    }

    // Disable button during generation
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    try {
        console.log("Generating image with input:", inputContent);
        const result = await generateImage(inputContent);
        console.log("Image generation result:", result);


        if (result && result.url) {
             // Draw the generated image onto the main canvas
            const img = new Image();
            img.onload = () => {
                // Resize main canvas to match image aspect ratio (optional, but good practice)
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const container = document.getElementById('image-container');
                const maxWidth = container.clientWidth - 40; // Account for padding
                const maxHeight = container.clientHeight - 40;

                let canvasWidth = maxWidth;
                let canvasHeight = canvasWidth / aspectRatio;

                if (canvasHeight > maxHeight) {
                    canvasHeight = maxHeight;
                    canvasWidth = canvasHeight * aspectRatio;
                }

                imageCanvas.width = canvasWidth;
                imageCanvas.height = canvasHeight;

                imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height); // Clear previous image
                imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
            };
            img.onerror = (err) => {
                console.error("Error loading generated image:", err);
                alert("Failed to load the generated image.");
            };
             img.src = result.url; // Use the URL directly if CORS allows, or handle proxy/download if needed
        } else {
            alert("Image generation failed. Please check the console for details.");
        }

    } catch (error) {
        console.error("Error during image generation process:", error);
        alert("An error occurred during image generation.");
    } finally {
        // Re-enable button
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        // Clear inputs for next round (optional)
        // textInput.value = '';
        // clearInputCanvas();
        // uploadedImageDataUrl = null;
        // imageUpload.value = null; // Reset file input
    }
}

generateButton.addEventListener('click', handleGenerate);

// Initial setup - resize canvases to fit container
function resizeCanvases() {
    const inputContainer = document.getElementById('input-container');
    // Resize input canvas - adjust based on CSS height and container width
    const inputStyle = window.getComputedStyle(inputCanvas);
    inputCanvas.width = inputCanvas.clientWidth - parseInt(inputStyle.paddingLeft) - parseInt(inputStyle.paddingRight);
    inputCanvas.height = inputCanvas.clientHeight - parseInt(inputStyle.paddingTop) - parseInt(inputStyle.paddingBottom);


    // Resize main canvas initially (or based on a default size/placeholder)
    // This might be better handled when an image is loaded.
    const imageContainer = document.getElementById('image-container');
    const availableWidth = imageContainer.clientWidth - 40; // padding
    const availableHeight = imageContainer.clientHeight - 40; // padding

    // Set a default size or aspect ratio if desired
    // imageCanvas.width = Math.min(availableWidth, 600); // Example default width
    // imageCanvas.height = Math.min(availableHeight, 400); // Example default height
     // For now, let's leave it small until an image is loaded
     imageCanvas.width = 300;
     imageCanvas.height = 200;

}

window.addEventListener('resize', resizeCanvases);
resizeCanvases(); // Initial call

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
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
                console.log(`Input canvas resized to: ${canvas.width}x${canvas.height}`);
                // Redraw existing drawing if any? For simplicity, maybe clear it on resize? Or restore later. Let's just resize.
            }
            // For main canvas, resize based on container and aspect ratio of loaded image
            else if (canvas === imageCanvas && currentGeneratedImageUrl) {
                drawImageOnCanvas(currentGeneratedImageUrl); // Redraw with new size
            }
            // Initial/default size for main canvas if no image loaded
            else if (canvas === imageCanvas && !currentGeneratedImageUrl) {
                 // Set a modest default size or leave as is
                 const defaultWidth = Math.min(container.clientWidth - 40, 400);
                 const defaultHeight = Math.min(container.clientHeight - 40, 300);
                 // Maintain a default aspect ratio if desired
                 const defaultAspectRatio = 4/3;
                 let canvasWidth = defaultWidth;
                 let canvasHeight = canvasWidth / defaultAspectRatio;
                 if(canvasHeight > defaultHeight) {
                    canvasHeight = defaultHeight;
                    canvasWidth = canvasHeight * defaultAspectRatio;
                 }
                 canvas.width = canvasWidth;
                 canvas.height = canvasHeight;

                 imageCtx.fillStyle = '#fff'; // Clear with background color
                 imageCtx.fillRect(0, 0, canvas.width, canvas.height);
                 imageCtx.strokeStyle = '#ccc';
                 imageCtx.strokeRect(0.5, 0.5, canvas.width-1, canvas.height-1); // Add border visually inside
            }
        }, 150); // Debounce resize events
    }
}

const debouncedResizeInputCanvas = resizeCanvas(inputCanvas, inputCanvas.parentElement);
const debouncedResizeMainCanvas = resizeCanvas(imageCanvas, imageCanvas.parentElement);

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
    inputCtx.beginPath(); // Begin new path segment for smoother drawing
    inputCtx.moveTo(pos.x, pos.y);
    [lastX, lastY] = [pos.x, pos.y];
}

function stopDrawing() {
    if (!isDrawing) return;
    inputCtx.closePath(); // Close the last path segment
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

inputCanvas.addEventListener('touchstart', startDrawing);
inputCanvas.addEventListener('touchmove', draw);
inputCanvas.addEventListener('touchend', stopDrawing);


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
            const img = new Image();
            img.onload = () => {
                inputCtx.fillStyle = 'rgba(230, 230, 230, 0.8)'; // Clear with slight overlay
                inputCtx.fillRect(0,0, inputCanvas.width, inputCanvas.height);
                // Draw a small preview, centered
                const aspect = img.width / img.height;
                const maxDim = Math.min(inputCanvas.width, inputCanvas.height) * 0.8;
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
                inputCtx.strokeRect(x,y,w,h);

            }
            img.src = uploadedImageDataUrl;
        };
        reader.readAsDataURL(file);
    } else if (file) {
         alert("Please select a valid image file.");
    }
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
    }
}

function drawImageOnCanvas(imageUrl) {
     const img = new Image();
    img.onload = () => {
        currentGeneratedImageUrl = imageUrl; // Store the URL of the currently displayed image
        const container = document.getElementById('image-container');
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
        console.log(`Main canvas updated: ${imageCanvas.width}x${imageCanvas.height}`);
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
        inputContent.push({ type: "image_url", image_url: { url: inputDrawingDataUrl } });
        console.log("Using drawing input in prompt.");
    }


    if (inputContent.length === 0) {
        alert("Please provide some input (text, drawing, or uploaded image).");
        return;
    }

    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    try {
        console.log("Sending input to generateImage:", inputContent);
        const result = await generateImage(inputContent, config.generationAspectRatio);

        if (result && result.url) {
             drawImageOnCanvas(result.url);
        } else if (result && result.error) {
             alert(`Image generation failed: ${result.error}`);
        }
         else {
            alert("Image generation failed. No URL received. Check console.");
             console.warn("Image generation returned unexpected result:", result);
             debouncedResizeMainCanvas(); // Reset main canvas
        }

    } catch (error) {
        console.error("Error during image generation process:", error);
        alert(`An error occurred: ${error.message}`);
        debouncedResizeMainCanvas(); // Reset main canvas on error
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        // Clear inputs for next round? Maybe not automatically.
        // clearInputCanvas();
        // uploadedImageDataUrl = null;
        // imageUpload.value = null;
        // textInput.value = '';
    }
}

generateButton.addEventListener('click', handleGenerate);

// --- Initial setup ---
function initialize() {
    debouncedResizeInputCanvas();
    debouncedResizeMainCanvas(); // Set initial main canvas size/state
    console.log("AI Image Editor Initialized");
}

initialize();

