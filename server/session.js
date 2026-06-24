/**
 * session.js — Persistent Chromium browser lifecycle manager.
 * Uses a single Playwright persistent context so login sessions are preserved
 * across application restarts.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(__dirname, '..', 'browser-profile');

let browser = null;
let context = null;
const pages = {};

async function getBrowser() {
  if (context) return context;

  // Ensure user data directory exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log('[Session] Launching persistent Chromium context...');
  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ],
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  context.on('close', () => {
    console.log('[Session] Context closed.');
    context = null;
    browser = null;
  });

  return context;
}

/**
 * Get or create a dedicated page for a given model.
 * @param {'chatgpt'|'gemini'|'perplexity'} model
 */
async function getPage(model) {
  const ctx = await getBrowser();

  // Re-use existing page if it's still open
  if (pages[model] && !pages[model].isClosed()) {
    return pages[model];
  }

  const page = await ctx.newPage();
  pages[model] = page;

  // Anti-bot detection evasion
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return page;
}

async function closeBrowser() {
  try {
    if (context) {
      await context.close();
      context = null;
    }
  } catch (e) {
    console.error('[Session] Error closing browser:', e.message);
  }
}

module.exports = { getPage, closeBrowser, getBrowser };
