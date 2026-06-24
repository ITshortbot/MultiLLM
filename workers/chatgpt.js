/**
 * workers/chatgpt.js — ChatGPT placeholder (Coming Soon).
 * OpenAI integration will be added in a future release.
 */

async function queryChatGPT(question, onStatus) {
  const modelKey = 'chatgpt';

  onStatus({ model: modelKey, status: 'coming_soon' });

  // Return a structured "coming soon" response immediately
  return {
    model:      'ChatGPT',
    modelKey:   'chatgpt',
    raw:        '',
    timestamp:  Date.now(),
    error:      null,
    comingSoon: true,
    tokens:     { input: 0, output: 0 },
  };
}

module.exports = { queryChatGPT };
