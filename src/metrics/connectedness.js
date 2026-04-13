// src/metrics/connectedness.js

/**
 * Connectedness / components analysis
 *
 * Supported:
 * - undirected connected components
 * - directed weakly connected components
 * - directed strongly connected components
 * - giant component size / ratio
 * - component membership map
 * - simple interpretation text
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute connectedness metrics for a graph dataset.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @returns {Object}
 */
export function computeConnectedness(graphData = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const directed = Boolean(graphData.directed);

  const nodeIds = nodes.map((node) => node.id);
  const nodeLabelMap = new Map(nodes.map((node) => [node.id, node.label ?? node.id]));

  const adjacencyUndirected = buildUndirectedAdjacency(nodeIds, edges);
  const weakComponents = findUndirectedComponents(nodeIds, adjacencyUndirected);

  const giantWeakComponent = weakComponents[0] ?? [];
  const giantWeakComponentSize = giantWeakComponent.length;
  const giantWeakComponentRatio =
    nodeIds.length > 0 ? giantWeakComponentSize / nodeIds.length : 0;

  const isConnected = !directed && weakComponents.length === 1 && nodeIds.length > 0;
  const isWeaklyConnected = directed && weakComponents.length === 1 && nodeIds.length > 0;

  let strongComponents = [];
  let giantStrongComponent = [];
  let giantStrongComponentSize = 0;
  let giantStrongComponentRatio = 0;
  let isStronglyConnected = false;

  if (directed) {
    const adjacencyDirected = buildDirectedAdjacency(nodeIds, edges);
    strongComponents = findStronglyConnectedComponents(nodeIds, adjacencyDirected);

    giantStrongComponent = strongComponents[0] ?? [];
    giantStrongComponentSize = giantStrongComponent.length;
    giantStrongComponentRatio =
      nodeIds.length > 0 ? giantStrongComponentSize / nodeIds.length : 0;

    isStronglyConnected = strongComponents.length === 1 && nodeIds.length > 0;
  }

  const weakMembershipMap = createComponentMembershipMap(weakComponents);
  const strongMembershipMap = directed
    ? createComponentMembershipMap(strongComponents)
    : {};

  const result = {
    summary: {
      directed,
      nodeCount: nodeIds.length,
      edgeCount: edges.length,

      componentCount: weakComponents.length,
      isConnected,
      isWeaklyConnected,
      giantComponentSize: giantWeakComponentSize,
      giantComponentRatio: giantWeakComponentRatio,

      strongComponentCount: directed ? strongComponents.length : null,
      isStronglyConnected: directed ? isStronglyConnected : null,
      giantStrongComponentSize: directed ? giantStrongComponentSize : null,
      giantStrongComponentRatio: directed ? giantStrongComponentRatio : null,
    },

    components: {
      weak: weakComponents.map((component, index) =>
        createComponentObject(component, index, nodeLabelMap, nodeIds.length)
      ),
      strong: directed
        ? strongComponents.map((component, index) =>
            createComponentObject(component, index, nodeLabelMap, nodeIds.length)
          )
        : [],
    },

    maps: {
      weakMembership: weakMembershipMap,
      strongMembership: strongMembershipMap,
    },

    interpretation: buildConnectednessInterpretation({
      directed,
      nodeCount: nodeIds.length,
      weakComponentCount: weakComponents.length,
      giantWeakComponentRatio,
      isConnected,
      isWeaklyConnected,
      strongComponentCount: strongComponents.length,
      giantStrongComponentRatio,
      isStronglyConnected,
    }),
  };

  return result;
}

/**
 * Format connectedness result for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatConnectednessForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Connectedness',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, components, interpretation } = result;

  const metrics = [
    { label: 'Components', value: formatInteger(summary.componentCount) },
    { label: 'Giant Component Size', value: formatInteger(summary.giantComponentSize) },
    {
      label: 'Giant Component Ratio',
      value: formatPercent(summary.giantComponentRatio),
    },
  ];

  if (summary.directed) {
    metrics.unshift({
      label: 'Weakly Connected',
      value: summary.isWeaklyConnected ? 'Yes' : 'No',
    });

    metrics.push(
      {
        label: 'Strong Components',
        value: formatInteger(summary.strongComponentCount),
      },
      {
        label: 'Strongly Connected',
        value: summary.isStronglyConnected ? 'Yes' : 'No',
      },
      {
        label: 'Largest SCC Ratio',
        value: formatPercent(summary.giantStrongComponentRatio),
      }
    );
  } else {
    metrics.unshift({
      label: 'Connected',
      value: summary.isConnected ? 'Yes' : 'No',
    });
  }

  const weakSection = {
    title: summary.directed ? 'Weak Components' : 'Components',
    items: components.weak.slice(0, 10).map((component) => ({
      label: `#${component.index + 1} (${component.size} nodes)`,
      value: `${formatPercent(component.ratio)} of graph`,
    })),
  };

  const sections = [weakSection];

  if (summary.directed) {
    sections.push({
      title: 'Strong Components',
      items: components.strong.slice(0, 10).map((component) => ({
        label: `#${component.index + 1} (${component.size} nodes)`,
        value: `${formatPercent(component.ratio)} of graph`,
      })),
    });
  }

  return {
    title: 'Connectedness',
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
export function runConnectedness(graphData = {}) {
  const raw = computeConnectedness(graphData);
  const display = formatConnectednessForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildConnectednessInterpretation({
  directed = false,
  nodeCount = 0,
  weakComponentCount = 0,
  giantWeakComponentRatio = 0,
  isConnected = false,
  isWeaklyConnected = false,
  strongComponentCount = 0,
  giantStrongComponentRatio = 0,
  isStronglyConnected = false,
} = {}) {
  const lines = [];

  if (nodeCount === 0) {
    return ['The graph is empty, so connectedness cannot be interpreted yet.'];
  }

  if (!directed) {
    if (isConnected) {
      lines.push('The graph is connected, so every node can reach every other node through some path.');
    } else {
      lines.push(
        `The graph is disconnected and split into ${formatInteger(weakComponentCount)} components.`
      );
    }

    lines.push(
      `The giant component contains ${formatPercent(giantWeakComponentRatio)} of all nodes.`
    );

    if (giantWeakComponentRatio >= 0.8) {
      lines.push(
        'Most nodes belong to one dominant giant component, so the network still has a strong global backbone.'
      );
    } else if (giantWeakComponentRatio >= 0.5) {
      lines.push(
        'A moderate giant component exists, but a substantial portion of the graph is separated into smaller components.'
      );
    } else {
      lines.push(
        'The giant component is relatively small, indicating a fragmented network structure.'
      );
    }

    return lines;
  }

  if (isWeaklyConnected) {
    lines.push(
      'The directed graph is weakly connected, meaning it becomes connected if edge directions are ignored.'
    );
  } else {
    lines.push(
      `The directed graph is weakly disconnected and split into ${formatInteger(weakComponentCount)} weak components.`
    );
  }

  if (isStronglyConnected) {
    lines.push(
      'The graph is also strongly connected, so every node can reach every other node following edge directions.'
    );
  } else {
    lines.push(
      `The graph is not strongly connected and contains ${formatInteger(strongComponentCount)} strongly connected components.`
    );
  }

  lines.push(
    `The giant weak component contains ${formatPercent(giantWeakComponentRatio)} of nodes, while the largest strongly connected component contains ${formatPercent(giantStrongComponentRatio)}.`
  );

  if (giantStrongComponentRatio < giantWeakComponentRatio) {
    lines.push(
      'This gap suggests that edge direction significantly restricts reachability, even if the undirected backbone looks well connected.'
    );
  }

  return lines;
}

/* =========================
   Undirected / weak components
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

    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  });

  return adjacency;
}

function findUndirectedComponents(nodeIds, adjacency) {
  const visited = new Set();
  const components = [];

  nodeIds.forEach((startId) => {
    if (visited.has(startId)) return;

    const component = [];
    const stack = [startId];
    visited.add(startId);

    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);

      const neighbors = adjacency.get(current) ?? new Set();

      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      });
    }

    components.push(component.sort(compareNodeIds));
  });

  return components.sort((a, b) => b.length - a.length || compareNodeIds(a[0], b[0]));
}

/* =========================
   Directed / strong components (Kosaraju)
   ========================= */

function buildDirectedAdjacency(nodeIds, edges) {
  const outAdj = new Map();
  const reverseAdj = new Map();

  nodeIds.forEach((id) => {
    outAdj.set(id, new Set());
    reverseAdj.set(id, new Set());
  });

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (!outAdj.has(source)) outAdj.set(source, new Set());
    if (!outAdj.has(target)) outAdj.set(target, new Set());
    if (!reverseAdj.has(source)) reverseAdj.set(source, new Set());
    if (!reverseAdj.has(target)) reverseAdj.set(target, new Set());

    outAdj.get(source).add(target);
    reverseAdj.get(target).add(source);
  });

  return { outAdj, reverseAdj };
}

function findStronglyConnectedComponents(nodeIds, adjacency) {
  const { outAdj, reverseAdj } = adjacency;

  const visited = new Set();
  const finishOrder = [];

  nodeIds.forEach((nodeId) => {
    if (!visited.has(nodeId)) {
      dfsFinishOrder(nodeId, outAdj, visited, finishOrder);
    }
  });

  const assigned = new Set();
  const components = [];

  for (let i = finishOrder.length - 1; i >= 0; i -= 1) {
    const nodeId = finishOrder[i];
    if (assigned.has(nodeId)) continue;

    const component = [];
    const stack = [nodeId];
    assigned.add(nodeId);

    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);

      const neighbors = reverseAdj.get(current) ?? new Set();

      neighbors.forEach((neighbor) => {
        if (!assigned.has(neighbor)) {
          assigned.add(neighbor);
          stack.push(neighbor);
        }
      });
    }

    components.push(component.sort(compareNodeIds));
  }

  return components.sort((a, b) => b.length - a.length || compareNodeIds(a[0], b[0]));
}

function dfsFinishOrder(startNode, outAdj, visited, finishOrder) {
  const stack = [[startNode, false]];

  while (stack.length > 0) {
    const [nodeId, expanded] = stack.pop();

    if (expanded) {
      finishOrder.push(nodeId);
      continue;
    }

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    stack.push([nodeId, true]);

    const neighbors = Array.from(outAdj.get(nodeId) ?? []).sort(compareNodeIds);
    for (let i = neighbors.length - 1; i >= 0; i -= 1) {
      const neighbor = neighbors[i];
      if (!visited.has(neighbor)) {
        stack.push([neighbor, false]);
      }
    }
  }
}

/* =========================
   Formatting helpers
   ========================= */

function createComponentMembershipMap(components) {
  const membership = {};

  components.forEach((component, index) => {
    component.forEach((nodeId) => {
      membership[nodeId] = index;
    });
  });

  return membership;
}

function createComponentObject(component, index, nodeLabelMap, totalNodeCount) {
  return {
    index,
    size: component.length,
    ratio: totalNodeCount > 0 ? component.length / totalNodeCount : 0,
    nodeIds: [...component],
    labels: component.map((nodeId) => nodeLabelMap.get(nodeId) ?? nodeId),
  };
}

function compareNodeIds(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return String(Math.round(Number(value)));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(Number(value) * 100).toFixed(1)}%`;
}