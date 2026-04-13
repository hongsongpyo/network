// src/filters/filterDefinitions.js

/**
 * Filter definitions
 *
 * This file defines:
 * - available filter targets (node / edge)
 * - supported metrics / fields
 * - allowed operators
 * - labels and UI-friendly metadata
 *
 * These definitions are used by:
 * - filterUI.js
 * - filterEngine.js
 */

/* =========================
   Operators
   ========================= */

export const FILTER_OPERATORS = [
  {
    id: 'gte',
    label: '>=',
    fn: (value, threshold) => value >= threshold,
  },
  {
    id: 'lte',
    label: '<=',
    fn: (value, threshold) => value <= threshold,
  },
  {
    id: 'gt',
    label: '>',
    fn: (value, threshold) => value > threshold,
  },
  {
    id: 'lt',
    label: '<',
    fn: (value, threshold) => value < threshold,
  },
  {
    id: 'eq',
    label: '=',
    fn: (value, threshold) => value === threshold,
  },
  {
    id: 'between',
    label: 'between',
    fn: (value, range) => {
      if (!Array.isArray(range) || range.length !== 2) return false;
      return value >= range[0] && value <= range[1];
    },
  },
];

/* =========================
   Node Filter Definitions
   ========================= */

export const NODE_FILTER_DEFINITIONS = [
  {
    id: 'degree',
    label: 'Degree',
    target: 'node',
    type: 'number',
    field: 'degree',
    description: 'Number of connected neighbors.',
  },
  {
    id: 'indegree',
    label: 'In-degree',
    target: 'node',
    type: 'number',
    field: 'indegree',
    description: 'Number of incoming links.',
    directedOnly: true,
  },
  {
    id: 'outdegree',
    label: 'Out-degree',
    target: 'node',
    type: 'number',
    field: 'outdegree',
    description: 'Number of outgoing links.',
    directedOnly: true,
  },
  {
    id: 'strength',
    label: 'Strength',
    target: 'node',
    type: 'number',
    field: 'strength',
    description: 'Sum of edge weights connected to the node.',
    weightedOnly: true,
  },
  {
    id: 'degreeCentrality',
    label: 'Degree Centrality',
    target: 'node',
    type: 'number',
    field: 'degreeCentrality',
    description: 'Normalized degree centrality.',
  },
  {
    id: 'closenessCentrality',
    label: 'Closeness Centrality',
    target: 'node',
    type: 'number',
    field: 'closenessCentrality',
    description: 'How close the node is to all others.',
  },
  {
    id: 'betweennessCentrality',
    label: 'Betweenness Centrality',
    target: 'node',
    type: 'number',
    field: 'betweennessCentrality',
    description: 'How often the node lies on shortest paths.',
  },
  {
    id: 'clusteringCoefficient',
    label: 'Clustering Coefficient',
    target: 'node',
    type: 'number',
    field: 'clusteringCoefficient',
    description: 'Local triangle density around the node.',
  },
  {
    id: 'coreness',
    label: 'Coreness',
    target: 'node',
    type: 'number',
    field: 'coreness',
    description: 'Highest k-core that contains the node.',
  },
  {
    id: 'averageNeighborDegree',
    label: 'Average Neighbor Degree',
    target: 'node',
    type: 'number',
    field: 'averageNeighborDegree',
    description: 'Average degree of neighboring nodes.',
  },
  {
    id: 'triangleCount',
    label: 'Triangle Count',
    target: 'node',
    type: 'number',
    field: 'triangleCount',
    description: 'Number of triangles touching the node.',
  },
  {
    id: 'group',
    label: 'Group',
    target: 'node',
    type: 'string',
    field: 'group',
    description: 'Node category / group label.',
  },
];

/* =========================
   Edge Filter Definitions
   ========================= */

export const EDGE_FILTER_DEFINITIONS = [
  {
    id: 'weight',
    label: 'Weight',
    target: 'edge',
    type: 'number',
    field: 'weight',
    description: 'Edge weight.',
    weightedOnly: true,
  },
  {
    id: 'edgeBetweennessCentrality',
    label: 'Edge Betweenness',
    target: 'edge',
    type: 'number',
    field: 'edgeBetweennessCentrality',
    description: 'How often the edge lies on shortest paths.',
  },
  {
    id: 'source',
    label: 'Source',
    target: 'edge',
    type: 'string',
    field: 'source',
    description: 'Source node id.',
  },
  {
    id: 'target',
    label: 'Target',
    target: 'edge',
    type: 'string',
    field: 'target',
    description: 'Target node id.',
  },
];

/* =========================
   Preset Filters
   ========================= */

export const FILTER_PRESETS = [
  {
    id: 'hub-nodes',
    label: 'Hub Nodes',
    description: 'Show nodes with high degree.',
    rules: [
      {
        target: 'node',
        field: 'degree',
        operator: 'gte',
        value: 5,
      },
    ],
  },
  {
    id: 'bridge-nodes',
    label: 'Bridge Nodes',
    description: 'Show nodes with high betweenness centrality.',
    rules: [
      {
        target: 'node',
        field: 'betweennessCentrality',
        operator: 'gte',
        value: 0.1,
      },
    ],
  },
  {
    id: 'core-nodes',
    label: 'Core Nodes',
    description: 'Show nodes with high coreness.',
    rules: [
      {
        target: 'node',
        field: 'coreness',
        operator: 'gte',
        value: 2,
      },
    ],
  },
  {
    id: 'heavy-edges',
    label: 'Heavy Edges',
    description: 'Show edges with large weights.',
    rules: [
      {
        target: 'edge',
        field: 'weight',
        operator: 'gte',
        value: 2,
      },
    ],
  },
];

/* =========================
   Helpers
   ========================= */

export function getAllFilterDefinitions() {
  return [...NODE_FILTER_DEFINITIONS, ...EDGE_FILTER_DEFINITIONS];
}

export function getNodeFilterDefinitions() {
  return [...NODE_FILTER_DEFINITIONS];
}

export function getEdgeFilterDefinitions() {
  return [...EDGE_FILTER_DEFINITIONS];
}

export function getFilterDefinitionById(id) {
  return getAllFilterDefinitions().find((definition) => definition.id === id) ?? null;
}

export function getFilterDefinitionByField(field, target = null) {
  return getAllFilterDefinitions().find((definition) => {
    const targetMatches = target ? definition.target === target : true;
    return definition.field === field && targetMatches;
  }) ?? null;
}

export function getFilterOperatorById(id) {
  return FILTER_OPERATORS.find((operator) => operator.id === id) ?? null;
}

export function getAvailableDefinitionsForContext({
  directed = false,
  weighted = false,
  target = null,
} = {}) {
  return getAllFilterDefinitions().filter((definition) => {
    if (target && definition.target !== target) {
      return false;
    }

    if (definition.directedOnly && !directed) {
      return false;
    }

    if (definition.weightedOnly && !weighted) {
      return false;
    }

    return true;
  });
}

export function getPresetById(id) {
  return FILTER_PRESETS.find((preset) => preset.id === id) ?? null;
}