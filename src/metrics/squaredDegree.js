// src/metrics/squaredDegree.js

/**
 * Squared degree / heterogeneity analysis
 *
 * Included:
 * - average degree <k>
 * - average squared degree <k^2>
 * - variance
 * - heterogeneity indicators
 *
 * Purpose:
 * - Detect hub dominance
 * - Understand spread of degree distribution
 */

/* =========================
   Public API
   ========================= */

export function computeSquaredDegree(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((n) => n.id);

  const degreeMap = computeDegrees(nodeIds, edges, directed);

  const degreeValues = nodeIds.map((id) => degreeMap[id] ?? 0);

  const avgDegree = mean(degreeValues);
  const avgSquaredDegree = mean(degreeValues.map((k) => k * k));

  const variance = avgSquaredDegree - avgDegree * avgDegree;
  const std = Math.sqrt(Math.max(variance, 0));

  const maxDegree = Math.max(...degreeValues, 0);
  const minDegree = Math.min(...degreeValues, 0);

  const heterogeneityIndex =
    avgDegree > 0 ? avgSquaredDegree / avgDegree : 0;

  const result = {
    summary: {
      nodeCount: nodeIds.length,
      avgDegree,
      avgSquaredDegree,
      variance,
      std,
      minDegree,
      maxDegree,
      heterogeneityIndex,
    },

    maps: {
      degree: degreeMap,
      squaredDegree: Object.fromEntries(
        nodeIds.map((id) => [id, (degreeMap[id] ?? 0) ** 2])
      ),
    },

    interpretation: buildSquaredDegreeInterpretation({
      avgDegree,
      avgSquaredDegree,
      variance,
      std,
      heterogeneityIndex,
      maxDegree,
    }),
  };

  return result;
}

/**
 * UI display formatter
 */
export function formatSquaredDegreeForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Squared Degree',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, interpretation } = result;

  const metrics = [
    {
      label: 'Avg Degree ⟨k⟩',
      value: formatNumber(summary.avgDegree, 3),
    },
    {
      label: 'Avg k² ⟨k²⟩',
      value: formatNumber(summary.avgSquaredDegree, 3),
    },
    {
      label: 'Variance',
      value: formatNumber(summary.variance, 3),
    },
    {
      label: 'Std Dev',
      value: formatNumber(summary.std, 3),
    },
    {
      label: 'Max Degree',
      value: formatNumber(summary.maxDegree, 0),
    },
    {
      label: 'Heterogeneity Index',
      value: formatNumber(summary.heterogeneityIndex, 3),
    },
  ];

  return {
    title: 'Squared Degree',
    metrics,
    interpretation,
    sections: [],
  };
}

/**
 * Wrapper
 */
export function runSquaredDegree(graphData = {}) {
  const raw = computeSquaredDegree(graphData);
  const display = formatSquaredDegreeForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildSquaredDegreeInterpretation({
  avgDegree,
  avgSquaredDegree,
  variance,
  std,
  heterogeneityIndex,
  maxDegree,
} = {}) {
  const lines = [];

  lines.push(
    `The average degree ⟨k⟩ is ${formatNumber(avgDegree, 3)}, and ⟨k²⟩ is ${formatNumber(avgSquaredDegree, 3)}.`
  );

  if (variance > avgDegree) {
    lines.push(
      'The variance is relatively large compared to the mean, suggesting a heterogeneous degree distribution.'
    );
  } else {
    lines.push(
      'The variance is relatively small, suggesting a more homogeneous network structure.'
    );
  }

  if (heterogeneityIndex > 3) {
    lines.push(
      'The heterogeneity index is high, indicating strong hub dominance in the network.'
    );
  } else if (heterogeneityIndex > 1.5) {
    lines.push(
      'There is moderate heterogeneity, with some nodes having higher connectivity than average.'
    );
  } else {
    lines.push(
      'The network is relatively uniform in degree distribution.'
    );
  }

  if (maxDegree > avgDegree * 3 && avgDegree > 0) {
    lines.push(
      'The maximum degree is much larger than the average, reinforcing the presence of hub nodes.'
    );
  }

  return lines;
}

/* =========================
   Degree calculation
   ========================= */

function computeDegrees(nodeIds, edges, directed) {
  const degree = createZeroObject(nodeIds);

  edges.forEach((edge) => {
    const s = edge.source;
    const t = edge.target;

    if (directed) {
      if (s in degree) degree[s] += 1;
      if (t in degree) degree[t] += 1;
    } else {
      if (s in degree) degree[s] += 1;
      if (t in degree) degree[t] += 1;
    }
  });

  return degree;
}

/* =========================
   Math helpers
   ========================= */

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function createZeroObject(keys) {
  const obj = {};
  keys.forEach((k) => {
    obj[k] = 0;
  });
  return obj;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return Number(value).toFixed(digits);
}