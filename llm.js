import { Websim } from "@websim/ai-tools";
import { config } from './config.js'; // Assuming config might be used later

const websim = new Websim();

// Function to process input and generate a detailed prompt
async function generateDetailedPrompt(inputContent) {
    if (!websim.env.TEXT_GEN_AVAILABLE) {
         console.warn("Text generation unavailable, using raw input as prompt.");
         const textParts = inputContent.filter(c => c.type === 'text').map(c => c.text);
         let fallbackPrompt = textParts.join(' ');
         if (!fallbackPrompt && inputContent.find(c => c.type === 'image_url')) {
             fallbackPrompt = "Describe or modify the provided image.";
         } else if (!fallbackPrompt) {
             fallbackPrompt = "Generate an interesting image.";
         }
          // Return the fallback prompt directly if text gen is unavailable
          return fallbackPrompt || "Generate an image."; // Ensure some prompt is returned
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

     // Log the request being sent (mask large data URLs for console clarity)
    const loggableMessages = messages.map(msg => ({
         ...msg,
         content: Array.isArray(msg.content)
             ? msg.content.map(item =>
                 item.type === 'image_url'
                     ? { ...item, image_url: { url: item.image_url.url.substring(0, 100) + '...' } }
                     : item
             )
             : typeof msg.content === 'string' ? msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : '') : msg.content
     }));
    console.log("Sending to LLM for prompt generation:", JSON.stringify(loggableMessages));


    try {
        console.log("Calling websim.chat.completions.create for prompt generation...");
        const completion = await websim.chat.completions.create({ messages });
        console.log("Received completion from LLM for prompt:", completion); // Log the raw completion object

        // Check if content exists and is a non-empty string
        const detailedPrompt = completion?.content?.trim();

        if (!detailedPrompt) {
             console.warn("LLM returned empty or invalid content for the prompt. Using fallback.");
             // Construct a basic fallback based on input types
             const hasText = inputContent.some(c => c.type === 'text');
             const hasImage = inputContent.some(c => c.type === 'image_url');
             if (hasText && hasImage) return "Modify the provided image based on the text description.";
             if (hasImage) return "Describe and enhance the provided image.";
             if (hasText) return inputContent.find(c => c.type === 'text').text; // Use user's text directly
             return "A detailed and interesting image."; // Absolute fallback
        }

        console.log("LLM Generated Detailed Prompt:", detailedPrompt);
        return detailedPrompt; // Return the valid prompt

    } catch (error) {
        console.error("Error calling LLM for prompt generation:", error);
        // Throw the error so it's caught by generateImage and reported to the user
        throw new Error(`LLM prompt generation failed: ${error.message || 'Unknown error'}`);
    }
}


// Function to generate the image using the detailed prompt
export async function generateImage(inputContent, aspectRatio = config.generationAspectRatio) {
    if (!websim.env.IMAGE_GEN_AVAILABLE) {
        const errorMsg = "Image generation feature is not available in this environment.";
        console.error(errorMsg);
        return { error: errorMsg }; // Return error object for UI handling
    }

    let detailedPrompt;
    try {
        // Step 1: Generate the detailed prompt using the LLM
        console.log("Attempting to generate detailed prompt...");
        detailedPrompt = await generateDetailedPrompt(inputContent); // Can throw error
        console.log("Detailed prompt generated successfully:", detailedPrompt);

        // Simple validation, though generateDetailedPrompt should handle fallbacks/errors
        if (!detailedPrompt || typeof detailedPrompt !== 'string' || detailedPrompt.length === 0) {
             console.error("Detailed prompt generation resulted in an invalid prompt:", detailedPrompt);
             return { error: "Failed to create a valid prompt from the input." };
        }

    } catch (error) {
         // Catch error from generateDetailedPrompt
         console.error("Failed during detailed prompt generation step:", error);
         // Return the error message from the caught error
         return { error: error.message || "Failed to generate detailed prompt." };
    }

    try {
        // Step 2: Generate the image using the valid, detailed prompt
        console.log(`Attempting to generate image with prompt: "${detailedPrompt.substring(0, 100)}..." and aspect ratio: ${aspectRatio}`);
        const result = await websim.imageGen({
            prompt: detailedPrompt,
            aspect_ratio: aspectRatio,
        });

        console.log("Image generation API raw result:", result); // Log the full result

        // Validate the result structure
        if (!result || typeof result !== 'object') {
            console.error("Image generation API returned an invalid result:", result);
            return { error: "Image generation failed: Invalid response from API." };
        }
        if (result.error) {
             console.error("Image generation API returned an error:", result.error);
             return { error: `Image generation failed: ${result.error}` };
        }
        if (!result.url || typeof result.url !== 'string' || result.url.length === 0) {
            console.error("Image generation API did not return a valid URL. Result:", result);
            return { error: "Image generation failed: No valid image URL received." };
        }

        // Success case: return the result object containing the URL
        return result;

    } catch (error) {
        // Catch errors specifically from websim.imageGen or unexpected issues in this block
        console.error("Error during image generation API call:", error);
        return { error: `Image generation failed: ${error.message || 'Unknown API error'}` };
    }
}