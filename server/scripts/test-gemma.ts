/**
 * TalkLedger — Google Gemma 2 Live Inference Verification Script
 *
 * Usage:
 *   $env:GROQ_API_KEY="gsk_..." ; npx tsx scripts/test-gemma.ts
 *   OR
 *   $env:HF_TOKEN="hf_..." ; npx tsx scripts/test-gemma.ts
 *
 * Safety:
 *   - Never logs or exposes the raw API key.
 *   - Does not perform any database mutations.
 *   - Transparently validates real model inference.
 */

import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

function maskKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

async function verifyGemma() {
  console.log('=== Google Gemma 2 Live Inference Test ===');
  const groqKey = process.env.GROQ_API_KEY;
  const hfToken = process.env.HF_TOKEN;
  const modelName = process.env.GEMMA_MODEL || 'gemma2-9b-it';

  if (!groqKey && !hfToken) {
    console.log('[Status] NO CREDENTIALS CONFIGURED');
    console.log('To run a live test with your credentials, execute:');
    console.log('  $env:GROQ_API_KEY="gsk_your_key_here"; npx tsx scripts/test-gemma.ts');
    console.log('Gemma conversational assistant will safely remain in honest deterministic fallback mode.');
    process.exit(0);
  }

  if (groqKey) {
    console.log(`[Provider] Groq Cloud LPU`);
    console.log(`[API Key] ${maskKey(groqKey)}`);
    console.log(`[Model] ${modelName}`);

    try {
      const groq = new Groq({ apiKey: groqKey });
      const startTime = Date.now();

      const response = await groq.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are TalkLedger assistant powered by Google Gemma 2.' },
          { role: 'user', content: 'Reply in one sentence: What is TalkLedger?' },
        ],
        temperature: 0.2,
        max_tokens: 100,
      });

      const elapsed = Date.now() - startTime;
      const reply = response.choices[0]?.message?.content?.trim();

      console.log(`\n[Result] SUCCESS (${elapsed}ms)`);
      console.log(`[Model Output]: ${reply}\n`);
      console.log('✓ Verified: Real Google Gemma 2 inference succeeds with provided credentials.');
    } catch (err: any) {
      console.error(`\n[Result] FAILED: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (hfToken) {
    console.log(`[Provider] Hugging Face Serverless Inference`);
    console.log(`[Token] ${maskKey(hfToken)}`);
    const hfModel = modelName.startsWith('google/') ? modelName : `google/${modelName}`;
    console.log(`[Model] ${hfModel}`);

    try {
      const startTime = Date.now();
      const res = await fetch(`https://router.huggingface.co/hf-inference/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hfToken}`,
        },
        body: JSON.stringify({
          model: hfModel,
          messages: [
            { role: 'system', content: 'You are TalkLedger assistant powered by Google Gemma 2.' },
            { role: 'user', content: 'Reply in one sentence: What is TalkLedger?' },
          ],
          max_tokens: 100,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data: any = await res.json();
      const elapsed = Date.now() - startTime;
      const reply = data.choices?.[0]?.message?.content?.trim();

      console.log(`\n[Result] SUCCESS (${elapsed}ms)`);
      console.log(`[Model Output]: ${reply}\n`);
      console.log('✓ Verified: Real Google Gemma 2 inference succeeds via Hugging Face.');
    } catch (err: any) {
      console.error(`\n[Result] FAILED: ${err.message}`);
      process.exit(1);
    }
  }
}

verifyGemma();
