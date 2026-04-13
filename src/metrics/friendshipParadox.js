// src/metrics/friendshipParadox.js

/**
 * Friendship paradox analysis
 *
 * Included:
 * - average node degree
 * - average neighbor degree over nodes
 * - node-level comparison:
 *   "my neighbors have more neighbors than I do"
 * - paradox ratio
 *
 * Note:
 * This implementation uses the undirected neighborhood structure.
 * For directed graphs, it converts the graph to an undirected view.
 */

/* =========================
   Public API
   ========================= */

export function computeFriendshipParadox(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(
    nodes.map((node) => [node.id, node.label ?? node.id])
  );

  const adjacency = buildUndirectedAdjacency(nodeIds, edges);
  const degreeMap = computeDegreesFromAdjacency(nodeIds, adjacency);

  const degreeValues = nodeIds.map((id) => degreeMap[id] ?? 0);
  const averageDegree = mean(degreeValues);

  const averageNeighborDegreeByNode = {};
  const nodeComparisons = [];

  nodeIds.forEach((nodeId) => {
    const neighbors = Array.from(adjacency.get(nodeId) ?? []);
    const myDegree = degreeMap[nodeId] ?? 0;

    if (neighbors.length === 0) {
      averageNeighborDegreeByNode[nodeId] = null;
      nodeComparisons.push({
        id: nodeId,
        label: nodeLabelMap.get(nodeId) ?? nodeId,
        degree: myDegree,
        averageNeighborDegree: null,
        paradoxHolds: null,
      });
      return;
    }

    const avgNeighborDegree = mean(
      neighbors.map((neighborId) => degreeMap[neighborId] ?? 0)
    );

    averageNeighborDegreeByNode[nodeId] = avgNeighborDegree;

    nodeComparisons.push({
      id: nodeId,
      label: nodeLabelMap.get(nodeId) ?? nodeId,
      degree: myDegree,
      averageNeighborDegree: avgNeighborDegree,
      paradoxHolds: avgNeighborDegree > myDegree,
    });
  });

  const comparableNodes = nodeComparisons.filter(
    (item) => typeof item.averageNeighborDegree === 'number'
  );

  const averageNeighborDegreeAcrossNodes = mean(
    comparableNodes.map((item) => item.averageNeighborDegree)
  );

  const paradoxNodeCount = comparableNodes.filter(
    (item) => item.paradoxHolds === true
  ).length;

  const paradoxRatio =
    comparableNodes.length > 0 ? paradoxNodeCount / comparableNodes.length : 0;

  const strongestParadoxNodes = [...comparableNodes]
    .map((item) => ({
      ...item,
      paradoxGap: item.averageNeighborDegree - item.degree,
    }))
    .sort((a, b) => b.paradoxGap - a.paradoxGap || a.label.localeCompare(b.label))
    .slice(0, 10);

  const result = {
    summary: {
      directed,
      analyzedAsUndirected: directed,
      nodeCount: nodeIds.length,
      averageDegree,
      averageNeighborDegreeAcrossNodes,
      paradoxNodeCount,
      comparableNodeCount: comparableNodes.length,
      paradoxRatio,
      paradoxHoldsAtNetworkLevel:
        averageNeighborDegreeAcrossNodes > averageDegree,
    },

    nodes: nodeComparisons,

    maps: {
      degree: degreeMap,
      averageNeighborDegreeByNode,
    },

    rankings: {
      strongestParadoxNodes,
    },

    interpretation: buildFriendshipParadoxInterpretation({
      directed,
      averageDegree,
      averageNeighborDegreeAcrossNodes,
      paradoxNodeCount,
      comparableNodeCount: comparableNodes.length,
      paradoxRatio,
    }),
  };

  return result;
}

export function formatFriendshipParadoxForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Friendship Paradox',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, rankings, interpretation } = result;

  const metrics = [
    {
      label: 'Avg Degree',
      value: formatNumber(summary.averageDegree, 3),
    },
    {
      label: 'Avg Neighbor Degree',
      value: formatNumber(summary.averageNeighborDegreeAcrossNodes, 3),
    },
    {
      label: 'Paradox Node Count',
      value: formatInteger(summary.paradoxNodeCount),
    },
    {
      label: 'Comparable Nodes',
      value: formatInteger(summary.comparableNodeCount),
    },
    {
      label: 'Paradox Ratio',
      value: formatPercent(summary.paradoxRatio),
    },
    {
      label: 'Network-level Paradox',
      value: summary.paradoxHoldsAtNetworkLevel ? 'Yes' : 'No',
    },
  ];

  const sections = [
    {
      title: 'Strongest Paradox Nodes',
      items: (rankings.strongestParadoxNodes || []).map((item) => {
        return {
          label: item.label,
          value: `${formatNumber(item.degree, 2)} → ${formatNumber(item.averageNeighborDegree, 2)}`,
        };
      }),
    },
  ];

  return {
    title: 'Friendship Paradox',
    metrics,
    interpretation,
    sections,
  };
}

export function runFriendshipParadox(graphData = {}) {
  const raw = computeFriendshipParadox(graphData);
  const display = formatFriendshipParadoxForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildFriendshipParadoxInterpretation({
  directed = false,
  averageDegree = 0,
  averageNeighborDegreeAcrossNodes = 0,
  paradoxNodeCount = 0,
  comparableNodeCount = 0,
  paradoxRatio = 0,
} = {}) {
  const lines = [];

  if (comparableNodeCount === 0) {
    return [
      'No node has neighbors, so the friendship paradox cannot be evaluated.'
    ];
  }

  if (directed) {
    lines.push(
      'This result uses the undirected neighborhood structure to evaluate the friendship paradox.'
    );
  }

  lines.push(
    `The average node degree is ${formatNumber(averageDegree, 3)}, while the average neighbor degree is ${formatNumber(averageNeighborDegreeAcrossNodes, 3)}.`
  );

  if (averageNeighborDegreeAcrossNodes > averageDegree) {
    lines.push(
      'At the network level, the friendship paradox holds: neighbors are more connected on average than randomly chosen nodes.'
    );
  } else {
    lines.push(
      'At the network level, the friendship paradox is not strongly observed.'
    );
  }

  lines.push(
    `${formatInteger(paradoxNodeCount)} out of ${formatInteger(comparableNodeCount)} comparable nodes satisfy the paradox condition.`
  );

  if (paradoxRatio >= 0.7) {
    lines.push(
      'The paradox is widespread across the graph, which usually indicates a heterogeneous degree distribution with hub-like nodes.'
    );
  } else if (paradoxRatio >= 0.4) {
    lines.push(
      'The paradox appears for a moderate share of nodes, suggesting some degree heterogeneity.'
    );
  } else {
    lines.push(
      'The paradox is not very widespread, suggesting a more even degree structure.'
    );
  }

  return lines;
}

/* =========================
   Core helpers
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

function computeDegreesFromAdjacency(nodeIds, adjacency) {
  const degreeMap = {};

  nodeIds.forEach((nodeId) => {
    degreeMap[nodeId] = (adjacency.get(nodeId) ?? new Set()).size;
  });

  return degreeMap;
}

/* =========================
   Numeric helpers
   ========================= */

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}