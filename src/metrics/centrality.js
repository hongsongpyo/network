// src/metrics/centrality.js

/**
 * Centrality analysis
 *
 * Included:
 * - degree centrality
 * - closeness centrality
 * - betweenness centrality
 *
 * Notes:
 * - Current implementation uses unweighted shortest paths.
 * - Degree centrality supports directed graphs using total degree,
 *   and also returns indegree / outdegree centrality separately.
 * - Closeness is computed from reachable shortest-path distances.
 * - Betweenness uses Brandes algorithm (unweighted).
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute centrality metrics.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @returns {Object}
 */
export function computeCentrality(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(
    nodes.map((node) => [node.id, node.label ?? node.id])
  );

  const adjacency = buildAdjacency(nodeIds, edges, directed);

  const degreeCentrality = computeDegreeCentrality(nodeIds, edges, directed);
  const closenessCentrality = computeClosenessCentrality(nodeIds, adjacency);
  const betweennessCentrality = computeBetweennessCentrality(
    nodeIds,
    adjacency,
    directed
  );

  const nodeMetrics = nodeIds.map((nodeId) => {
    return {
      id: nodeId,
      label: nodeLabelMap.get(nodeId) ?? nodeId,
      degreeCentrality: degreeCentrality.total[nodeId] ?? 0,
      inDegreeCentrality: degreeCentrality.in[nodeId] ?? null,
      outDegreeCentrality: degreeCentrality.out[nodeId] ?? null,
      closenessCentrality: closenessCentrality[nodeId] ?? 0,
      betweennessCentrality: betweennessCentrality[nodeId] ?? 0,
    };
  });

  const topDegreeNodes = createRanking(nodeMetrics, 'degreeCentrality', 10);
  const topClosenessNodes = createRanking(nodeMetrics, 'closenessCentrality', 10);
  const topBetweennessNodes = createRanking(
    nodeMetrics,
    'betweennessCentrality',
    10
  );

  const result = {
    summary: {
      directed,
      nodeCount: nodeIds.length,
      edgeCount: edges.length,
      maxDegreeCentrality: topDegreeNodes[0]?.value ?? 0,
      maxClosenessCentrality: topClosenessNodes[0]?.value ?? 0,
      maxBetweennessCentrality: topBetweennessNodes[0]?.value ?? 0,
    },

    nodes: nodeMetrics,

    maps: {
      degreeCentrality: degreeCentrality.total,
      inDegreeCentrality: degreeCentrality.in,
      outDegreeCentrality: degreeCentrality.out,
      closenessCentrality,
      betweennessCentrality,
    },

    rankings: {
      topDegreeNodes,
      topClosenessNodes,
      topBetweennessNodes,
    },

    interpretation: buildCentralityInterpretation({
      directed,
      topDegreeNodes,
      topClosenessNodes,
      topBetweennessNodes,
    }),
  };

  return result;
}

/**
 * Format centrality result for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatCentralityForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Centrality',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, rankings, interpretation } = result;

  const metrics = [
    {
      label: 'Max Degree Centrality',
      value: formatNumber(summary.maxDegreeCentrality, 4),
    },
    {
      label: 'Max Closeness',
      value: formatNumber(summary.maxClosenessCentrality, 4),
    },
    {
      label: 'Max Betweenness',
      value: formatNumber(summary.maxBetweennessCentrality, 4),
    },
  ];

  const sections = [
    {
      title: 'Top Degree Nodes',
      items: (rankings.topDegreeNodes || []).map((item) => {
        return {
          label: item.label,
          value: formatNumber(item.value, 4),
        };
      }),
    },
    {
      title: 'Top Closeness Nodes',
      items: (rankings.topClosenessNodes || []).map((item) => {
        return {
          label: item.label,
          value: formatNumber(item.value, 4),
        };
      }),
    },
    {
      title: 'Top Betweenness Nodes',
      items: (rankings.topBetweennessNodes || []).map((item) => {
        return {
          label: item.label,
          value: formatNumber(item.value, 4),
        };
      }),
    },
  ];

  return {
    title: 'Centrality',
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
export function runCentrality(graphData = {}) {
  const raw = computeCentrality(graphData);
  const display = formatCentralityForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildCentralityInterpretation({
  directed = false,
  topDegreeNodes = [],
  topClosenessNodes = [],
  topBetweennessNodes = [],
} = {}) {
  const lines = [];

  if (topDegreeNodes.length === 0) {
    return ['The graph has no nodes, so centrality cannot be analyzed yet.'];
  }

  const topDegree = topDegreeNodes[0];
  const topCloseness = topClosenessNodes[0];
  const topBetweenness = topBetweennessNodes[0];

  lines.push(
    `The highest degree centrality belongs to ${topDegree.label} (${formatNumber(topDegree.value, 4)}), suggesting a strong local hub role.`
  );

  lines.push(
    `The highest closeness centrality belongs to ${topCloseness.label} (${formatNumber(topCloseness.value, 4)}), suggesting fast access to other nodes through short paths.`
  );

  lines.push(
    `The highest betweenness centrality belongs to ${topBetweenness.label} (${formatNumber(topBetweenness.value, 4)}), suggesting an important bridge or brokerage role.`
  );

  if (topDegree.id === topBetweenness.id) {
    lines.push(
      'The same node leads both degree and betweenness centrality, so a hub-like node may also control many shortest paths.'
    );
  }

  if (
    topDegree.id !== topCloseness.id ||
    topDegree.id !== topBetweenness.id
  ) {
    lines.push(
      'Different nodes lead different centrality measures, showing that local popularity, global accessibility, and path brokerage are not the same structural role.'
    );
  }

  if (directed) {
    lines.push(
      'Because the graph is directed, in/out structure can affect centrality rankings beyond simple undirected neighborhood size.'
    );
  }

  return lines;
}

/* =========================
   Degree Centrality
   ========================= */

function computeDegreeCentrality(nodeIds, edges, directed) {
  const n = nodeIds.length;
  const denom = n > 1 ? n - 1 : 1;

  const totalDegree = createZeroObject(nodeIds);
  const inDegree = createZeroObject(nodeIds);
  const outDegree = createZeroObject(nodeIds);

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (directed) {
      if (source in outDegree) outDegree[source] += 1;
      if (target in inDegree) inDegree[target] += 1;

      if (source in totalDegree) totalDegree[source] += 1;
      if (target in totalDegree) totalDegree[target] += 1;
    } else {
      if (source in totalDegree) totalDegree[source] += 1;
      if (target in totalDegree) totalDegree[target] += 1;
    }
  });

  const totalCentrality = {};
  const inCentrality = {};
  const outCentrality = {};

  nodeIds.forEach((nodeId) => {
    totalCentrality[nodeId] = totalDegree[nodeId] / denom;
    inCentrality[nodeId] = directed ? inDegree[nodeId] / denom : null;
    outCentrality[nodeId] = directed ? outDegree[nodeId] / denom : null;
  });

  return {
    total: totalCentrality,
    in: inCentrality,
    out: outCentrality,
  };
}

/* =========================
   Closeness Centrality
   ========================= */

function computeClosenessCentrality(nodeIds, adjacency) {
  const closeness = {};
  const n = nodeIds.length;

  nodeIds.forEach((sourceId) => {
    const distances = bfsAllDistances(sourceId, adjacency);

    let sumDistances = 0;
    let reachableCount = 0;

    nodeIds.forEach((targetId) => {
      if (targetId === sourceId) return;

      const distance = distances[targetId];
      if (typeof distance === 'number') {
        sumDistances += distance;
        reachableCount += 1;
      }
    });

    if (sumDistances === 0 || reachableCount === 0) {
      closeness[sourceId] = 0;
      return;
    }

    /**
     * Normalized closeness:
     * (reachableCount / sumDistances) * (reachableCount / (N-1))
     *
     * This behaves well when the graph is disconnected.
     */
    const reachableFraction = n > 1 ? reachableCount / (n - 1) : 0;
    closeness[sourceId] = (reachableCount / sumDistances) * reachableFraction;
  });

  return closeness;
}

/* =========================
   Betweenness Centrality
   ========================= */

/**
 * Unweighted Brandes algorithm
 */
function computeBetweennessCentrality(nodeIds, adjacency, directed) {
  const betweenness = createZeroObject(nodeIds);
  const n = nodeIds.length;

  nodeIds.forEach(function (sourceId) {
    const stack = [];
    const predecessors = {};
    const sigma = {};
    const distance = {};
    const queue = [];

    nodeIds.forEach(function (nodeId) {
      predecessors[nodeId] = [];
      sigma[nodeId] = 0;
      distance[nodeId] = -1;
    });

    sigma[sourceId] = 1;
    distance[sourceId] = 0;
    queue.push(sourceId);

    while (queue.length > 0) {
      const v = queue.shift();
      stack.push(v);

      const neighbors = adjacency.get(v) || [];

      neighbors.forEach(function (item) {
        const w = item.node;

        if (distance[w] < 0) {
          queue.push(w);
          distance[w] = distance[v] + 1;
        }

        if (distance[w] === distance[v] + 1) {
          sigma[w] += sigma[v];
          predecessors[w].push(v);
        }
      });
    }

    const dependency = {};
    nodeIds.forEach(function (nodeId) {
      dependency[nodeId] = 0;
    });

    while (stack.length > 0) {
      const w = stack.pop();

      predecessors[w].forEach(function (v) {
        if (sigma[w] !== 0) {
          dependency[v] += (sigma[v] / sigma[w]) * (1 + dependency[w]);
        }
      });

      if (w !== sourceId) {
        betweenness[w] += dependency[w];
      }
    }
  });

  /* For undirected graphs, every pair is counted twice. */
  if (!directed) {
    nodeIds.forEach(function (nodeId) {
      betweenness[nodeId] /= 2;
    });
  }

  /* Normalize */
  if (n > 2) {
    const scale = directed
      ? 1 / ((n - 1) * (n - 2))
      : 2 / ((n - 1) * (n - 2));

    nodeIds.forEach(function (nodeId) {
      betweenness[nodeId] *= scale;
    });
  }

  return betweenness;
}

/* =========================
   Shared Graph Helpers
   ========================= */

function buildAdjacency(nodeIds, edges, directed) {
  const adjacency = new Map();

  nodeIds.forEach((id) => {
    adjacency.set(id, []);
  });

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!adjacency.has(target)) adjacency.set(target, []);

    adjacency.get(source).push({ node: target });

    if (!directed) {
      adjacency.get(target).push({ node: source });
    }
  });

  return adjacency;
}

function bfsAllDistances(sourceId, adjacency) {
  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const distances = { [sourceId]: 0 };

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency.get(current) ?? [];

    neighbors.forEach(({ node }) => {
      if (!visited.has(node)) {
        visited.add(node);
        distances[node] = distances[current] + 1;
        queue.push(node);
      }
    });
  }

  return distances;
}

/* =========================
   Formatting / ranking helpers
   ========================= */

function createRanking(items, valueKey, limit = 10) {
  return [...items]
    .map((item) => {
      return {
        id: item.id,
        label: item.label ?? item.id,
        value: item[valueKey] ?? 0,
      };
    })
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

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return Number(value).toFixed(digits);
}