/**
 * services/verification/engine.js
 * Core verification and confidence scoring engine.
 * Compares parsed answers from multiple LLMs and generates a final verdict.
 */

const { extractAnswer } = require('../parser/extractor.js');
const { NUMERICAL_TOLERANCE, CONFIDENCE } = require('../../shared/constants.js');

/**
 * Main verification function.
 * @param {Array<{model, modelKey, raw, timestamp, error}>} responses
 * @param {string|null} ollamaRaw - Optional Ollama fallback response
 * @returns {VerificationResult}
 */
function verifyResponses(responses, ollamaRaw = null) {
  // Parse all responses
  const parsed = responses.map(r => ({
    ...r,
    parsed: extractAnswer(r.raw),
  }));

  // Filter out errored responses
  const valid = parsed.filter(r => !r.error && r.raw.trim().length > 0);

  if (valid.length === 0) {
    return buildResult(parsed, [], 0, 'error', 'All models failed to respond.', null, ollamaRaw);
  }

  // Group by agreement
  const agreementGroups = findAgreementGroups(valid);
  const largestGroup = agreementGroups.sort((a, b) => b.models.length - a.models.length)[0];

  let confidence = 0;
  let verdict = 'disagree';
  let finalAnswer = null;
  let explanation = '';
  let inconsistencies = [];

  const numWithAnswers = valid.filter(r => r.parsed.hasNumericalAnswer);

  if (largestGroup && largestGroup.models.length >= 2) {
    // At least 2 models agree
    const agreingCount = largestGroup.models.length;

    if (agreingCount === 3) {
      confidence = CONFIDENCE.ALL_AGREE;
      verdict = 'unanimous';
      explanation = 'All three models agree on this answer.';
    } else {
      confidence = CONFIDENCE.TWO_AGREE;
      verdict = 'majority';
      explanation = `${largestGroup.models.join(' and ')} agree on this answer.`;
    }

    finalAnswer = largestGroup.value;

    // Detect inconsistencies with the minority
    const minority = valid.filter(r => !largestGroup.models.includes(r.model));
    for (const m of minority) {
      if (m.parsed.hasNumericalAnswer && m.parsed.numerical !== null) {
        inconsistencies.push({
          model: m.model,
          value: m.parsed.numerical,
          unit: m.parsed.unit,
          message: `${m.model} returned ${m.parsed.numerical}${m.parsed.unit || ''} which differs from the majority answer.`,
        });
      }
    }

  } else {
    // No agreement — trigger Ollama or accept most common
    verdict = 'contested';
    confidence = CONFIDENCE.NONE_AGREE;
    explanation = 'All models returned different answers. ';

    if (ollamaRaw) {
      const ollamaParsed = extractAnswer(ollamaRaw);
      if (ollamaParsed.hasNumericalAnswer) {
        // Find which model Ollama agrees with
        for (const r of valid) {
          if (r.parsed.hasNumericalAnswer && numericallyEqual(r.parsed.numerical, ollamaParsed.numerical)) {
            finalAnswer = ollamaParsed.numerical;
            confidence = CONFIDENCE.NONE_AGREE + CONFIDENCE.OLLAMA_BOOST;
            explanation += `Ollama (llama3) confirms the answer from ${r.model}.`;
            verdict = 'ollama-confirmed';
            break;
          }
        }
        if (!finalAnswer) {
          finalAnswer = ollamaParsed.numerical;
          explanation += `Ollama (llama3) provided an independent answer of ${ollamaParsed.numerical}.`;
        }
      }
    }

    if (!finalAnswer && numWithAnswers.length > 0) {
      // Fall back to median of numerical answers
      const nums = numWithAnswers.map(r => r.parsed.numerical).filter(n => n !== null).sort((a, b) => a - b);
      finalAnswer = nums[Math.floor(nums.length / 2)];
      explanation += 'Using median of available numerical answers.';
    }

    // All answers are inconsistencies
    for (const r of valid) {
      if (r.parsed.hasNumericalAnswer) {
        inconsistencies.push({
          model: r.model,
          value: r.parsed.numerical,
          unit: r.parsed.unit,
          message: `${r.model} returned ${r.parsed.numerical}${r.parsed.unit || ''}.`,
        });
      }
    }
  }

  // Apply confidence penalties for uncertainty language
  for (const r of valid) {
    if (r.parsed.confidenceHints.isUncertain) confidence -= 0.05;
    if (r.parsed.confidenceHints.isCertain) confidence += 0.02;
    if (r.parsed.confidenceHints.isApproximate) confidence -= 0.02;
  }

  confidence = Math.max(0.1, Math.min(0.99, confidence));

  // Find best unit from the agreeing group
  let finalUnit = null;
  if (largestGroup) {
    for (const model of largestGroup.models) {
      const r = valid.find(v => v.model === model);
      if (r?.parsed?.unit) { finalUnit = r.parsed.unit; break; }
    }
  }

  // Collect all formulas
  const allFormulas = [...new Set(valid.flatMap(r => r.parsed.formulas))];

  return {
    parsed,
    agreementGroups,
    matchingModels: largestGroup ? largestGroup.models : [],
    confidence: Math.round(confidence * 100),
    verdict,
    finalAnswer,
    finalUnit,
    allFormulas,
    explanation,
    inconsistencies,
    requiresOllama: verdict === 'contested' && !ollamaRaw,
    ollamaUsed: !!ollamaRaw,
  };
}

/**
 * Group models by agreement on numerical answer.
 */
function findAgreementGroups(responses) {
  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < responses.length; i++) {
    if (assigned.has(i)) continue;
    const ri = responses[i];
    if (!ri.parsed.hasNumericalAnswer) continue;

    const group = { value: ri.parsed.numerical, models: [ri.model] };
    assigned.add(i);

    for (let j = i + 1; j < responses.length; j++) {
      if (assigned.has(j)) continue;
      const rj = responses[j];
      if (!rj.parsed.hasNumericalAnswer) continue;

      if (numericallyEqual(ri.parsed.numerical, rj.parsed.numerical)) {
        group.models.push(rj.model);
        assigned.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Check if two numbers are equal within tolerance.
 */
function numericallyEqual(a, b) {
  if (a === null || b === null) return false;
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return Math.abs(a - b) < 0.001;
  return Math.abs((a - b) / Math.max(Math.abs(a), Math.abs(b))) <= NUMERICAL_TOLERANCE;
}

function buildResult(parsed, agreementGroups, confidence, verdict, explanation, finalAnswer, ollamaRaw) {
  return {
    parsed,
    agreementGroups,
    matchingModels: [],
    confidence,
    verdict,
    finalAnswer,
    finalUnit: null,
    allFormulas: [],
    explanation,
    inconsistencies: [],
    requiresOllama: false,
    ollamaUsed: !!ollamaRaw,
  };
}

module.exports = { verifyResponses, numericallyEqual };
