// src/metrics/centralityDistribution.js

/**
 * Centrality distribution analysis
 *
 * Included:
 * - distribution summary for degree centrality, closeness centrality, betweenness centrality
 * - min / max / mean / median
 * - histogram bins
 * - top concentration ratio
 *
 * Input:
 * Prefer passing raw output from centrality.js:
 * {
 *   nodes: [
 *     {
 *       id, label,
 *       degreeCentrality,
 *       closenessCentrality,
 *       betweennessCentrality
 *     }
 *   ]
 * }
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute centrality distribution summaries.
 *
 * @param {Object} centralityResult - raw result from centrality.js OR graph-like object with nodes carrying centrality values
 * @param {Object} [options]
 * @param {number} [options.binCount=10]
 * @param {number} [options.topK=5]
 * @returns {Object}
 */
export function computeCentralityDistribution(centralityResult = {}, options = {}) {
  const binCount = Number.isInteger(options.binCount) && options.binCount > 0
    ? options.binCount
    : 10;

  const topK = Number.isInteger(options.topK) && options.topK > 0
    ? options.topK
    : 5;

  const nodes = Array.isArray(centralityResult.nodes) ? centralityResult.nodes : [];

  const degreeValues = nodes
    .map((node) => safeNumber(node.degreeCentrality))
    .filter((value) => value !== null);

  const closenessValues = nodes
    .map((node) => safeNumber(node.closenessCentrality))
    .filter((value) => value !== null);

  const betweennessValues = nodes
    .map((node) => safeNumber(node.betweennessCentrality))
    .filter((value) => value !== null);

  const degreeSummary = summarizeDistribution(degreeValues, binCount, topK);
  const closenessSummary = summarizeDistribution(closenessValues, binCount, topK);
  const betweennessSummary = summarizeDistribution(betweennessValues, binCount, topK);

  const result = {
    summary: {
      nodeCount: nodes.length,
      degree: degreeSummary.summary,
      closeness: closenessSummary.summary,
      betweenness: betweennessSummary.summary,
    },

    histograms: {
      degree: degreeSummary.histogram,
      closeness: closenessSummary.histogram,
      betweenness: betweennessSummary.histogram,
    },

    concentration: {
      degree: degreeSummary.concentration,
      closeness: closenessSummary.concentration,
      betweenness: betweennessSummary.concentration,
    },

    interpretation: buildCentralityDistributionInterpretation({
      degree: degreeSummary.summary,
      closeness: closenessSummary.summary,
      betweenness: betweennessSummary.summary,
      degreeConcentration: degreeSummary.concentration,
      closenessConcentration: closenessSummary.concentration,
      betweennessConcentration: betweennessSummary.concentration,
    }),
  };

  return result;
}

/**
 * Format result for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatCentralityDistributionForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Centrality Distribution',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, concentration, interpretation } = result;

  const metrics = [
    {
      label: 'Degree Mean',
      value: formatNumber(summary.degree.mean, 4),
    },
    {
      label: 'Degree Max',
      value: formatNumber(summary.degree.max, 4),
    },
    {
      label: 'Closeness Mean',
      value: formatNumber(summary.closeness.mean, 4),
    },
    {
      label: 'Betweenness Mean',
      value: formatNumber(summary.betweenness.mean, 4),
    },
    {
      label: 'Top Degree Share',
      value: formatPercent(concentration.degree.topKShare),
    },
    {
      label: 'Top Betweenness Share',
      value: formatPercent(concentration.betweenness.topKShare),
    },
  ];

  const sections = [
    {
      title: 'Distribution Summary',
      items: [
        {
          label: 'Degree Median',
          value: formatNumber(summary.degree.median, 4),
        },
        {
          label: 'Closeness Median',
          value: formatNumber(summary.closeness.median, 4),
        },
        {
          label: 'Betweenness Median',
          value: formatNumber(summary.betweenness.median, 4),
        },
      ],
    },
    {
      title: 'Top Concentration',
      items: [
        {
          label: `Top ${concentration.degree.topK} Degree Nodes`,
          value: formatPercent(concentration.degree.topKShare),
        },
        {
          label: `Top ${concentration.closeness.topK} Closeness Nodes`,
          value: formatPercent(concentration.closeness.topKShare),
        },
        {
          label: `Top ${concentration.betweenness.topK} Betweenness Nodes`,
          value: formatPercent(concentration.betweenness.topKShare),
        },
      ],
    },
  ];

  return {
    title: 'Centrality Distribution',
    metrics,
    interpretation,
    sections,
  };
}

/**
 * Convenience wrapper: compute + format
 *
 * @param {Object} centralityResult
 * @param {Object} [options]
 * @returns {Object}
 */
export function runCentralityDistribution(centralityResult = {}, options = {}) {
  const raw = computeCentralityDistribution(centralityResult, options);
  const display = formatCentralityDistributionForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildCentralityDistributionInterpretation({
  degree,
  closeness,
  betweenness,
  degreeConcentration,
  closenessConcentration,
  betweennessConcentration,
} = {}) {
  const lines = [];

  if (!degree || degree.count === 0) {
    return ['No centrality values are available, so distribution analysis cannot be performed yet.'];
  }

  lines.push(
    `Degree centrality ranges from ${formatNumber(degree.min, 4)} to ${formatNumber(degree.max, 4)}.`
  );

  if (degree.max > degree.mean * 2 && degree.mean > 0) {
    lines.push(
      'Degree centrality is unevenly distributed, which suggests that only a few nodes act as strong local hubs.'
    );
  } else {
    lines.push(
      'Degree centrality is not extremely concentrated, so local connectivity is relatively more evenly distributed.'
    );
  }

  if (betweenness.max > betweenness.mean * 4 && betweenness.mean > 0) {
    lines.push(
      'Betweenness centrality is highly concentrated, suggesting that a small number of nodes may control many shortest paths.'
    );
  } else {
    lines.push(
      'Betweenness centrality is not overwhelmingly concentrated in only a few nodes.'
    );
  }

  if (degreeConcentration?.topKShare >= 0.4) {
    lines.push(
      `The top ${degreeConcentration.topK} nodes account for ${formatPercent(degreeConcentration.topKShare)} of all degree centrality, reinforcing a hub-dominant structure.`
    );
  }

  if (betweennessConcentration?.topKShare >= 0.5) {
    lines.push(
      `The top ${betweennessConcentration.topK} nodes account for ${formatPercent(betweennessConcentration.topKShare)} of all betweenness centrality, indicating strong brokerage concentration.`
    );
  }

  if (closeness.max - closeness.min < 0.1) {
    lines.push(
      'Closeness centrality is relatively narrow in range, so many nodes occupy somewhat similar global positions.'
    );
  } else {
    lines.push(
      'Closeness centrality spans a wider range, so some nodes are structurally much closer to the whole network than others.'
    );
  }

  return lines;
}

/* =========================
   Core calculations
   ========================= */

function summarizeDistribution(values, binCount, topK) {
  const sorted = [...values].sort((a, b) => a - b);

  const summary = {
    count: sorted.length,
    min: sorted.length ? sorted[0] : 0,
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    mean: mean(sorted),
    median: median(sorted),
    variance: variance(sorted),
    std: std(sorted),
  };

  const histogram = buildHistogram(sorted, binCount);
  const concentration = computeTopKConcentration(sorted, topK);

  return {
    summary,
    histogram,
    concentration,
  };
}

function buildHistogram(values, binCount) {
  if (!values.length) {
    return [];
  }

  const min = values[0];
  const max = values[values.length - 1];

  if (min === max) {
    return [
      {
        binStart: min,
        binEnd: max,
        count: values.length,
      },
    ];
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    binStart: min + index * width,
    binEnd: index === binCount - 1 ? max : min + (index + 1) * width,
    count: 0,
  }));

  values.forEach((value) => {
    let binIndex = Math.floor((value - min) / width);

    if (binIndex >= binCount) {
      binIndex = binCount - 1;
    }

    bins[binIndex].count += 1;
  });

  return bins;
}

function computeTopKConcentration(values, topK) {
  if (!values.length) {
    return {
      topK,
      total: 0,
      topKSum: 0,
      topKShare: 0,
    };
  }

  const sortedDesc = [...values].sort((a, b) => b - a);
  const actualTop = Math.min(topK, sortedDesc.length);
  const topKSum = sortedDesc.slice(0, actualTop).reduce((sum, value) => sum + value, 0);
  const total = sortedDesc.reduce((sum, value) => sum + value, 0);

  return {
    topK: actualTop,
    total,
    topKSum,
    topKShare: total > 0 ? topKSum / total : 0,
  };
}

/* =========================
   Numeric helpers
   ========================= */

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (values[middle - 1] + values[middle]) / 2;
  }

  return values[middle];
}

function variance(values) {
  if (!values.length) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function std(values) {
  return Math.sqrt(variance(values));
}

function formatNumber(value, digits = 4) {
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