// src/metrics/coreDecomposition.js

/**
 * Core decomposition / coreness analysis
 *
 * Included:
 * - k-core decomposition
 * - coreness of each node
 * - shell grouping
 * - innermost core
 *
 * Notes:
 * - Uses undirected structure for standard k-core analysis.
 * - For directed graphs, this implementation converts the graph
 *   to an undirected view.
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute k-core decomposition.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @returns {Object}
 */
export function computeCoreDecomposition(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(
    nodes.map((node) => [node.id, node.label ?? node.id])
  );

  const adjacency = buildUndirectedAdjacency(nodeIds, edges);
  const corenessMap = computeCoreness(nodeIds, adjacency);

  const maxCore = Math.max(0, ...Object.values(corenessMap));
  const shellGroups = groupNodesByCoreness(nodeIds, corenessMap, nodeLabelMap);

  const innermostCoreNodes = shellGroups[maxCore] ?? [];
  const innermostCoreSize = innermostCoreNodes.length;

  const nodeMetrics = nodeIds.map((nodeId) => {
    return {
      id: nodeId,
      label: nodeLabelMap.get(nodeId) ?? nodeId,
      coreness: corenessMap[nodeId] ?? 0,
    };
  });

  const topCoreNodes = [...nodeMetrics]
    .sort((a, b) => b.coreness - a.coreness || a.label.localeCompare(b.label))
    .slice(0, 10);

  const result = {
    summary: {
      directed,
      analyzedAsUndirected: directed,
      nodeCount: nodeIds.length,
      maxCore,
      innermostCoreSize,
      shellCount: Object.keys(shellGroups).length,
    },

    nodes: nodeMetrics,

    maps: {
      coreness: corenessMap,
    },

    shells: shellGroups,

    rankings: {
      topCoreNodes,
    },

    interpretation: buildCoreDecompositionInterpretation({
      directed,
      maxCore,
      innermostCoreSize,
      shellCount: Object.keys(shellGroups).length,
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
export function formatCoreDecompositionForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Core Decomposition',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, shells, rankings, interpretation } = result;

  const metrics = [
    {
      label: 'Max Core',
      value: formatInteger(summary.maxCore),
    },
    {
      label: 'Innermost Core Size',
      value: formatInteger(summary.innermostCoreSize),
    },
    {
      label: 'Shell Count',
      value: formatInteger(summary.shellCount),
    },
  ];

  const shellItems = Object.entries(shells)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 10)
    .map(([core, items]) => {
      return {
        label: `${core}-shell`,
        value: `${items.length} nodes`,
      };
    });

  const topCoreItems = (rankings.topCoreNodes || []).map((item) => {
    return {
      label: item.label,
      value: formatInteger(item.coreness),
    };
  });

  const sections = [
    {
      title: 'Shell Summary',
      items: shellItems,
    },
    {
      title: 'Top Core Nodes',
      items: topCoreItems,
    },
  ];

  return {
    title: 'Core Decomposition',
    metrics,
    interpretation,
    sections,
  };
}

/**
 * Convenience wrapper
 *
 * @param {Object} graphData
 * @returns {Object}
 */
export function runCoreDecomposition(graphData = {}) {
  const raw = computeCoreDecomposition(graphData);
  const display = formatCoreDecompositionForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildCoreDecompositionInterpretation({
  directed = false,
  maxCore = 0,
  innermostCoreSize = 0,
  shellCount = 0,
} = {}) {
  const lines = [];

  if (directed) {
    lines.push(
      'This result uses the undirected structure of the graph for standard k-core decomposition.'
    );
  }

  lines.push(
    `The maximum core number is ${formatInteger(maxCore)}, and the innermost core contains ${formatInteger(innermostCoreSize)} node(s).`
  );

  if (maxCore >= 4) {
    lines.push(
      'A relatively high maximum core suggests the presence of a dense structural center.'
    );
  } else if (maxCore >= 2) {
    lines.push(
      'The graph has a moderate core structure, with a distinguishable inner region.'
    );
  } else {
    lines.push(
      'The graph has a weak core structure, so dense nested connectivity is limited.'
    );
  }

  if (innermostCoreSize > 0 && innermostCoreSize <= 5) {
    lines.push(
      'The innermost core is small, suggesting that only a few nodes form the structural nucleus of the network.'
    );
  } else if (innermostCoreSize > 5) {
    lines.push(
      'The innermost core is sizable, suggesting a broader dense center rather than a single dominant hub.'
    );
  }

  lines.push(
    `The graph is divided into ${formatInteger(shellCount)} shell level(s), which helps distinguish peripheral and core nodes.`
  );

  return lines;
}

/* =========================
   Core computation
   ========================= */

function computeCoreness(nodeIds, adjacency) {
  const remaining = new Set(nodeIds);
  const coreness = {};
  const degree = {};

  nodeIds.forEach((nodeId) => {
    degree[nodeId] = (adjacency.get(nodeId) ?? new Set()).size;
  });

  let k = 0;

  while (remaining.size > 0) {
    let removedInThisRound = true;

    while (removedInThisRound) {
      removedInThisRound = false;

      const removable = Array.from(remaining).filter((nodeId) => degree[nodeId] <= k);

      if (removable.length === 0) {
        continue;
      }

      removable.forEach((nodeId) => {
        remaining.delete(nodeId);
        coreness[nodeId] = k;
        removedInThisRound = true;

        const neighbors = adjacency.get(nodeId) ?? new Set();
        neighbors.forEach((neighborId) => {
          if (remaining.has(neighborId)) {
            degree[neighborId] -= 1;
          }
        });
      });
    }

    k += 1;
  }

  return coreness;
}

function groupNodesByCoreness(nodeIds, corenessMap, nodeLabelMap) {
  const groups = {};

  nodeIds.forEach((nodeId) => {
    const core = corenessMap[nodeId] ?? 0;

    if (!groups[core]) {
      groups[core] = [];
    }

    groups[core].push({
      id: nodeId,
      label: nodeLabelMap.get(nodeId) ?? nodeId,
      coreness: core,
    });
  });

  Object.keys(groups).forEach((core) => {
    groups[core].sort((a, b) => a.label.localeCompare(b.label));
  });

  return groups;
}

/* =========================
   Graph helpers
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

/* =========================
   Formatting helpers
   ========================= */

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return String(Math.round(Number(value)));
}