// src/metrics/clustering.js

/**
 * Clustering coefficient / triangle analysis
 *
 * Focus:
 * - local clustering coefficient C_i
 * - average clustering coefficient
 * - node-level triangle counts
 * - global triangle summary
 *
 * Note:
 * This implementation uses the standard undirected definition.
 * For directed graphs, we analyze the underlying undirected structure
 * unless a more specialized directed version is added later.
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute clustering-related metrics.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @returns {Object}
 */
export function computeClustering(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(nodes.map((node) => [node.id, node.label ?? node.id]));

  const adjacency = buildUndirectedAdjacency(nodeIds, edges);

  const nodeMetrics = nodeIds.map((nodeId) => {
    const neighbors = Array.from(adjacency.get(nodeId) ?? []);
    const degree = neighbors.length;

    if (degree < 2) {
      return {
        id: nodeId,
        label: nodeLabelMap.get(nodeId) ?? nodeId,
        degree,
        triangleCount: 0,
        possibleTriangleCount: 0,
        clusteringCoefficient: null,
      };
    }

    const actualLinksAmongNeighbors = countLinksAmongNeighbors(neighbors, adjacency);
    const possibleLinksAmongNeighbors = (degree * (degree - 1)) / 2;
    const clusteringCoefficient =
      possibleLinksAmongNeighbors > 0
        ? actualLinksAmongNeighbors / possibleLinksAmongNeighbors
        : null;

    /**
     * Number of triangles incident to node i:
     * each triangle involving node i contributes exactly one connected neighbor-pair.
     */
    const triangleCount = actualLinksAmongNeighbors;

    return {
      id: nodeId,
      label: nodeLabelMap.get(nodeId) ?? nodeId,
      degree,
      triangleCount,
      possibleTriangleCount: possibleLinksAmongNeighbors,
      clusteringCoefficient,
    };
  });

  const definedCoefficients = nodeMetrics
    .map((item) => item.clusteringCoefficient)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  const averageClusteringCoefficient =
    definedCoefficients.length > 0 ? average(definedCoefficients) : 0;

  const totalNodeTriangleIncidents = nodeMetrics.reduce(
    (sum, item) => sum + item.triangleCount,
    0
  );

  /**
   * In an undirected graph, each triangle is counted at 3 nodes.
   */
  const totalTriangles = totalNodeTriangleIncidents / 3;

  const fullyClusteredNodeCount = nodeMetrics.filter(
    (item) => item.clusteringCoefficient === 1
  ).length;

  const zeroClusteredDefinedNodeCount = nodeMetrics.filter(
    (item) => item.clusteringCoefficient === 0
  ).length;

  const highClusteringNodes = createRanking(
    nodeMetrics.filter((item) => item.clusteringCoefficient !== null),
    'clusteringCoefficient',
    10
  );

  const highTriangleNodes = createRanking(nodeMetrics, 'triangleCount', 10);

  const result = {
    summary: {
      directed,
      analyzedAsUndirected: directed,
      nodeCount: nodeIds.length,
      edgeCount: edges.length,
      averageClusteringCoefficient,
      totalTriangles,
      definedNodeCount: definedCoefficients.length,
      undefinedNodeCount: nodeMetrics.length - definedCoefficients.length,
      fullyClusteredNodeCount,
      zeroClusteredDefinedNodeCount,
    },

    nodes: nodeMetrics,

    maps: {
      clusteringCoefficient: Object.fromEntries(
        nodeMetrics.map((item) => [item.id, item.clusteringCoefficient])
      ),
      triangleCount: Object.fromEntries(
        nodeMetrics.map((item) => [item.id, item.triangleCount])
      ),
    },

    rankings: {
      topClusteringNodes: highClusteringNodes,
      topTriangleNodes: highTriangleNodes,
    },

    interpretation: buildClusteringInterpretation({
      directed,
      averageClusteringCoefficient,
      totalTriangles,
      definedNodeCount: definedCoefficients.length,
      undefinedNodeCount: nodeMetrics.length - definedCoefficients.length,
      fullyClusteredNodeCount,
      zeroClusteredDefinedNodeCount,
    }),
  };

  return result;
}

/**
 * Format clustering result for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatClusteringForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Clustering',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, rankings, interpretation } = result;

  const metrics = [
    {
      label: 'Avg Clustering',
      value: formatNumber(summary.averageClusteringCoefficient, 4),
    },
    {
      label: 'Total Triangles',
      value: formatInteger(summary.totalTriangles),
    },
    {
      label: 'Defined Nodes',
      value: formatInteger(summary.definedNodeCount),
    },
    {
      label: 'Undefined Nodes',
      value: formatInteger(summary.undefinedNodeCount),
    },
    {
      label: 'C = 1 Nodes',
      value: formatInteger(summary.fullyClusteredNodeCount),
    },
    {
      label: 'C = 0 Nodes',
      value: formatInteger(summary.zeroClusteredDefinedNodeCount),
    },
  ];

  const sections = [
    {
      title: 'Top Clustering Nodes',
      items: (rankings.topClusteringNodes || []).map((item) => ({
        label: item.label,
        value: formatNumber(item.value, 4),
      })),
    },
    {
      title: 'Top Triangle Nodes',
      items: (rankings.topTriangleNodes || []).map((item) => ({
        label: item.label,
        value: formatInteger(item.value),
      })),
    },
  ];

  return {
    title: 'Clustering',
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
export function runClustering(graphData = {}) {
  const raw = computeClustering(graphData);
  const display = formatClusteringForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildClusteringInterpretation({
  directed = false,
  averageClusteringCoefficient = 0,
  totalTriangles = 0,
  definedNodeCount = 0,
  undefinedNodeCount = 0,
  fullyClusteredNodeCount = 0,
  zeroClusteredDefinedNodeCount = 0,
} = {}) {
  const lines = [];

  if (definedNodeCount === 0) {
    return [
      'No node has at least two neighbors, so the standard local clustering coefficient is not defined anywhere in this graph.',
    ];
  }

  if (directed) {
    lines.push(
      'This result uses the undirected neighborhood structure, because the standard local clustering coefficient is most directly defined for undirected graphs.'
    );
  }

  lines.push(
    `The average clustering coefficient is ${formatNumber(averageClusteringCoefficient, 4)}.`
  );

  if (averageClusteringCoefficient >= 0.5) {
    lines.push(
      'This suggests strong local cohesion: neighbors of a node often connect to each other and form tight groups.'
    );
  } else if (averageClusteringCoefficient >= 0.2) {
    lines.push(
      'This suggests a moderate level of local cohesion, with some triangle-rich regions but not uniformly dense neighborhoods.'
    );
  } else {
    lines.push(
      'This suggests weak local cohesion: many neighbors are not directly linked to each other.'
    );
  }

  lines.push(
    `The graph contains ${formatInteger(totalTriangles)} triangle(s), which capture "friend-of-a-friend" closure patterns.`
  );

  if (fullyClusteredNodeCount > 0) {
    lines.push(
      `${formatInteger(fullyClusteredNodeCount)} node(s) have clustering coefficient 1, meaning all of their neighbors are mutually connected.`
    );
  }

  if (zeroClusteredDefinedNodeCount > 0) {
    lines.push(
      `${formatInteger(zeroClusteredDefinedNodeCount)} node(s) with at least two neighbors have clustering coefficient 0, so they connect otherwise unconnected neighbors.`
    );
  }

  if (undefinedNodeCount > 0) {
    lines.push(
      `${formatInteger(undefinedNodeCount)} node(s) have degree less than 2, so their local clustering coefficient is not defined.`
    );
  }

  return lines;
}

/* =========================
   Core calculations
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

    /**
     * Self-loops are ignored for local clustering here.
     */
    if (source === target) return;

    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  });

  return adjacency;
}

/**
 * Count how many pairs of neighbors are themselves connected.
 * For a node i, this equals the number of triangles containing i.
 */
function countLinksAmongNeighbors(neighbors, adjacency) {
  let count = 0;

  for (let i = 0; i < neighbors.length; i += 1) {
    for (let j = i + 1; j < neighbors.length; j += 1) {
      const a = neighbors[i];
      const b = neighbors[j];

      if ((adjacency.get(a) ?? new Set()).has(b)) {
        count += 1;
      }
    }
  }

  return count;
}

/* =========================
   Helpers
   ========================= */

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

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return String(Math.round(Number(value)));
}