import { loadAllAiKeys, executeWithGeminiPool } from './ai-provider-pool.mjs';

async function testPool() {
  console.log(`======================================================================`);
  console.log(`🌐 AI-BUILDER-BRAIN OMNI-AI PROVIDER POOL DIAGNOSTIC`);
  console.log(`   Strict Budget Constraint: $0.00 (Zero-Cost Free Tier Only)`);
  console.log(`======================================================================\n`);

  const keys = loadAllAiKeys();

  console.log(`📊 [CONFIGURED PROVIDER ASSETS]`);
  console.log(`   - Google Gemini Keys : ${keys.gemini.length} account(s) loaded`);
  keys.gemini.forEach((k, i) => {
    console.log(`     [${i + 1}] ${k.slice(0, 4)}...${k.slice(-4)}`);
  });
  console.log(`   - Groq Free Keys     : ${keys.groq.length} key(s) loaded`);
  console.log(`   - Hugging Face Tokens: ${keys.huggingface.length} token(s) loaded`);
  console.log(`   - GitHub Token       : ${keys.githubToken ? 'Present (Free Models API ready)' : 'Not detected'}`);

  if (keys.gemini.length === 0 && keys.groq.length === 0) {
    console.log(`\n❌ [NOTICE] No active AI keys found.`);
    console.log(`To configure your 5 Gemini subscription keys or free AI keys:`);
    console.log(`Add them to .brain-secrets.json:`);
    console.log(JSON.stringify({
      GEMINI_KEYS: [
        "your_key_1",
        "your_key_2",
        "your_key_3",
        "your_key_4",
        "your_key_5"
      ],
      GROQ_KEYS: ["your_optional_free_groq_key"]
    }, null, 2));
    process.exit(1);
  }

  console.log(`\n📡 [PROBING GEMINI KEY POOL ROUND-ROBIN]...`);
  try {
    const res = await executeWithGeminiPool(
      'Respond with exactly: "Omni-AI Pool ONLINE and 100% Zero-Cost Ready."',
      'You are a systems diagnostic responder.'
    );
    console.log(`\n🎉 [SUCCESS] Server-to-Server connection confirmed!`);
    console.log(`Active Provider/Model: ${res.model}`);
    console.log(`Key Routed: ${res.keyUsed}`);
    console.log(`Output: ${res.text.trim()}`);
    console.log(`\n✨ All AI accounts are balanced and ready to scour the internet 24/7 with $0.00 cost!`);
  } catch (err) {
    console.warn(`\n⚠️ [PROBE NOTICE] Gemini Pool returned: ${err.message}`);
    console.log(`If you are replacing an invalid or blocked key, update .brain-secrets.json with your new keys.`);
  }
}

testPool();
