// src/graph/graphEdit.js

import { getCyInstance } from './graphState.js';
import { applyLayout, fitGraph, clearGraphSelection } from './cytoscapeInit.js';
import { getGraphData, setGraphData, setGraphElements } from './graphState.js';

/**
 * Add a single node to the graph.
 *
 * @param {Object} node
 * @param {string} node.id
 * @param {string} [node.label]
 * @param {string} [node.group]
 * @param {Object} [options]
 * @param {boolean} [options.runLayout=true]
 * @param {boolean} [options.fit=false]
 * @returns {Object|null}
 */
export function addNode(node, options = {}) {
  const cy = getRequiredCy();
  validateNodeInput(node);

  if (cy.getElementById(node.id).length > 0) {
    throw new Error(`Node with id "${node.id}" already exists.`);
  }

  const normalizedNode = normalizeNode(node);

  cy.add({
    group: 'nodes',
    data: normalizedNode,
    classes: 'new-node',
  });

  updateStateFromCy(cy);

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit === true) {
    fitGraph();
  }

  return normalizedNode;
}

/**
 * Add a single edge to the graph.
 *
 * @param {Object} edge
 * @param {string} edge.source
 * @param {string} edge.target
 * @param {string} [edge.id]
 * @param {number} [edge.weight]
 * @param {Object} [options]
 * @param {boolean} [options.runLayout=true]
 * @param {boolean} [options.fit=false]
 * @returns {Object|null}
 */
export function addEdge(edge, options = {}) {
  const cy = getRequiredCy();
  validateEdgeInput(edge, cy);

  const normalizedEdge = normalizeEdge(edge, cy);

  if (cy.getElementById(normalizedEdge.id).length > 0) {
    throw new Error(`Edge with id "${normalizedEdge.id}" already exists.`);
  }

  cy.add({
    group: 'edges',
    data: normalizedEdge,
    classes: 'new-edge',
  });

  updateNodeDegreeData(cy);
  updateStateFromCy(cy);

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit === true) {
    fitGraph();
  }

  return normalizedEdge;
}

/**
 * Add a new node and optionally connect it to existing nodes.
 *
 * Example:
 * addNodeWithEdges(
 *   { id: 'X', label: 'X' },
 *   [{ target: 'A', weight: 2 }, { target: 'B' }]
 * )
 */
export function addNodeWithEdges(node, connections = [], options = {}) {
  const cy = getRequiredCy();

  addNode(node, { runLayout: false, fit: false });

  const createdEdges = [];

  connections.forEach((connection, index) => {
    const edge = {
      id: connection.id ?? `${node.id}->${connection.target}-${index}`,
      source: connection.source ?? node.id,
      target: connection.target,
      ...(connection.weight !== undefined ? { weight: Number(connection.weight) } : {}),
      ...(connection.directed !== undefined ? { directed: Boolean(connection.directed) } : {}),
    };

    const created = addEdge(edge, { runLayout: false, fit: false });
    createdEdges.push(created);
  });

  updateNodeDegreeData(cy);
  updateStateFromCy(cy);

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit === true) {
    fitGraph();
  }

  return {
    node: normalizeNode(node),
    edges: createdEdges,
  };
}

/**
 * Remove a node by id.
 * Cytoscape automatically removes connected edges.
 */
export function removeNodeById(nodeId, options = {}) {
  const cy = getRequiredCy();

  const node = cy.getElementById(nodeId);
  if (!node || node.length === 0 || !node.isNode()) {
    return false;
  }

  node.remove();

  updateNodeDegreeData(cy);
  updateStateFromCy(cy);
  clearGraphSelection();

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit === true) {
    fitGraph();
  }

  return true;
}

/**
 * Remove an edge by id.
 */
export function removeEdgeById(edgeId, options = {}) {
  const cy = getRequiredCy();

  const edge = cy.getElementById(edgeId);
  if (!edge || edge.length === 0 || !edge.isEdge()) {
    return false;
  }

  edge.remove();

  updateNodeDegreeData(cy);
  updateStateFromCy(cy);
  clearGraphSelection();

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit === true) {
    fitGraph();
  }

  return true;
}

/**
 * Remove currently selected node or edge.
 */
export function removeSelectedElement(options = {}) {
  const cy = getRequiredCy();
  const selected = cy.$(':selected');

  if (!selected || selected.length === 0) {
    return false;
  }

  selected.remove();

  updateNodeDegreeData(cy);
  updateStateFromCy(cy);
  clearGraphSelection();

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit === true) {
    fitGraph();
  }

  return true;
}

/**
 * Replace the whole graph using raw nodes/edges.
 */
export function replaceGraphData({ nodes = [], edges = [] } = {}, options = {}) {
  const cy = getRequiredCy();

  cy.elements().remove();

  const nodeElements = nodes.map((node) => ({
    group: 'nodes',
    data: normalizeNode(node),
  }));

  const edgeElements = edges.map((edge, index) => ({
    group: 'edges',
    data: normalizeEdge(edge, cy, index),
  }));

  cy.add([...nodeElements, ...edgeElements]);

  updateNodeDegreeData(cy);
  updateStateFromCy(cy);

  if (options.runLayout !== false) {
    applyLayout(cy);
  }

  if (options.fit !== false) {
    fitGraph();
  }

  return {
    nodes,
    edges,
  };
}

/**
 * Clear all transient "new" classes from graph elements.
 */
export function clearNewElementClasses() {
  const cy = getRequiredCy();

  cy.elements().removeClass('new-node');
  cy.elements().removeClass('new-edge');
}

/**
 * Add CSS class to specific nodes or edges.
 */
export function addClassToElements({ nodeIds = [], edgeIds = [], className }) {
  const cy = getRequiredCy();

  if (!className) return;

  nodeIds.forEach((id) => {
    const node = cy.getElementById(id);
    if (node && node.length > 0) {
      node.addClass(className);
    }
  });

  edgeIds.forEach((id) => {
    const edge = cy.getElementById(id);
    if (edge && edge.length > 0) {
      edge.addClass(className);
    }
  });
}

/**
 * Remove CSS class from specific nodes or edges.
 */
export function removeClassFromElements({ nodeIds = [], edgeIds = [], className }) {
  const cy = getRequiredCy();

  if (!className) return;

  nodeIds.forEach((id) => {
    const node = cy.getElementById(id);
    if (node && node.length > 0) {
      node.removeClass(className);
    }
  });

  edgeIds.forEach((id) => {
    const edge = cy.getElementById(id);
    if (edge && edge.length > 0) {
      edge.removeClass(className);
    }
  });
}

/**
 * Get current graph data from Cytoscape as app-friendly nodes/edges.
 */
export function exportCurrentGraphData() {
  const cy = getRequiredCy();
  return extractGraphDataFromCy(cy);
}

/* =========================
   Internal helpers
   ========================= */

function getRequiredCy() {
  const cy = getCyInstance();

  if (!cy) {
    throw new Error('Cytoscape instance is not initialized.');
  }

  return cy;
}

function validateNodeInput(node) {
  if (!node || !node.id || String(node.id).trim() === '') {
    throw new Error('Node must include a non-empty id.');
  }
}

function validateEdgeInput(edge, cy) {
  if (!edge || !edge.source || !edge.target) {
    throw new Error('Edge must include source and target.');
  }

  if (cy.getElementById(edge.source).length === 0) {
    throw new Error(`Source node "${edge.source}" does not exist.`);
  }

  if (cy.getElementById(edge.target).length === 0) {
    throw new Error(`Target node "${edge.target}" does not exist.`);
  }
}

function normalizeNode(node) {
  return {
    id: String(node.id).trim(),
    label: node.label ? String(node.label).trim() : String(node.id).trim(),
    group: node.group ? String(node.group).trim() : 'default',
    ...copyExtraNodeFields(node),
  };
}

function normalizeEdge(edge, cy, fallbackIndex = 0) {
  const source = String(edge.source).trim();
  const target = String(edge.target).trim();

  const edgeId =
    edge.id && String(edge.id).trim() !== ''
      ? String(edge.id).trim()
      : generateUniqueEdgeId(source, target, cy, fallbackIndex);

  const normalized = {
    id: edgeId,
    source,
    target,
    weight: edge.weight !== undefined ? Number(edge.weight) : 1,
    ...(edge.directed !== undefined ? { directed: Boolean(edge.directed) } : {}),
    ...copyExtraEdgeFields(edge),
  };

  if (Number.isNaN(normalized.weight)) {
    normalized.weight = 1;
  }

  return normalized;
}

function generateUniqueEdgeId(source, target, cy, fallbackIndex = 0) {
  let index = fallbackIndex;
  let candidate = `${source}->${target}-${index}`;

  while (cy.getElementById(candidate).length > 0) {
    index += 1;
    candidate = `${source}->${target}-${index}`;
  }

  return candidate;
}

function copyExtraNodeFields(node) {
  const extra = { ...node };
  delete extra.id;
  delete extra.label;
  delete extra.group;
  return extra;
}

function copyExtraEdgeFields(edge) {
  const extra = { ...edge };
  delete extra.id;
  delete extra.source;
  delete extra.target;
  delete extra.weight;
  delete extra.directed;
  return extra;
}

function updateNodeDegreeData(cy) {
  cy.nodes().forEach((node) => {
    const indegree = typeof node.indegree === 'function' ? node.indegree() : 0;
    const outdegree = typeof node.outdegree === 'function' ? node.outdegree() : 0;

    node.data({
      ...node.data(),
      degree: node.degree(),
      indegree,
      outdegree,
    });
  });
}

function updateStateFromCy(cy) {
  const { nodes, edges, elements } = extractGraphDataFromCy(cy);

  setGraphData({ nodes, edges });
  setGraphElements(elements);
}

function extractGraphDataFromCy(cy) {
  const nodes = cy.nodes().map((node) => {
    const data = { ...node.data() };
    return {
      id: data.id,
      label: data.label ?? data.id,
      group: data.group ?? 'default',
      ...stripNodeReservedFields(data),
    };
  });

  const edges = cy.edges().map((edge) => {
    const data = { ...edge.data() };
    return {
      id: data.id,
      source: data.source,
      target: data.target,
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.directed !== undefined ? { directed: data.directed } : {}),
      ...stripEdgeReservedFields(data),
    };
  });

  const elements = [
    ...nodes.map((node) => ({
      data: { ...node },
    })),
    ...edges.map((edge) => ({
      data: { ...edge },
    })),
  ];

  return { nodes, edges, elements };
}

function stripNodeReservedFields(data) {
  const extra = { ...data };
  delete extra.id;
  delete extra.label;
  delete extra.group;
  return extra;
}

function stripEdgeReservedFields(data) {
  const extra = { ...data };
  delete extra.id;
  delete extra.source;
  delete extra.target;
  delete extra.weight;
  delete extra.directed;
  return extra;
}