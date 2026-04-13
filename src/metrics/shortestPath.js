// src/metrics/shortestPath.js

/**
 * Shortest path / path length analysis
 *
 * Supported:
 * - shortest path between two nodes
 * - shortest path distance
 * - all-pairs shortest path distances
 * - average shortest path length
 * - harmonic-style average for disconnected graphs
 * - diameter (largest finite shortest path)
 * - six degrees style interpretation
 */

/* =========================
   Public API
   ========================= */

/**
 * Run shortest path analysis for a full graph.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @param {boolean} [graphData.weighted=false]
 * @param {boolean} [options.useWeights=false]
 * @returns {Object}
 */
export function computeShortestPathMetrics(graphData = {}, options = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);
  const weighted = Boolean(graphData.weighted);
  const useWeights = Boolean(options.useWeights) && weighted;

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(nodes.map((node) => [node.id, node.label ?? node.id]));

  const adjacency = buildAdjacency(nodeIds, edges, {
    directed,
    weighted: useWeights,
  });

  const allPairs = computeAllPairsShortestPaths(nodeIds, adjacency, {
    weighted: useWeights,
  });

  const summary = summarizeShortestPaths(allPairs, nodeIds, directed);

  return {
    summary: {
      directed,
      weighted,
      useWeights,
      nodeCount: nodeIds.length,
      edgeCount: edges.length,
      averageShortestPathLength: summary.averageShortestPathLength,
      harmonicAveragePathLength: summary.harmonicAveragePathLength,
      diameter: summary.diameter,
      reachablePairCount: summary.reachablePairCount,
      unreachablePairCount: summary.unreachablePairCount,
      reachablePairRatio: summary.reachablePairRatio,
      sixDegreeRatio: summary.sixDegreeRatio,
    },

    paths: {
      distances: summary.distanceMatrix,
      longestFinitePair: summary.longestFinitePair,
    },

    interpretation: buildShortestPathInterpretation({
      directed,
      useWeights,
      averageShortestPathLength: summary.averageShortestPathLength,
      harmonicAveragePathLength: summary.harmonicAveragePathLength,
      diameter: summary.diameter,
      reachablePairRatio: summary.reachablePairRatio,
      sixDegreeRatio: summary.sixDegreeRatio,
      unreachablePairCount: summary.unreachablePairCount,
    }),

    meta: {
      nodeIds,
      nodeLabelMap: Object.fromEntries(nodeLabelMap.entries()),
    },
  };
}

/**
 * Compute the shortest path between two specific nodes.
 *
 * @param {Object} graphData
 * @param {string} sourceId
 * @param {string} targetId
 * @param {Object} [options]
 * @param {boolean} [options.useWeights=false]
 * @returns {Object}
 */
export function computeShortestPathBetween(
  graphData = {},
  sourceId,
  targetId,
  options = {}
) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);
  const weighted = Boolean(graphData.weighted);
  const useWeights = Boolean(options.useWeights) && weighted;

  if (!sourceId || !targetId) {
    throw new Error('Both sourceId and targetId are required.');
  }

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(nodes.map((node) => [node.id, node.label ?? node.id]));

  if (!nodeIds.includes(sourceId)) {
    throw new Error(`Source node "${sourceId}" does not exist.`);
  }

  if (!nodeIds.includes(targetId)) {
    throw new Error(`Target node "${targetId}" does not exist.`);
  }

  const adjacency = buildAdjacency(nodeIds, edges, {
    directed,
    weighted: useWeights,
  });

  const result = useWeights
    ? dijkstraShortestPath(sourceId, targetId, adjacency)
    : bfsShortestPath(sourceId, targetId, adjacency);

  const resolvedPathLabels = result.path.map((id) => nodeLabelMap.get(id) ?? id);

  return {
    sourceId,
    targetId,
    sourceLabel: nodeLabelMap.get(sourceId) ?? sourceId,
    targetLabel: nodeLabelMap.get(targetId) ?? targetId,
    found: result.found,
    distance: result.distance,
    path: result.path,
    pathLabels: resolvedPathLabels,
    hopCount: result.found ? Math.max(result.path.length - 1, 0) : null,
    useWeights,
    directed,
    weighted,
    interpretation: buildPairShortestPathInterpretation({
      found: result.found,
      distance: result.distance,
      pathLength: result.path.length,
      useWeights,
      directed,
    }),
  };
}

/**
 * Format full shortest-path results for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatShortestPathForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Shortest Path',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, paths, interpretation } = result;

  const metrics = [
    {
      label: 'Avg Path Length',
      value: formatNumber(summary.averageShortestPathLength, 3),
    },
    {
      label: 'Harmonic Avg',
      value: formatNumber(summary.harmonicAveragePathLength, 3),
    },
    {
      label: 'Diameter',
      value: formatNumber(summary.diameter, 3),
    },
    {
      label: 'Reachable Pair Ratio',
      value: formatPercent(summary.reachablePairRatio),
    },
    {
      label: '≤ 6 Steps Ratio',
      value: formatPercent(summary.sixDegreeRatio),
    },
    {
      label: 'Unreachable Pairs',
      value: formatInteger(summary.unreachablePairCount),
    },
  ];

  const sections = [];

  if (paths.longestFinitePair) {
    sections.push({
      title: 'Longest Finite Shortest Path',
      items: [
        {
          label: `${paths.longestFinitePair.source} → ${paths.longestFinitePair.target}`,
          value: formatNumber(paths.longestFinitePair.distance, 3),
        },
      ],
    });
  }

  return {
    title: 'Shortest Path',
    metrics,
    interpretation,
    sections,
  };
}

/**
 * Format a pair shortest path result for UI display.
 *
 * @param {Object} pairResult
 * @returns {Object}
 */
export function formatPairShortestPathForDisplay(pairResult) {
  if (!pairResult) {
    return {
      title: 'Pair Shortest Path',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const metrics = [
    { label: 'Found', value: pairResult.found ? 'Yes' : 'No' },
    {
      label: pairResult.useWeights ? 'Distance' : 'Shortest Distance',
      value: pairResult.found ? formatNumber(pairResult.distance, 3) : '-',
    },
    {
      label: 'Hop Count',
      value: pairResult.found ? formatInteger(pairResult.hopCount) : '-',
    },
  ];

  const sections = [
    {
      title: 'Path',
      items: [
        {
          label: `${pairResult.sourceLabel} → ${pairResult.targetLabel}`,
          value: pairResult.found ? pairResult.pathLabels.join(' → ') : 'No path',
        },
      ],
    },
  ];

  return {
    title: 'Pair Shortest Path',
    metrics,
    interpretation: pairResult.interpretation,
    sections,
  };
}

/**
 * Convenience wrapper for full-graph shortest path metrics.
 *
 * @param {Object} graphData
 * @param {Object} [options]
 * @returns {Object}
 */
export function runShortestPath(graphData = {}, options = {}) {
  const raw = computeShortestPathMetrics(graphData, options);
  const display = formatShortestPathForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildShortestPathInterpretation({
  directed = false,
  useWeights = false,
  averageShortestPathLength = 0,
  harmonicAveragePathLength = 0,
  diameter = 0,
  reachablePairRatio = 0,
  sixDegreeRatio = 0,
  unreachablePairCount = 0,
} = {}) {
  const lines = [];

  if (reachablePairRatio === 0) {
    return ['No reachable node pairs were found, so path-based interpretation is limited.'];
  }

  if (useWeights) {
    lines.push(
      `Weighted shortest paths were used, so path distance reflects edge weights rather than simple hop counts.`
    );
  } else {
    lines.push(
      `Unweighted shortest paths were used, so distance means the minimum number of edges between two nodes.`
    );
  }

  lines.push(
    `The average shortest path length is ${formatNumber(averageShortestPathLength, 3)}.`
  );

  if (unreachablePairCount > 0) {
    lines.push(
      `Some node pairs are unreachable, so the harmonic-style average (${formatNumber(harmonicAveragePathLength, 3)}) is also useful for disconnected structure.`
    );
  }

  lines.push(
    `The diameter, defined here as the largest finite shortest-path distance, is ${formatNumber(diameter, 3)}.`
  );

  if (sixDegreeRatio >= 0.9) {
    lines.push(
      'Most reachable node pairs are within six steps, so the graph shows a strong small-world or six-degrees-like tendency.'
    );
  } else if (sixDegreeRatio >= 0.6) {
    lines.push(
      'A substantial share of reachable pairs are within six steps, suggesting moderate small-world behavior.'
    );
  } else {
    lines.push(
      'Relatively few reachable pairs fall within six steps, so six-degrees-like behavior is not very strong here.'
    );
  }

  if (directed && reachablePairRatio < 1) {
    lines.push(
      'Because the graph is directed, edge direction reduces reachability and may increase effective path separation.'
    );
  }

  return lines;
}

export function buildPairShortestPathInterpretation({
  found = false,
  distance = null,
  pathLength = 0,
  useWeights = false,
  directed = false,
} = {}) {
  if (!found) {
    return [
      directed
        ? 'No directed path exists between the selected source and target.'
        : 'No path exists between the selected source and target.',
    ];
  }

  const lines = [];

  if (useWeights) {
    lines.push(
      `The selected nodes are connected by a minimum weighted distance of ${formatNumber(distance, 3)}.`
    );
  } else {
    lines.push(
      `The selected nodes are connected by a shortest-path distance of ${formatNumber(distance, 3)} edge(s).`
    );
  }

  lines.push(
    `The path visits ${formatInteger(pathLength)} node(s), including the source and target.`
  );

  return lines;
}

/* =========================
   Graph construction
   ========================= */

function buildAdjacency(nodeIds, edges, { directed = false, weighted = false } = {}) {
  const adjacency = new Map();

  nodeIds.forEach((id) => {
    adjacency.set(id, []);
  });

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!adjacency.has(target)) adjacency.set(target, []);

    const weight = weighted ? toValidWeight(edge.weight) : 1;

    adjacency.get(source).push({ node: target, weight });

    if (!directed) {
      adjacency.get(target).push({ node: source, weight });
    }
  });

  return adjacency;
}

/* =========================
   Pair shortest path
   ========================= */

function bfsShortestPath(sourceId, targetId, adjacency) {
  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const distance = new Map([[sourceId, 0]]);
  const previous = new Map();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === targetId) {
      break;
    }

    const neighbors = adjacency.get(current) ?? [];

    neighbors.forEach(({ node }) => {
      if (!visited.has(node)) {
        visited.add(node);
        distance.set(node, distance.get(current) + 1);
        previous.set(node, current);
        queue.push(node);
      }
    });
  }

  if (!visited.has(targetId)) {
    return {
      found: false,
      distance: null,
      path: [],
    };
  }

  return {
    found: true,
    distance: distance.get(targetId),
    path: reconstructPath(sourceId, targetId, previous),
  };
}

function dijkstraShortestPath(sourceId, targetId, adjacency) {
  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set(adjacency.keys());

  adjacency.forEach((_, nodeId) => {
    distances.set(nodeId, Infinity);
  });
  distances.set(sourceId, 0);

  while (unvisited.size > 0) {
    const current = extractMinDistanceNode(unvisited, distances);

    if (current === null || distances.get(current) === Infinity) {
      break;
    }

    unvisited.delete(current);

    if (current === targetId) {
      break;
    }

    const neighbors = adjacency.get(current) ?? [];

    neighbors.forEach(({ node, weight }) => {
      if (!unvisited.has(node)) return;

      const alt = distances.get(current) + weight;
      if (alt < distances.get(node)) {
        distances.set(node, alt);
        previous.set(node, current);
      }
    });
  }

  if (distances.get(targetId) === Infinity) {
    return {
      found: false,
      distance: null,
      path: [],
    };
  }

  return {
    found: true,
    distance: distances.get(targetId),
    path: reconstructPath(sourceId, targetId, previous),
  };
}

/* =========================
   All-pairs shortest paths
   ========================= */

function computeAllPairsShortestPaths(nodeIds, adjacency, { weighted = false } = {}) {
  const matrix = {};

  nodeIds.forEach((sourceId) => {
    matrix[sourceId] = weighted
      ? dijkstraAllDistances(sourceId, adjacency)
      : bfsAllDistances(sourceId, adjacency);
  });

  return matrix;
}

function bfsAllDistances(sourceId, adjacency) {
  const queue = [sourceId];
  const distances = {};
  const visited = new Set([sourceId]);

  distances[sourceId] = 0;

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

function dijkstraAllDistances(sourceId, adjacency) {
  const distances = new Map();
  const unvisited = new Set(adjacency.keys());

  adjacency.forEach((_, nodeId) => {
    distances.set(nodeId, Infinity);
  });
  distances.set(sourceId, 0);

  while (unvisited.size > 0) {
    const current = extractMinDistanceNode(unvisited, distances);

    if (current === null || distances.get(current) === Infinity) {
      break;
    }

    unvisited.delete(current);

    const neighbors = adjacency.get(current) ?? [];

    neighbors.forEach(({ node, weight }) => {
      if (!unvisited.has(node)) return;

      const alt = distances.get(current) + weight;
      if (alt < distances.get(node)) {
        distances.set(node, alt);
      }
    });
  }

  const result = {};
  distances.forEach((value, key) => {
    if (value !== Infinity) {
      result[key] = value;
    }
  });

  return result;
}

/* =========================
   Summary calculations
   ========================= */

function summarizeShortestPaths(allPairs, nodeIds, directed = false) {
  let finiteDistanceSum = 0;
  let reciprocalDistanceSum = 0;
  let reachablePairCount = 0;
  let unreachablePairCount = 0;
  let diameter = 0;
  let sixDegreeCount = 0;
  let longestFinitePair = null;

  const distanceMatrix = {};

  nodeIds.forEach((sourceId) => {
    distanceMatrix[sourceId] = {};

    nodeIds.forEach((targetId) => {
      if (sourceId === targetId) {
        distanceMatrix[sourceId][targetId] = 0;
        return;
      }

      const distance = allPairs[sourceId]?.[targetId];

      if (typeof distance === 'number' && Number.isFinite(distance)) {
        distanceMatrix[sourceId][targetId] = distance;
        reachablePairCount += 1;
        finiteDistanceSum += distance;
        reciprocalDistanceSum += 1 / distance;

        if (distance <= 6) {
          sixDegreeCount += 1;
        }

        if (distance > diameter) {
          diameter = distance;
          longestFinitePair = {
            source: sourceId,
            target: targetId,
            distance,
          };
        }
      } else {
        distanceMatrix[sourceId][targetId] = null;
        unreachablePairCount += 1;
      }
    });
  });

  const totalOrderedPairs = nodeIds.length * Math.max(nodeIds.length - 1, 0);

  const averageShortestPathLength =
    reachablePairCount > 0 ? finiteDistanceSum / reachablePairCount : 0;

  const reachablePairRatio =
    totalOrderedPairs > 0 ? reachablePairCount / totalOrderedPairs : 0;

  const sixDegreeRatio =
    reachablePairCount > 0 ? sixDegreeCount / reachablePairCount : 0;

  /**
   * Harmonic-like version following the lecture idea:
   * if unreachable => contribution 0 through 1/l_ij
   * l = ( sum(1/l_ij) / count )^-1
   */
  const harmonicAveragePathLength =
    reciprocalDistanceSum > 0 && totalOrderedPairs > 0
      ? totalOrderedPairs / reciprocalDistanceSum
      : 0;

  return {
    averageShortestPathLength,
    harmonicAveragePathLength,
    diameter,
    reachablePairCount,
    unreachablePairCount,
    reachablePairRatio,
    sixDegreeRatio,
    longestFinitePair,
    distanceMatrix,
  };
}

/* =========================
   Utilities
   ========================= */

function reconstructPath(sourceId, targetId, previous) {
  const path = [];
  let current = targetId;

  while (current !== undefined) {
    path.push(current);
    if (current === sourceId) break;
    current = previous.get(current);
  }

  path.reverse();

  if (path[0] !== sourceId) {
    return [];
  }

  return path;
}

function extractMinDistanceNode(unvisited, distances) {
  let bestNode = null;
  let bestDistance = Infinity;

  unvisited.forEach((nodeId) => {
    const distance = distances.get(nodeId);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNode = nodeId;
    }
  });

  return bestNode;
}

function toValidWeight(weight) {
  const parsed = Number(weight);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return Number(value).toFixed(digits);
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return String(Math.round(Number(value)));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(Number(value) * 100).toFixed(1)}%`;
}