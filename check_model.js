
require('dotenv').config();
const { VertexAI } = require('@google-cloud/vertexai');

// --- Configuration ---
const GCP_PROJECT = process.env.GCP_PROJECT;
// The AI models are in us-central1 according to the project documentation
const GCP_REGION = 'us-central1'; 

// Get model name from command line arguments
const modelName = process.argv[2];

if (!modelName) {
  console.error('Error: Please provide a model name as an argument.');
  console.log('Usage: node check_model.js <model-name>');
  process.exit(1);
}

if (!GCP_PROJECT) {
  console.error('Error: GCP_PROJECT environment variable not set. Please ensure your .env file is correct.');
  process.exit(1);
}


// --- Main Test Function ---
async function checkModelAvailability() {
  console.log(`Checking availability of model: ${modelName} in project ${GCP_PROJECT} (region: ${GCP_REGION})...`);

  try {
    // 1. Initialize Vertex AI
    const vertex_ai = new VertexAI({ project: GCP_PROJECT, location: GCP_REGION });

    // 2. Get the generative model
    // This will throw an error if the model doesn't exist or isn't available.
    const generativeModel = vertex_ai.getGenerativeModel({
      model: modelName,
    });

    // 3. Send a minimal, low-cost prompt to test the full API cycle
    const testPrompt = "test";
    const result = await generativeModel.generateContent(testPrompt);
    
    // 4. Check for a valid response
    if (result && result.response && result.response.candidates && result.response.candidates.length > 0) {
      console.log('--------------------------------------------------');
      console.log(`✅ Success! The model "${modelName}" is available and responded correctly.`);
      console.log('--------------------------------------------------');
    } else {
      throw new Error('Received an empty or invalid response from the model.');
    }

  } catch (error) {
    console.error('--------------------------------------------------');
    console.error(`❌ Error: The model "${modelName}" is not available or could not be reached.`);
    console.error('--------------------------------------------------');
    
    // Provide more specific feedback based on common errors
    if (error.message && error.message.includes('404')) {
        console.error('Reason: Not Found (404). The model name may be incorrect or it might not be available in the ' + GCP_REGION + ' region.');
    } else if (error.message && error.message.includes('403')) {
        console.error('Reason: Permission Denied (403). Check your service account authentication and IAM permissions for Vertex AI.');
    } else {
        console.error('Full Error Details:', error.message);
    }
  }
}

// --- Run the check ---
checkModelAvailability();
