import { Websim } from "@websim/ai-tools";
import { config } from './config.js'; // Import config if needed for LLM settings

const websim = new Websim();

// No persistent history needed for this specific flow (process -> generate prompt -> generate image)
// Each generation starts fresh based on current input canvas/text/upload state.

// Function to process input and generate a detailed prompt
async function generateDetailedPrompt(inputContent) {
    if (!websim.env.TEXT_GEN_AVAILABLE) {
         console.warn("Text generation unavailable, using raw input as prompt.");
         // Fallback: combine text parts or just use the first text part.
         const textParts = inputContent.filter(c => c.type === 'text').map(c => c.text);
         let fallbackPrompt = textParts.join(' ');
         if (!fallbackPrompt && inputContent.find(c => c.type === 'image_url')) {
             fallbackPrompt = "Describe or modify the provided image."; // Generic fallback if only image
         } else if (!fallbackPrompt) {
             fallbackPrompt = "Generate an interesting image."; // Absolute fallback
         }
         return fallbackPrompt;
    }

    // Construct messages for the chat completion
    const messages = [
        {
            role: "system",
            content: `You are an AI assistant specialized in creating detailed, effective image generation prompts.
Analyze the user's input, which may include text descriptions, drawings (as images), and/or uploaded reference images.
Synthesize these elements into a single, coherent, and highly descriptive prompt suitable for an advanced text-to-image AI model (like DALL-E 3 or Stable Diffusion).
Focus on:
- **Subject:** Clearly identify the main subject(s).
- **Action/Pose:** Describe what the subject(s) are doing.
- **Setting/Background:** Detail the environment.
- **Style:** Specify artistic style (e.g., photorealistic, cartoon, watercolor, oil painting, cyberpunk, fantasy art), artist influences, or rendering engine look (e.g., Unreal Engine).
- **Composition:** Suggest camera angle, shot type (e.g., close-up, wide shot), and lighting (e.g., cinematic lighting, soft daylight).
- **Mood/Atmosphere:** Convey the desired feeling (e.g., mysterious, joyful, serene).
- **Details:** Add specific visual details mentioned or implied by the input.
- **Image Interpretation:** If an image (drawing or upload) is provided, describe its key elements and incorporate them naturally into the prompt. If text is also provided, use it to guide the interpretation or modification of the image.
- **Conciseness:** While detailed, keep the final prompt focused and avoid unnecessary jargon unless it relates to style (like 'octane render').
Respond *only* with the generated prompt text, nothing else.`,
        },
        {
            role: "user",
            content: inputContent, // Send the array of text and image parts
        },
    ];

    console.log("Sending to LLM for prompt generation:", messages);

    try {
        const completion = await websim.chat.completions.create({ messages });
        const detailedPrompt = completion.content.trim();
        console.log("LLM Generated Detailed Prompt:", detailedPrompt);

        if (!detailedPrompt) {
             console.warn("LLM returned an empty prompt. Using fallback.");
             return "A visually interesting image based on the user's input."; // Basic fallback
        }
        return detailedPrompt;

    } catch (error) {
        console.error("Error calling LLM for prompt generation:", error);
        throw new Error(`Failed to generate detailed prompt: ${error.message}`);
    }
}


// Function to generate the image using the detailed prompt
export async function generateImage(inputContent, aspectRatio = config.generationAspectRatio) {
    if (!websim.env.IMAGE_GEN_AVAILABLE) {
        const errorMsg = "Image generation is not available in this environment.";
        console.error(errorMsg);
        // Return an object indicating the error, useful for UI feedback
        return { error: errorMsg };
        // Or throw new Error(errorMsg); if preferred
    }

    try {
        // Step 1: Generate the detailed prompt using the LLM
        const detailedPrompt = await generateDetailedPrompt(inputContent);

        if (!detailedPrompt) {
            // Handle case where prompt generation failed or returned empty
             return { error: "Failed to create a detailed prompt from the input." };
        }

        // Step 2: Generate the image using the detailed prompt
        console.log(`Generating image with prompt: "${detailedPrompt}" and aspect ratio: ${aspectRatio}`);
        const result = await websim.imageGen({
            prompt: detailedPrompt,
            aspect_ratio: aspectRatio,
        });

        console.log("Image generation API result:", result);
        // Check if the result has a URL
        if (!result || !result.url) {
             console.error("Image generation API did not return a valid URL. Result:", result);
             return { error: "Image generation failed or did not return a URL." };
        }

        return result; // Should contain { url: "..." } on success

    } catch (error) {
        console.error("Error in generateImage pipeline:", error);
         // Return error object or re-throw
         return { error: `Image generation process failed: ${error.message}` };
    }
}