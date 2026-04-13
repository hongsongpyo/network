// src/metrics/ultrasmallworld.js

/**
 * Ultra-small world analysis
 *
 * Purpose:
 * - Interpret whether the network shows ultra-small-world-like behavior
 * - Combine path-based compactness with hub heterogeneity
 *
 * This is a practical interpretation module for coursework:
 * it does not claim a strict asymptotic proof, but provides
 * evidence-based 판단 using:
 * - average shortest path length
 * - diameter
 * - six-degree ratio
 * - degree heterogeneity
 * - hub dominance
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute ultra-small-world style indicators.
 *
 * Expected inputs:
 * - shortestPathResult.raw.summary
 * - squaredDegreeResult.raw.summary
 * - optional centralityResult.raw.summary
 *
 * @param {Object} inputs
 * @param {Object} inputs.shortestPathSummary
 * @param {Object} inputs.squaredDegreeSummary
 * @param {Object} [inputs.centralitySummary]
 * @returns {Object}
 */
export function computeUltraSmallWorld(inputs = {}) {
  const shortestPathSummary = inputs.shortestPathSummary ?? {};
  const squaredDegreeSummary = inputs.squaredDegreeSummary ?? {};
  const centralitySummary = inputs.centralitySummary ?? {};

  const averageShortestPathLength =
    safeNumber(shortestPathSummary.averageShortestPathLength) ?? 0;

  const diameter =
    safeNumber(shortestPathSummary.diameter) ?? 0;

  const sixDegreeRatio =
    safeNumber(shortestPathSummary.sixDegreeRatio) ?? 0;

  const reachablePairRatio =
    safeNumber(shortestPathSummary.reachablePairRatio) ?? 0;

  const heterogeneityIndex =
    safeNumber(squaredDegreeSummary.heterogeneityIndex) ?? 0;

  const avgDegree =
    safeNumber(squaredDegreeSummary.avgDegree) ?? 0;

  const maxDegree =
    safeNumber(squaredDegreeSummary.maxDegree) ?? 0;

  const maxDegreeCentrality =
    safeNumber(centralitySummary.maxDegreeCentrality) ?? 0;

  const maxBetweennessCentrality =
    safeNumber(centralitySummary.maxBetweennessCentrality) ?? 0;

  const hubDominanceRatio =
    avgDegree > 0 ? maxDegree / avgDegree : 0;

  const compactnessScore = computeCompactnessScore({
    averageShortestPathLength,
    diameter,
    sixDegreeRatio,
    reachablePairRatio,
  });

  const hubScore = computeHubScore({
    heterogeneityIndex,
    hubDominanceRatio,
    maxDegreeCentrality,
    maxBetweennessCentrality,
  });

  const ultraSmallWorldScore = (compactnessScore + hubScore) / 2;
  const classification = classifyUltraSmallWorld(ultraSmallWorldScore);

  const result = {
    summary: {
      averageShortestPathLength,
      diameter,
      sixDegreeRatio,
      reachablePairRatio,
      heterogeneityIndex,
      avgDegree,
      maxDegree,
      hubDominanceRatio,
      maxDegreeCentrality,
      maxBetweennessCentrality,
      compactnessScore,
      hubScore,
      ultraSmallWorldScore,
      classification,
    },

    interpretation: buildUltraSmallWorldInterpretation({
      averageShortestPathLength,
      diameter,
      sixDegreeRatio,
      reachablePairRatio,
      heterogeneityIndex,
      hubDominanceRatio,
      compactnessScore,
      hubScore,
      ultraSmallWorldScore,
      classification,
    }),
  };

  return result;
}

/**
 * UI formatter
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatUltraSmallWorldForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Ultra-small World',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, interpretation } = result;

  const metrics = [
    {
      label: 'Avg Path Length',
      value: formatNumber(summary.averageShortestPathLength, 3),
    },
    {
      label: 'Diameter',
      value: formatNumber(summary.diameter, 3),
    },
    {
      label: '≤ 6 Steps Ratio',
      value: formatPercent(summary.sixDegreeRatio),
    },
    {
      label: 'Heterogeneity',
      value: formatNumber(summary.heterogeneityIndex, 3),
    },
    {
      label: 'Compactness Score',
      value: formatNumber(summary.compactnessScore, 3),
    },
    {
      label: 'Hub Score',
      value: formatNumber(summary.hubScore, 3),
    },
    {
      label: 'Ultra-small Score',
      value: formatNumber(summary.ultraSmallWorldScore, 3),
    },
    {
      label: 'Classification',
      value: summary.classification,
    },
  ];

  return {
    title: 'Ultra-small World',
    metrics,
    interpretation,
    sections: [],
  };
}

/**
 * Convenience wrapper
 *
 * @param {Object} inputs
 * @returns {Object}
 */
export function runUltraSmallWorld(inputs = {}) {
  const raw = computeUltraSmallWorld(inputs);
  const display = formatUltraSmallWorldForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildUltraSmallWorldInterpretation({
  averageShortestPathLength = 0,
  diameter = 0,
  sixDegreeRatio = 0,
  reachablePairRatio = 0,
  heterogeneityIndex = 0,
  hubDominanceRatio = 0,
  compactnessScore = 0,
  hubScore = 0,
  ultraSmallWorldScore = 0,
  classification = 'weak',
} = {}) {
  const lines = [];

  lines.push(
    `The network has an average shortest path length of ${formatNumber(averageShortestPathLength, 3)} and a diameter of ${formatNumber(diameter, 3)}.`
  );

  if (sixDegreeRatio >= 0.9) {
    lines.push(
      'Most reachable node pairs are connected within six steps, which strongly supports a very compact global structure.'
    );
  } else if (sixDegreeRatio >= 0.6) {
    lines.push(
      'A substantial portion of reachable pairs fall within six steps, indicating moderate small-world compactness.'
    );
  } else {
    lines.push(
      'The six-step reachability is limited, so ultra-small-world behavior is not strongly supported by path compression alone.'
    );
  }

  lines.push(
    `The degree heterogeneity index is ${formatNumber(heterogeneityIndex, 3)}, and the max-degree / average-degree ratio is ${formatNumber(hubDominanceRatio, 3)}.`
  );

  if (heterogeneityIndex > 3 || hubDominanceRatio > 3) {
    lines.push(
      'This suggests that hub nodes may strongly compress distances across the network.'
    );
  } else {
    lines.push(
      'Hub dominance is not extremely strong, so distance compression from hubs may be more limited.'
    );
  }

  if (reachablePairRatio < 1) {
    lines.push(
      'Because not all node pairs are reachable, the ultra-small-world interpretation applies mainly to the reachable backbone of the graph.'
    );
  }

  lines.push(
    `Overall, the combined ultra-small-world score is ${formatNumber(ultraSmallWorldScore, 3)}, which is classified as "${classification}".`
  );

  if (classification === 'strong') {
    lines.push(
      'This network shows strong evidence that hub structure and short global distances jointly produce ultra-small-world-like behavior.'
    );
  } else if (classification === 'moderate') {
    lines.push(
      'This network shows partial ultra-small-world characteristics, but the evidence is not extreme.'
    );
  } else {
    lines.push(
      'This network does not strongly exhibit ultra-small-world behavior under the current indicators.'
    );
  }

  return lines;
}

/* =========================
   Scoring helpers
   ========================= */

function computeCompactnessScore({
  averageShortestPathLength = 0,
  diameter = 0,
  sixDegreeRatio = 0,
  reachablePairRatio = 0,
} = {}) {
  let score = 0;

  if (averageShortestPathLength > 0) {
    if (averageShortestPathLength <= 3) score += 0.35;
    else if (averageShortestPathLength <= 5) score += 0.25;
    else if (averageShortestPathLength <= 7) score += 0.15;
  }

  if (diameter > 0) {
    if (diameter <= 6) score += 0.2;
    else if (diameter <= 10) score += 0.12;
    else if (diameter <= 15) score += 0.05;
  }

  if (sixDegreeRatio >= 0.9) score += 0.3;
  else if (sixDegreeRatio >= 0.7) score += 0.22;
  else if (sixDegreeRatio >= 0.5) score += 0.14;
  else if (sixDegreeRatio >= 0.3) score += 0.06;

  if (reachablePairRatio >= 0.95) score += 0.15;
  else if (reachablePairRatio >= 0.8) score += 0.08;

  return clamp01(score);
}

function computeHubScore({
  heterogeneityIndex = 0,
  hubDominanceRatio = 0,
  maxDegreeCentrality = 0,
  maxBetweennessCentrality = 0,
} = {}) {
  let score = 0;

  if (heterogeneityIndex >= 4) score += 0.35;
  else if (heterogeneityIndex >= 2.5) score += 0.25;
  else if (heterogeneityIndex >= 1.5) score += 0.15;

  if (hubDominanceRatio >= 5) score += 0.3;
  else if (hubDominanceRatio >= 3) score += 0.2;
  else if (hubDominanceRatio >= 2) score += 0.1;

  if (maxDegreeCentrality >= 0.4) score += 0.2;
  else if (maxDegreeCentrality >= 0.2) score += 0.12;
  else if (maxDegreeCentrality >= 0.1) score += 0.06;

  if (maxBetweennessCentrality >= 0.3) score += 0.15;
  else if (maxBetweennessCentrality >= 0.15) score += 0.1;
  else if (maxBetweennessCentrality >= 0.05) score += 0.05;

  return clamp01(score);
}

function classifyUltraSmallWorld(score) {
  if (score >= 0.7) return 'strong';
  if (score >= 0.45) return 'moderate';
  return 'weak';
}

/* =========================
   Utility helpers
   ========================= */

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return Number(value).toFixed(digits);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}