// src/metrics/basicStats.js

/**
 * Basic graph statistics for the current dataset / graph.
 *
 * Supported:
 * - node count
 * - edge count
 * - density
 * - average degree
 * - average in/out degree (directed)
 * - average strength (weighted)
 * - min/max degree
 * - singleton count
 * - self-loop count
 * - simple interpretation text
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute basic statistics from dataset-like graph data.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @param {boolean} [graphData.weighted=false]
 * @returns {Object}
 */
export function computeBasicStats(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);
  const weighted = Boolean(graphData.weighted);

  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  const degreeMap = createEmptyValueMap(nodes, 0);
  const inDegreeMap = createEmptyValueMap(nodes, 0);
  const outDegreeMap = createEmptyValueMap(nodes, 0);
  const strengthMap = createEmptyValueMap(nodes, 0);

  let selfLoopCount = 0;

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;
    const weight = toValidWeight(edge.weight);

    if (source === target) {
      selfLoopCount += 1;
    }

    if (directed) {
      if (outDegreeMap.has(source)) {
        outDegreeMap.set(source, outDegreeMap.get(source) + 1);
      }
      if (inDegreeMap.has(target)) {
        inDegreeMap.set(target, inDegreeMap.get(target) + 1);
      }

      if (degreeMap.has(source)) {
        degreeMap.set(source, degreeMap.get(source) + 1);
      }
      if (degreeMap.has(target)) {
        degreeMap.set(target, degreeMap.get(target) + 1);
      }

      if (strengthMap.has(source)) {
        strengthMap.set(source, strengthMap.get(source) + weight);
      }
      if (strengthMap.has(target)) {
        strengthMap.set(target, strengthMap.get(target) + weight);
      }
    } else {
      if (degreeMap.has(source)) {
        degreeMap.set(source, degreeMap.get(source) + 1);
      }
      if (degreeMap.has(target)) {
        degreeMap.set(target, degreeMap.get(target) + 1);
      }

      if (strengthMap.has(source)) {
        strengthMap.set(source, strengthMap.get(source) + weight);
      }
      if (strengthMap.has(target)) {
        strengthMap.set(target, strengthMap.get(target) + weight);
      }
    }
  });

  const degreeValues = Array.from(degreeMap.values());
  const inDegreeValues = Array.from(inDegreeMap.values());
  const outDegreeValues = Array.from(outDegreeMap.values());
  const strengthValues = Array.from(strengthMap.values());

  const density = computeDensity(nodeCount, edgeCount, directed);
  const averageDegree = average(degreeValues);
  const averageInDegree = directed ? average(inDegreeValues) : null;
  const averageOutDegree = directed ? average(outDegreeValues) : null;
  const averageStrength = weighted ? average(strengthValues) : null;

  const maxDegree = maxValue(degreeValues);
  const minDegree = minValue(degreeValues);
  const singletonCount = degreeValues.filter((degree) => degree === 0).length;

  const degreeRanking = createRanking(nodes, degreeMap, 10);
  const strengthRanking = weighted ? createRanking(nodes, strengthMap, 10) : [];

  const result = {
    summary: {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      averageInDegree,
      averageOutDegree,
      averageStrength,
      minDegree,
      maxDegree,
      singletonCount,
      selfLoopCount,
      directed,
      weighted,
    },

    distributions: {
      degree: degreeValues,
      inDegree: directed ? inDegreeValues : [],
      outDegree: directed ? outDegreeValues : [],
      strength: weighted ? strengthValues : [],
    },

    maps: {
      degree: mapToObject(degreeMap),
      inDegree: directed ? mapToObject(inDegreeMap) : {},
      outDegree: directed ? mapToObject(outDegreeMap) : {},
      strength: weighted ? mapToObject(strengthMap) : {},
    },

    rankings: {
      topDegreeNodes: degreeRanking,
      topStrengthNodes: strengthRanking,
    },

    interpretation: buildBasicStatsInterpretation({
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      averageInDegree,
      averageOutDegree,
      averageStrength,
      singletonCount,
      selfLoopCount,
      directed,
      weighted,
    }),
  };

  return result;
}

/**
 * Build result cards / display-friendly data for UI rendering.
 *
 * @param {Object} statsResult
 * @returns {Object}
 */
export function formatBasicStatsForDisplay(statsResult) {
  if (!statsResult || !statsResult.summary) {
    return {
      title: 'Basic Stats',
      metrics: [],
      interpretation: [],
      rankings: [],
    };
  }

  const { summary, rankings, interpretation } = statsResult;

  const metrics = [
    { label: 'Nodes', value: formatInteger(summary.nodeCount) },
    { label: 'Edges', value: formatInteger(summary.edgeCount) },
    { label: 'Density', value: formatNumber(summary.density, 4) },
    { label: 'Avg Degree', value: formatNumber(summary.averageDegree, 3) },
    { label: 'Min Degree', value: formatInteger(summary.minDegree) },
    { label: 'Max Degree', value: formatInteger(summary.maxDegree) },
    { label: 'Singletons', value: formatInteger(summary.singletonCount) },
    { label: 'Self-loops', value: formatInteger(summary.selfLoopCount) },
  ];

  if (summary.directed) {
    metrics.push(
      { label: 'Avg In-degree', value: formatNumber(summary.averageInDegree, 3) },
      { label: 'Avg Out-degree', value: formatNumber(summary.averageOutDegree, 3) }
    );
  }

  if (summary.weighted) {
    metrics.push({
      label: 'Avg Strength',
      value: formatNumber(summary.averageStrength, 3),
    });
  }

  const rankingSections = [
    {
      title: 'Top Degree Nodes',
      items: (rankings.topDegreeNodes || []).map((item) => ({
        label: item.label,
        value: formatNumber(item.value, 3),
      })),
    },
  ];

  if ((rankings.topStrengthNodes || []).length > 0) {
    rankingSections.push({
      title: 'Top Strength Nodes',
      items: rankings.topStrengthNodes.map((item) => ({
        label: item.label,
        value: formatNumber(item.value, 3),
      })),
    });
  }

  return {
    title: 'Basic Stats',
    metrics,
    interpretation,
    rankings: rankingSections,
  };
}

/**
 * Convenience wrapper:
 * compute + format in one call.
 *
 * @param {Object} graphData
 * @returns {Object}
 */
export function runBasicStats(graphData = {}) {
  const raw = computeBasicStats(graphData);
  const display = formatBasicStatsForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildBasicStatsInterpretation(summary = {}) {
  const lines = [];

  if (summary.nodeCount === 0) {
    return ['The graph is empty, so no structural interpretation is available yet.'];
  }

  lines.push(
    `This graph has ${formatInteger(summary.nodeCount)} nodes and ${formatInteger(summary.edgeCount)} edges.`
  );

  if (summary.density < 0.05) {
    lines.push(
      'The density is low, so the network is sparse rather than densely connected.'
    );
  } else if (summary.density < 0.2) {
    lines.push(
      'The density is moderate, suggesting some connectivity but not a near-complete structure.'
    );
  } else {
    lines.push(
      'The density is relatively high, so many possible node pairs are directly connected.'
    );
  }

  if (summary.singletonCount > 0) {
    lines.push(
      `There are ${formatInteger(summary.singletonCount)} singleton nodes, meaning some nodes are completely isolated.`
    );
  } else {
    lines.push('There are no singleton nodes, so every node participates in at least one link.');
  }

  if (summary.maxDegree >= summary.averageDegree * 2 && summary.averageDegree > 0) {
    lines.push(
      'The maximum degree is much larger than the average degree, which may indicate hub-like nodes.'
    );
  }

  if (summary.directed) {
    lines.push(
      'Because the graph is directed, in-degree and out-degree should be interpreted separately.'
    );
  }

  if (summary.weighted) {
    lines.push(
      'Because the graph is weighted, strength-based analysis can provide more detail than degree alone.'
    );
  }

  if (summary.selfLoopCount > 0) {
    lines.push(
      `The graph includes ${formatInteger(summary.selfLoopCount)} self-loop(s), which may affect interpretation depending on the dataset meaning.`
    );
  }

  return lines;
}

/* =========================
   Helpers
   ========================= */

function createEmptyValueMap(nodes, initialValue = 0) {
  const map = new Map();

  nodes.forEach((node) => {
    map.set(node.id, initialValue);
  });

  return map;
}

function computeDensity(nodeCount, edgeCount, directed) {
  if (nodeCount <= 1) return 0;

  if (directed) {
    return edgeCount / (nodeCount * (nodeCount - 1));
  }

  return (2 * edgeCount) / (nodeCount * (nodeCount - 1));
}

function createRanking(nodes, valueMap, limit = 10) {
  const nodeLabelMap = new Map(
    nodes.map((node) => [node.id, node.label ?? node.id])
  );

  return Array.from(valueMap.entries())
    .map(([id, value]) => ({
      id,
      label: nodeLabelMap.get(id) ?? id,
      value,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function average(values) {
  if (!values.length) return 0;
  return sum(values) / values.length;
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function maxValue(values) {
  if (!values.length) return 0;
  return Math.max(...values);
}

function minValue(values) {
  if (!values.length) return 0;
  return Math.min(...values);
}

function mapToObject(map) {
  return Object.fromEntries(map.entries());
}

function toValidWeight(weight) {
  const parsed = Number(weight);
  return Number.isFinite(parsed) ? parsed : 1;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return Number(value).toFixed(digits);
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return String(Math.round(Number(value)));
}