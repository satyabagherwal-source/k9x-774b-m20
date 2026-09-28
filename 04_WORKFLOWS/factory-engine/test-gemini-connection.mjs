import { getGeminiApiKey, callGeminiApi } from './gemini-brain-agent.mjs';

async function testConnection() {
  console.log(`======================================================================`);
  console.log(`🔌 AI-BUILDER-BRAIN <-> GOOGLE GEMINI SERVER-TO-SERVER TEST`);
  console.log(`======================================================================`);

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error(`❌ [FAILED] GEMINI_API_KEY is not set.`);
    console.log(`\nTo enable 24/7 autonomous Google Gemini server-to-server learning:`);
    console.log(`1. Get a FREE API key from Google AI Studio: https://aistudio.google.com/app/apikey`);
    console.log(`2. For GitHub Cloud 24/7 runner:`);
    console.log(`   Go to: https://github.com/satyabagherwal-source/AI-Builder-Brain/settings/secrets/actions`);
    console.log(`   Click "New repository secret", name it "GEMINI_API_KEY", and paste your key.`);
    console.log(`3. For Local Testing on laptop:`);
    console.log(`   Create a file .brain-secrets.json with: { "GEMINI_API_KEY": "your_key" }`);
    console.log(`   OR run in terminal: $env:GEMINI_API_KEY="your_key"`);
    process.exit(1);
  }

  const masked = apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
  console.log(`🔑 [API KEY DETECTED] Using key: ${masked}`);
  console.log(`📡 [PROBING] Sending test heartbeat to Google Gemini...`);

  try {
    const result = await callGeminiApi(
      'Respond with exactly: "AI-Builder-Brain Server-to-Server Gemini Connection ONLINE and Operational."',
      'You are a systems diagnostic responder.'
    );

    console.log(`\n🎉 [SUCCESS] Server-to-Server Connection Established!`);
    console.log(`Model Responded: ${result.model}`);
    console.log(`Output: ${result.text.trim()}`);
    console.log(`\nAI-Builder-Brain and Google Gemini are ready for 24/7 continuous autonomous learning.`);
  } catch (err) {
    console.error(`\n❌ [CONNECTION FAILED] Error communicating with Google Gemini: ${err.message}`);
    process.exit(1);
  }
}

testConnection();
