/**
 * perplexity.js — Playwright worker for Perplexity AI (perplexity.ai)
 */

const { getPage } = require('../server/session.js');
const { PERPLEXITY_URL, TIMEOUTS } = require('../shared/constants.js');

async function queryPerplexity(question, onStatus) {
  const model = 'perplexity';
  try {
    onStatus({ model, status: 'connecting' });

    const page = await getPage(model);

    const currentUrl = page.url();
    if (!currentUrl.startsWith('https://www.perplexity.ai') && !currentUrl.startsWith('https://perplexity.ai')) {
      await page.goto(PERPLEXITY_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    }

    onStatus({ model, status: 'querying' });

    // Wait for input field
    await page.waitForSelector('textarea[placeholder], [contenteditable="true"]', {
      timeout: TIMEOUTS.elementWait,
    });

    // Perplexity uses a textarea
    const inputEl = page.locator('textarea').first();
    await inputEl.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await inputEl.fill(question);

    // Submit
    await page.keyboard.press('Enter');

    onStatus({ model, status: 'waiting' });

    // Wait for answer container to appear
    await page.waitForSelector('.prose, [class*="answer"], [class*="response"]', {
      timeout: TIMEOUTS.responseStart,
    });

    // Wait for streaming complete
    await waitForPerplexityComplete(page);

    onStatus({ model, status: 'extracting' });

    const raw = await extractPerplexityResponse(page);

    onStatus({ model, status: 'done' });

    return {
      model: 'Perplexity',
      modelKey: 'perplexity',
      raw,
      timestamp: Date.now(),
      error: null,
    };
  } catch (err) {
    onStatus({ model, status: 'error', message: err.message });
    return {
      model: 'Perplexity',
      modelKey: 'perplexity',
      raw: '',
      timestamp: Date.now(),
      error: err.message,
    };
  }
}

async function waitForPerplexityComplete(page) {
  const maxWait = TIMEOUTS.streamingComplete;
  const pollInterval = 1000;
  let elapsed = 0;
  let lastLength = 0;
  let stableCount = 0;

  while (elapsed < maxWait) {
    await page.waitForTimeout(pollInterval);
    elapsed += pollInterval;

    // Perplexity shows a loading spinner / stop button during streaming
    const loadingEl = page.locator('[class*="loading"], [aria-label="Stop"], button[class*="stop"]');
    const isLoading = await loadingEl.isVisible().catch(() => false);

    if (!isLoading) {
      const text = await extractPerplexityResponse(page).catch(() => '');
      if (text.length > 0 && text.length === lastLength) {
        stableCount++;
        if (stableCount >= 2) break;
      } else {
        stableCount = 0;
        lastLength = text.length;
      }
    } else {
      stableCount = 0;
      lastLength = 0;
    }
  }
}

async function extractPerplexityResponse(page) {
  // Perplexity renders answer in .prose or similar
  const answerEl = page.locator('.prose, [class*="answer-text"], [class*="response-text"]').first();
  const count = await page.locator('.prose').count().catch(() => 0);

  if (count === 0) {
    return await page.locator('p').last().textContent().catch(() => '');
  }

  const text = await answerEl.textContent().catch(() => '');
  return text.trim();
}

module.exports = { queryPerplexity };
