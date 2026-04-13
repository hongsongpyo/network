// src/metrics/assortativity.js

/**
 * Assortativity analysis
 *
 * Included:
 * - degree assortativity coefficient (Pearson correlation on edge-end degrees)
 * - node-level average neighbor degree k_nn(i)
 * - degree-binned average neighbor degree k_nn(k)
 *
 * Notes:
 * - For directed graphs, this version uses total degree by default.
 * - Self-loops are ignored in assortativity correlation.
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute assortativity-related metrics.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @returns {Object}
 */
export function computeAssortativity(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(nodes.map((node) => [node.id, node.label ?? node.id]));

  const degreeData = computeDegrees(nodeIds, edges, directed);
  const adjacencyUndirected = buildUndirectedAdjacency(nodeIds, edges);

  const assortativityCoefficient = computeDegreeAssortativityCoefficient(
    edges,
    degreeData.total,
    directed
  );

  const averageNeighborDegreeByNode = computeAverageNeighborDegreeByNode(
    nodeIds,
    adjacencyUndirected,
    degreeData.total
  );

  const averageNeighborDegreeByDegree = computeAverageNeighborDegreeByDegree(
    nodeIds,
    degreeData.total,
    averageNeighborDegreeByNode
  );

  const nodeMetrics = nodeIds.map((nodeId) => ({
    id: nodeId,
    label: nodeLabelMap.get(nodeId) ?? nodeId,
    degree: degreeData.total[nodeId] ?? 0,
    inDegree: directed ? degreeData.in[nodeId] ?? 0 : null,
    outDegree: directed ? degreeData.out[nodeId] ?? 0 : null,
    averageNeighborDegree: averageNeighborDegreeByNode[nodeId] ?? null,
  }));

  const rankingByNeighborDegree = createRanking(
    nodeMetrics.filter((item) => typeof item.averageNeighborDegree === 'number'),
    'averageNeighborDegree',
    10
  );

  const result = {
    summary: {
      directed,
      nodeCount: nodeIds.length,
      edgeCount: edges.length,
      assortativityCoefficient,
      assortativityType: classifyAssortativity(assortativityCoefficient),
    },

    nodes: nodeMetrics,

    maps: {
      degree: degreeData.total,
      inDegree: directed ? degreeData.in : {},
      outDegree: directed ? degreeData.out : {},
      averageNeighborDegreeByNode,
    },

    curves: {
      knnByDegree: averageNeighborDegreeByDegree,
    },

    rankings: {
      topAverageNeighborDegreeNodes: rankingByNeighborDegree,
    },

    interpretation: buildAssortativityInterpretation({
      directed,
      assortativityCoefficient,
      assortativityType: classifyAssortativity(assortativityCoefficient),
    }),
  };

  return result;
}

/**
 * Format assortativity results for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatAssortativityForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Assortativity',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, curves, rankings, interpretation } = result;

  const metrics = [
    {
      label: 'Degree Assortativity',
      value: formatNumber(summary.assortativityCoefficient, 4),
    },
    {
      label: 'Type',
      value: summary.assortativityType,
    },
  ];

  const knnItems = Object.entries(curves.knnByDegree || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(0, 10)
    .map(([degree, value]) => ({
      label: `k = ${degree}`,
      value: formatNumber(value, 4),
    }));

  const sections = [
    {
      title: 'k_nn(k)',
      items: knnItems,
    },
    {
      title: 'Top Avg Neighbor Degree Nodes',
      items: (rankings.topAverageNeighborDegreeNodes || []).map((item) => ({
        label: item.label,
        value: formatNumber(item.value, 4),
      })),
    },
  ];

  return {
    title: 'Assortativity',
    metrics,
    interpretation,
    sections,
  };
}

/**
 * Convenience wrapper: compute + format
 *
 * @param {Object} graphData
 * @returns {Object}
 */
export function runAssortativity(graphData = {}) {
  const raw = computeAssortativity(graphData);
  const display = formatAssortativityForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildAssortativityInterpretation({
  directed = false,
  assortativityCoefficient = 0,
  assortativityType = 'neutral',
} = {}) {
  const lines = [];

  lines.push(
    `The degree assortativity coefficient is ${formatNumber(assortativityCoefficient, 4)}.`
  );

  if (assortativityType === 'assortative') {
    lines.push(
      'This means high-degree nodes tend to connect to other high-degree nodes, while low-degree nodes tend to connect to low-degree nodes.'
    );
    lines.push(
      'Such a pattern is consistent with assortative or core-like structure.'
    );
  } else if (assortativityType === 'disassortative') {
    lines.push(
      'This means high-degree nodes tend to connect to low-degree nodes rather than to each other.'
    );
    lines.push(
      'Such a pattern is consistent with hub-and-spoke or disassortative structure.'
    );
  } else {
    lines.push(
      'This suggests no strong degree-based preference in how nodes connect to one another.'
    );
  }

  if (directed) {
    lines.push(
      'For directed graphs, this implementation uses total degree as the default comparison basis.'
    );
  }

  lines.push(
    'The k_nn(k) curve can be used as a supporting view: increasing trend suggests assortativity, decreasing trend suggests disassortativity.'
  );

  return lines;
}

/* =========================
   Degree calculations
   ========================= */

function computeDegrees(nodeIds, edges, directed) {
  const total = createZeroObject(nodeIds);
  const indeg = createZeroObject(nodeIds);
  const outdeg = createZeroObject(nodeIds);

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (!(source in total)) total[source] = 0;
    if (!(target in total)) total[target] = 0;
    if (!(source in indeg)) indeg[source] = 0;
    if (!(target in indeg)) indeg[target] = 0;
    if (!(source in outdeg)) outdeg[source] = 0;
    if (!(target in outdeg)) outdeg[target] = 0;

    if (directed) {
      outdeg[source] += 1;
      indeg[target] += 1;
      total[source] += 1;
      total[target] += 1;
    } else {
      total[source] += 1;
      total[target] += 1;
    }
  });

  return {
    total,
    in: indeg,
    out: outdeg,
  };
}

/* =========================
   Assortativity coefficient
   ========================= */

/**
 * Pearson correlation of degree values across edge endpoints.
 *
 * For undirected graphs:
 * - each edge contributes one pair (k_u, k_v)
 *
 * For directed graphs in this simplified version:
 * - each directed edge contributes one pair using total degree
 */
function computeDegreeAssortativityCoefficient(edges, degreeMap, directed) {
  const x = [];
  const y = [];

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (source === target) {
      return;
    }

    const ks = degreeMap[source] ?? 0;
    const kt = degreeMap[target] ?? 0;

    x.push(ks);
    y.push(kt);

    /**
     * For undirected graphs, symmetrize so correlation is direction-free.
     */
    if (!directed) {
      x.push(kt);
      y.push(ks);
    }
  });

  return pearsonCorrelation(x, y);
}

/* =========================
   Average neighbor degree
   ========================= */

function buildUndirectedAdjacency(nodeIds, edges) {
  const adjacency = new Map();

  nodeIds.forEach((id) => {
    adjacency.set(id, new Set());
  });

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (!adjacency.has(source)) adjacency.set(source, new Set());
    if (!adjacency.has(target)) adjacency.set(target, new Set());

    if (source === target) return;

    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  });

  return adjacency;
}

/**
 * k_nn(i) = average degree of neighbors of node i
 */
function computeAverageNeighborDegreeByNode(nodeIds, adjacency, degreeMap) {
  const result = {};

  nodeIds.forEach((nodeId) => {
    const neighbors = Array.from(adjacency.get(nodeId) ?? []);
    const degree = neighbors.length;

    if (degree === 0) {
      result[nodeId] = null;
      return;
    }

    const sumNeighborDegrees = neighbors.reduce(
      (sum, neighborId) => sum + (degreeMap[neighborId] ?? 0),
      0
    );

    result[nodeId] = sumNeighborDegrees / degree;
  });

  return result;
}

/**
 * k_nn(k) = average of k_nn(i) over nodes whose degree is k
 */
function computeAverageNeighborDegreeByDegree(nodeIds, degreeMap, knnByNode) {
  const grouped = {};

  nodeIds.forEach((nodeId) => {
    const degree = degreeMap[nodeId] ?? 0;
    const knn = knnByNode[nodeId];

    if (knn === null || knn === undefined || Number.isNaN(knn)) {
      return;
    }

    if (!grouped[degree]) {
      grouped[degree] = [];
    }

    grouped[degree].push(knn);
  });

  const result = {};

  Object.entries(grouped).forEach(([degree, values]) => {
    result[degree] = average(values);
  });

  return result;
}

/* =========================
   Helpers
   ========================= */

function classifyAssortativity(r) {
  if (r > 0.05) return 'assortative';
  if (r < -0.05) return 'disassortative';
  return 'neutral';
}

function pearsonCorrelation(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length === 0) {
    return 0;
  }

  const meanX = average(x);
  const meanY = average(y);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;

    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function createRanking(items, valueKey, limit = 10) {
  return [...items]
    .map((item) => ({
      id: item.id,
      label: item.label ?? item.id,
      value: item[valueKey] ?? 0,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function createZeroObject(keys) {
  const obj = {};
  keys.forEach((key) => {
    obj[key] = 0;
  });
  return obj;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return Number(value).toFixed(digits);
}