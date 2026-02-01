const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT, 
  location: 'us-central1' 
});

async function testModel(modelName) {
    console.log(`Testing model: ${modelName} in us-central1...`);
    try {
        const model = vertex_ai.preview.getGenerativeModel({
            model: modelName,
        });
        const resp = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        });
        console.log(`SUCCESS: ${modelName} responded.`);
    } catch (e) {
         console.log(`FAILED: ${modelName} - ${e.message.split('message')[1] || e.message}`);
    }
}

async function run() {
    await testModel('gemini-2.5-pro'); 
    await testModel('gemini-3-preview'); 
}

run();
