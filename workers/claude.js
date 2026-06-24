/**
 * workers/claude.js — Anthropic Claude API worker.
 * Uses @anthropic-ai/sdk with claude-3-haiku (fast + cheapest Claude model).
 */

const Anthropic = require('@anthropic-ai/sdk');
const { recordUsage } = require('../services/credits/tracker.js');
const { CLAUDE_MODEL, TIMEOUTS } = require('../shared/constants.js');

let anthropic = null;
let isGroq = false;

function getClient() {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.');
    }
    if (apiKey.startsWith('gsk_')) {
      isGroq = true;
      // instantiate standard OpenAI-compatible client interface inside Anthropic SDK or custom fetch
      // For simplicity, we can pass baseURL to Anthropic SDK or mock messages.create via direct fetch
    } else {
      isGroq = false;
      anthropic = new Anthropic({ apiKey });
    }
  }
  return anthropic;
}

async function queryClaude(question, onStatus) {
  const modelKey = 'claude';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    onStatus({ model: modelKey, status: 'connecting' });

    if (apiKey && apiKey.startsWith('gsk_')) {
      onStatus({ model: modelKey, status: 'querying' });
      // Call Groq API via HTTP fetch (avoids version mismatch)
      const res = await withTimeout(
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-specdec', // default robust Groq model
            messages: [
              {
                role: 'system',
                content: `You are a precise mathematical and analytical assistant. 
When solving problems:
- Show step-by-step work
- State formulas used
- Give a clear final numerical answer with units
- Be concise but thorough`
              },
              {
                role: 'user',
                content: `Solve this problem step by step and provide a clear final answer:\n\n${question}`
              }
            ],
            temperature: 0.2,
            max_tokens: 1024
          })
        }),
        TIMEOUTS.apiCall,
        'Groq API timed out'
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq HTTP error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';

      onStatus({ model: modelKey, status: 'extracting' });

      const usage = data.usage;
      if (usage) {
        recordUsage(modelKey, usage.prompt_tokens || 0, usage.completion_tokens || 0);
      }

      onStatus({ model: modelKey, status: 'done' });

      return {
        model: 'Claude (Groq)',
        modelKey: 'claude',
        raw,
        timestamp: Date.now(),
        error: null,
        tokens: {
          input: usage?.prompt_tokens || 0,
          output: usage?.completion_tokens || 0,
        }
      };
    }

    const client = getClient();
    onStatus({ model: modelKey, status: 'querying' });


    const message = await withTimeout(
      client.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: 0.2,  // Low for math precision
        system: `You are a precise mathematical and analytical assistant. 
When solving problems:
- Show step-by-step work
- State formulas used
- Give a clear final numerical answer with units
- Be concise but thorough`,
        messages: [
          {
            role:    'user',
            content: `Solve this problem step by step and provide a clear final answer:\n\n${question}`,
          },
        ],
      }),
      TIMEOUTS.apiCall,
      'Claude API timed out'
    );

    onStatus({ model: modelKey, status: 'extracting' });

    // Extract text from response
    const raw = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Record token usage for credit tracking
    const usage = message.usage;
    if (usage) {
      recordUsage(modelKey, usage.input_tokens || 0, usage.output_tokens || 0);
    }

    onStatus({ model: modelKey, status: 'done' });

    return {
      model:    'Claude',
      modelKey: 'claude',
      raw,
      timestamp: Date.now(),
      error: null,
      tokens: {
        input:  usage?.input_tokens  || 0,
        output: usage?.output_tokens || 0,
      },
    };

  } catch (err) {
    onStatus({ model: modelKey, status: 'error', message: err.message });
    return {
      model:    'Claude',
      modelKey: 'claude',
      raw:      '',
      timestamp: Date.now(),
      error:    err.message,
      tokens:   { input: 0, output: 0 },
    };
  }
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

module.exports = { queryClaude };
