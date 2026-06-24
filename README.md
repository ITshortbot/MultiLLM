# Multi-LLM Calculation Verification System

A production-grade Electron + React desktop application that accepts any mathematical, analytical, financial, or logical problem and simultaneously queries **ChatGPT**, **Gemini**, and **Perplexity** via Playwright browser automation. Responses are compared, verified, and scored — producing a final answer with a confidence percentage.

## Features

- ⚡ Concurrent queries to ChatGPT, Gemini, Perplexity
- 🧠 Intelligent answer extraction (numbers, units, formulas)
- 📊 Confidence scoring with agreement detection
- 🦙 Ollama fallback when all 3 models disagree
- 🗂 SQLite history with persistent sessions
- 💎 Dark glassmorphism UI with live status indicators

## Prerequisites

1. **Node.js 18+**
2. **Playwright Chromium** (installed separately — see below)
3. **Ollama** (optional, for fallback): https://ollama.ai

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright Chromium browser
npx playwright install chromium

# 3. Start the app in development mode
npm run dev
```

## First Run — Logging In

On first launch, a Chromium browser window will open. **Log into ChatGPT, Gemini, and Perplexity** in this window. Your sessions will be saved to the `browser-profile/` directory and reused on subsequent runs.

## Usage

1. Type your question in the input field (supports math, finance, engineering, logic)
2. Press **Run Verification** or `Ctrl+Enter`
3. Watch the live status indicators for each model
4. Review individual responses, confidence meter, and the final verdict panel
5. Previous queries are accessible in the history sidebar

## Folder Structure

```
jay/
├── electron.cjs           ← Electron main process
├── preload.cjs            ← contextBridge IPC
├── vite.config.js
├── client/src/            ← React frontend
├── server/                ← IPC handlers
├── workers/               ← Playwright automations
├── services/
│   ├── parser/            ← Answer extraction
│   ├── verification/      ← Confidence engine
│   ├── ollama/            ← Fallback LLM
│   └── history/           ← SQLite store
├── database/              ← Schema + DB file
└── shared/                ← Constants
```

## Ollama Setup (Optional)

```bash
# Install Ollama from https://ollama.ai
ollama serve           # Start the server
ollama pull llama3     # Download the model
```

When all 3 models disagree, the system automatically queries your local Ollama instance.
