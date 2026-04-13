// src/data/sampleDatasets.js

/**
 * Sample dataset format
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   directed: boolean,
 *   weighted: boolean,
 *   nodes: Array<{ id: string, label?: string, group?: string }>,
 *   edges: Array<{ id?: string, source: string, target: string, weight?: number }>
 * }
 */

export const SAMPLE_DATASETS = [
  {
    id: 'small-social-network',
    name: 'Small Social Network',
    description:
      'A compact undirected social-style network with triangles and bridge-like links.',
    directed: false,
    weighted: false,
    nodes: [
      { id: 'A', label: 'A', group: 'group-1' },
      { id: 'B', label: 'B', group: 'group-1' },
      { id: 'C', label: 'C', group: 'group-1' },
      { id: 'D', label: 'D', group: 'group-1' },
      { id: 'E', label: 'E', group: 'group-2' },
      { id: 'F', label: 'F', group: 'group-2' },
      { id: 'G', label: 'G', group: 'group-2' },
      { id: 'H', label: 'H', group: 'group-3' },
    ],
    edges: [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'C' },
      { source: 'B', target: 'C' },
      { source: 'B', target: 'D' },
      { source: 'C', target: 'D' },
      { source: 'D', target: 'E' },
      { source: 'E', target: 'F' },
      { source: 'E', target: 'G' },
      { source: 'F', target: 'G' },
      { source: 'G', target: 'H' },
    ],
  },

  {
    id: 'hub-network',
    name: 'Hub Network',
    description:
      'A hub-dominant undirected network useful for hub analysis, centrality, and robustness demos.',
    directed: false,
    weighted: false,
    nodes: [
      { id: 'HUB', label: 'HUB', group: 'hub' },
      { id: 'N1', label: 'N1', group: 'leaf' },
      { id: 'N2', label: 'N2', group: 'leaf' },
      { id: 'N3', label: 'N3', group: 'leaf' },
      { id: 'N4', label: 'N4', group: 'leaf' },
      { id: 'N5', label: 'N5', group: 'leaf' },
      { id: 'N6', label: 'N6', group: 'leaf' },
      { id: 'N7', label: 'N7', group: 'leaf' },
      { id: 'N8', label: 'N8', group: 'leaf' },
      { id: 'N9', label: 'N9', group: 'leaf' },
    ],
    edges: [
      { source: 'HUB', target: 'N1' },
      { source: 'HUB', target: 'N2' },
      { source: 'HUB', target: 'N3' },
      { source: 'HUB', target: 'N4' },
      { source: 'HUB', target: 'N5' },
      { source: 'HUB', target: 'N6' },
      { source: 'HUB', target: 'N7' },
      { source: 'HUB', target: 'N8' },
      { source: 'HUB', target: 'N9' },
      { source: 'N1', target: 'N2' },
      { source: 'N3', target: 'N4' },
      { source: 'N5', target: 'N6' },
    ],
  },

  {
    id: 'disconnected-network',
    name: 'Disconnected Network',
    description:
      'An undirected graph with multiple components for connectedness and component analysis.',
    directed: false,
    weighted: false,
    nodes: [
      { id: 'C1-1', label: 'C1-1', group: 'component-1' },
      { id: 'C1-2', label: 'C1-2', group: 'component-1' },
      { id: 'C1-3', label: 'C1-3', group: 'component-1' },
      { id: 'C1-4', label: 'C1-4', group: 'component-1' },

      { id: 'C2-1', label: 'C2-1', group: 'component-2' },
      { id: 'C2-2', label: 'C2-2', group: 'component-2' },
      { id: 'C2-3', label: 'C2-3', group: 'component-2' },

      { id: 'C3-1', label: 'C3-1', group: 'component-3' },
      { id: 'C3-2', label: 'C3-2', group: 'component-3' },
    ],
    edges: [
      { source: 'C1-1', target: 'C1-2' },
      { source: 'C1-2', target: 'C1-3' },
      { source: 'C1-3', target: 'C1-4' },
      { source: 'C1-1', target: 'C1-4' },

      { source: 'C2-1', target: 'C2-2' },
      { source: 'C2-2', target: 'C2-3' },

      { source: 'C3-1', target: 'C3-2' },
    ],
  },

  {
    id: 'directed-weighted-network',
    name: 'Directed Weighted Network',
    description:
      'A directed weighted graph for testing shortest path, in/out degree, and weighted behavior.',
    directed: true,
    weighted: true,
    nodes: [
      { id: '1', label: '1', group: 'layer-1' },
      { id: '2', label: '2', group: 'layer-1' },
      { id: '3', label: '3', group: 'layer-1' },
      { id: '4', label: '4', group: 'layer-2' },
      { id: '5', label: '5', group: 'layer-2' },
      { id: '6', label: '6', group: 'layer-3' },
    ],
    edges: [
      { source: '1', target: '2', weight: 3 },
      { source: '1', target: '3', weight: 1 },
      { source: '2', target: '4', weight: 2 },
      { source: '3', target: '4', weight: 5 },
      { source: '3', target: '5', weight: 2 },
      { source: '4', target: '6', weight: 1 },
      { source: '5', target: '6', weight: 4 },
      { source: '2', target: '5', weight: 3 },
    ],
  },
];

/**
 * Returns all sample datasets.
 */
export function getSampleDatasets() {
  return SAMPLE_DATASETS;
}

/**
 * Returns a single sample dataset by id.
 * A cloned copy is returned to avoid accidental mutation of originals.
 */
export function getSampleDatasetById(datasetId) {
  const dataset = SAMPLE_DATASETS.find((item) => item.id === datasetId);

  if (!dataset) {
    return null;
  }

  return cloneDataset(dataset);
}

/**
 * Returns the first sample dataset.
 */
export function getDefaultSampleDataset() {
  return cloneDataset(SAMPLE_DATASETS[0]);
}

/**
 * Converts a dataset to Cytoscape element format.
 */
export function toCytoscapeElements(dataset) {
  if (!dataset) {
    return [];
  }

  const nodeElements = (dataset.nodes || []).map((node) => ({
    data: {
      id: node.id,
      label: node.label ?? node.id,
      group: node.group ?? 'default',
    },
  }));

  const edgeElements = (dataset.edges || []).map((edge, index) => ({
    data: {
      id: edge.id ?? `${edge.source}->${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      weight: edge.weight ?? 1,
    },
  }));

  return [...nodeElements, ...edgeElements];
}

/**
 * Deep clone utility for sample datasets.
 */
function cloneDataset(dataset) {
  return {
    ...dataset,
    nodes: dataset.nodes.map((node) => ({ ...node })),
    edges: dataset.edges.map((edge) => ({ ...edge })),
  };
}