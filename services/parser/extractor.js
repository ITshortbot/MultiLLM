/**
 * services/parser/extractor.js
 * Extracts structured information from raw LLM text responses:
 *  - Numerical answer (with unit)
 *  - Formulas used
 *  - Step-by-step reasoning
 *  - Confidence hints from language
 */

/**
 * Main extraction function.
 * @param {string} raw - Raw text from LLM
 * @returns {ParsedResult}
 */
function extractAnswer(raw) {
  if (!raw || raw.trim().length === 0) {
    return emptyResult();
  }

  const numerical = extractNumericalAnswer(raw);
  const unit = extractUnit(raw, numerical);
  const formulas = extractFormulas(raw);
  const steps = extractSteps(raw);
  const confidenceHints = extractConfidenceHints(raw);
  const finalStatement = extractFinalStatement(raw);

  return {
    numerical,
    unit,
    formulas,
    steps,
    confidenceHints,
    finalStatement,
    hasNumericalAnswer: numerical !== null,
  };
}

/**
 * Extract the primary numerical value from the response.
 * Tries several strategies in priority order.
 */
function extractNumericalAnswer(text) {
  // Strategy 1: "The answer is X" / "= X" / "equals X"
  const answerPatterns = [
    /(?:the\s+)?(?:final\s+)?answer\s+is\s*[:\s=]?\s*([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)\s*(%|[a-zA-Z²³°\/]*)/i,
    /(?:equals?|=|≈|≅)\s*([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)\s*(%|[a-zA-Z²³°\/]*)/i,
    /result\s+is\s*[:\s]?\s*([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)/i,
    /therefore[,\s]+([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)/i,
    /(?:so|thus|hence)[,\s]+(?:the\s+)?(?:answer\s+is\s*)?([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)/i,
  ];

  for (const pattern of answerPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val)) return val;
    }
  }

  // Strategy 2: Bold/emphasized numbers (**X** or *X*)
  const boldMatch = text.match(/\*\*([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)\s*[a-zA-Z%°]*\*\*/);
  if (boldMatch) {
    const val = parseFloat(boldMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) return val;
  }

  // Strategy 3: Last numerical value in the text (often the answer)
  const allNumbers = [...text.matchAll(/([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)/g)];
  if (allNumbers.length > 0) {
    // Prefer a number near "answer", "result", "total", or at end of text
    const lastHalf = text.slice(text.length / 2);
    const lastNums = [...lastHalf.matchAll(/([+-]?\d[\d,]*\.?\d*(?:[eE][+-]?\d+)?)/g)];
    if (lastNums.length > 0) {
      const val = parseFloat(lastNums[lastNums.length - 1][1].replace(/,/g, ''));
      if (!isNaN(val)) return val;
    }
  }

  return null;
}

/**
 * Extract unit from text, near the numerical answer.
 */
function extractUnit(text, numerical) {
  if (numerical === null) return null;

  const unitPatterns = [
    // SI units and common units
    /\b(\d+\.?\d*)\s*(kg|g|mg|lb|oz|ton)\b/i,
    /\b(\d+\.?\d*)\s*(m|km|cm|mm|mi|ft|in|yd)\b/i,
    /\b(\d+\.?\d*)\s*(m\/s|km\/h|mph|ft\/s)\b/i,
    /\b(\d+\.?\d*)\s*(m²|m³|cm²|ft²|L|mL|gal)\b/i,
    /\b(\d+\.?\d*)\s*(N|J|W|kW|kWh|Pa|kPa|atm|bar)\b/i,
    /\b(\d+\.?\d*)\s*(°C|°F|K|°)\b/i,
    /\b(\d+\.?\d*)\s*(%)/,
    /\b(\d+\.?\d*)\s*(\$|€|£|¥)/,
    /(?:\$|€|£|¥)\s*(\d+\.?\d*)/,
    /\b(\d+\.?\d*)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/i,
    /\b(\d+\.?\d*)\s*(A|V|Ω|Hz|MHz|GHz|mA)\b/i,
  ];

  for (const pattern of unitPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[2] || match[1]; // Return the unit part
    }
  }

  // Check if the answer near numerical has a unit
  const numStr = numerical.toString();
  const idx = text.indexOf(numStr);
  if (idx !== -1) {
    const after = text.slice(idx + numStr.length, idx + numStr.length + 20);
    const unitMatch = after.match(/^\s*([a-zA-Z²³°\/]{1,8})/);
    if (unitMatch && !isCommonWord(unitMatch[1])) {
      return unitMatch[1].trim();
    }
  }

  return null;
}

function isCommonWord(word) {
  const common = ['the', 'is', 'are', 'in', 'to', 'a', 'an', 'and', 'or', 'of', 'for', 'be'];
  return common.includes(word.toLowerCase());
}

/**
 * Extract mathematical formulas from the text.
 */
function extractFormulas(text) {
  const formulas = new Set();

  // LaTeX-style formulas: $...$, $$...$$, \(...\)
  const latexPatterns = [
    /\$\$([^$]+)\$\$/g,
    /\$([^$\n]+)\$/g,
    /\\\(([^)]+)\\\)/g,
    /\\\[([^\]]+)\\\]/g,
  ];

  for (const pattern of latexPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1].trim().length > 0) formulas.add(match[1].trim());
    }
  }

  // Inline formulas: "F = ma", "E = mc²", "PV = nRT"
  const inlineFormula = /\b([A-Z][a-zA-Z₀₁₂₃₄₅₆₇₈₉²³]*(?:\s*[=×÷+\-*/^]\s*[A-Z0-9a-z₀₁₂₃₄₅₆₇₈₉²³()\[\]]+)+)\b/g;
  for (const match of text.matchAll(inlineFormula)) {
    if (match[1].length > 2) formulas.add(match[1].trim());
  }

  return [...formulas].slice(0, 5); // Return max 5 formulas
}

/**
 * Extract step-by-step reasoning (numbered or bulleted steps).
 */
function extractSteps(text) {
  const steps = [];

  // Numbered steps: "1.", "Step 1:", etc.
  const numberedPattern = /(?:^|\n)\s*(?:step\s+)?(\d+)[.):]\s+(.+?)(?=\n\s*(?:step\s+)?\d+[.):]\s|$)/gis;
  for (const match of text.matchAll(numberedPattern)) {
    const step = match[2].trim().replace(/\n/g, ' ');
    if (step.length > 5 && step.length < 300) {
      steps.push(step);
    }
  }

  // If no numbered steps, try to split by newlines and return meaningful sentences
  if (steps.length === 0) {
    const lines = text.split('\n').filter(l => l.trim().length > 20);
    return lines.slice(0, 6).map(l => l.trim());
  }

  return steps.slice(0, 8);
}

/**
 * Detect confidence hints in the language used.
 */
function extractConfidenceHints(text) {
  const hints = {
    isUncertain: false,
    isCertain: false,
    isApproximate: false,
    markers: [],
  };

  const uncertainWords = ['approximately', 'roughly', 'about', 'around', 'estimate', 'uncertain', "i'm not sure", 'may be', 'might be', 'could be', 'unclear'];
  const certainWords = ['exactly', 'precisely', 'definitely', 'certainly', 'clearly', 'the answer is', 'equals exactly'];
  const approxWords = ['≈', '~', 'approximately', 'roughly', 'around'];

  const lower = text.toLowerCase();

  for (const word of uncertainWords) {
    if (lower.includes(word)) {
      hints.isUncertain = true;
      hints.markers.push(word);
    }
  }

  for (const word of certainWords) {
    if (lower.includes(word)) {
      hints.isCertain = true;
    }
  }

  for (const word of approxWords) {
    if (lower.includes(word)) {
      hints.isApproximate = true;
    }
  }

  return hints;
}

/**
 * Try to extract the final conclusion/summary sentence.
 */
function extractFinalStatement(text) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

  // Look for a concluding sentence
  const conclusionKeywords = ['therefore', 'thus', 'hence', 'so', 'in conclusion', 'finally', 'the answer', 'the result'];
  for (const sentence of sentences.reverse()) {
    const lower = sentence.toLowerCase();
    if (conclusionKeywords.some(k => lower.includes(k))) {
      return sentence.trim();
    }
  }

  // Return last meaningful sentence
  return sentences.length > 0 ? sentences[0].trim() : '';
}

function emptyResult() {
  return {
    numerical: null,
    unit: null,
    formulas: [],
    steps: [],
    confidenceHints: { isUncertain: false, isCertain: false, isApproximate: false, markers: [] },
    finalStatement: '',
    hasNumericalAnswer: false,
  };
}

module.exports = { extractAnswer };
