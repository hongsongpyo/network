// src/graph/cytoscapeInit.js

import cytoscape from 'cytoscape';
import { getFreshCytoscapeStyles } from './cytoscapeStyles.js';
import {
  setCyInstance,
  getCyInstance,
  setGraphLoaded,
  setSelectedElement,
  clearSelectedElement,
} from './graphState.js';

/**
 * Create and mount a Cytoscape instance.
 *
 * @param {Object} options
 * @param {HTMLElement} options.container - Graph mount container
 * @param {Array} [options.elements=[]] - Cytoscape element list
 * @param {boolean} [options.directed=false] - Whether the graph is directed
 * @param {Function|null} [options.onElementSelect=null] - Callback for selected node/edge
 * @param {Function|null} [options.onElementHover=null] - Callback for hover enter
 * @param {Function|null} [options.onElementHoverOut=null] - Callback for hover leave
 * @returns {cytoscape.Core}
 */
export function initCytoscape({
  container,
  elements = [],
  directed = false,
  onElementSelect = null,
  onElementHover = null,
  onElementHoverOut = null,
} = {}) {
  if (!container) {
    throw new Error('initCytoscape requires a valid container element.');
  }

  destroyCytoscape();

  const normalizedElements = normalizeElements(elements, directed);

  const cy = cytoscape({
    container,
    elements: normalizedElements,
    style: getFreshCytoscapeStyles(),
    layout: getDefaultLayout(),
    wheelSensitivity: 0.18,
    minZoom: 0.15,
    maxZoom: 3.5,
    boxSelectionEnabled: false,
    autoungrabify: false,
    autounselectify: false,
    selectionType: 'single',
  });

  bindBaseGraphEvents(cy, {
    onElementSelect,
    onElementHover,
    onElementHoverOut,
  });

  setCyInstance(cy);
  setGraphLoaded(normalizedElements.length > 0);

  runInitialPostProcessing(cy);

  return cy;
}

/**
 * Replace graph elements while keeping the current Cytoscape instance alive.
 *
 * @param {Array} elements
 * @param {Object} options
 * @param {boolean} [options.directed=false]
 * @param {boolean} [options.fit=true]
 */
export function loadGraphElements(elements = [], { directed = false, fit = true } = {}) {
  const cy = getCyInstance();

  if (!cy) {
    throw new Error('Cannot load graph elements before Cytoscape is initialized.');
  }

  const normalizedElements = normalizeElements(elements, directed);

  cy.elements().remove();
  cy.add(normalizedElements);

  runInitialPostProcessing(cy);

  if (fit) {
    applyLayout(cy);
    cy.fit(cy.elements(), 40);
    cy.center();
  }

  setGraphLoaded(normalizedElements.length > 0);
}

/**
 * Apply a layout to the existing graph.
 *
 * @param {cytoscape.Core} [cyInstance]
 * @param {Object} [layoutOptions={}]
 */
export function applyLayout(cyInstance = getCyInstance(), layoutOptions = {}) {
  const cy = cyInstance;

  if (!cy) return;

  const layout = cy.layout({
    ...getDefaultLayout(),
    ...layoutOptions,
  });

  layout.run();
}

/**
 * Re-apply current theme-dependent Cytoscape styles.
 */
export function refreshCytoscapeStyles() {
  const cy = getCyInstance();

  if (!cy) return;

  cy.style(getFreshCytoscapeStyles());
  cy.style().update();
}

/**
 * Zoom helpers
 */
export function zoomIn(step = 0.15) {
  const cy = getCyInstance();
  if (!cy) return;

  cy.zoom({
    level: Math.min(cy.maxZoom(), cy.zoom() + step),
    renderedPosition: {
      x: cy.width() / 2,
      y: cy.height() / 2,
    },
  });
}

export function zoomOut(step = 0.15) {
  const cy = getCyInstance();
  if (!cy) return;

  cy.zoom({
    level: Math.max(cy.minZoom(), cy.zoom() - step),
    renderedPosition: {
      x: cy.width() / 2,
      y: cy.height() / 2,
    },
  });
}

export function fitGraph(padding = 40) {
  const cy = getCyInstance();
  if (!cy) return;

  cy.fit(cy.elements(), padding);
}

export function resetGraphView(padding = 40) {
  const cy = getCyInstance();
  if (!cy) return;

  applyLayout(cy);
  cy.fit(cy.elements(), padding);
  cy.center();
}

/**
 * Selection / highlight helpers
 */
export function clearGraphSelection() {
  const cy = getCyInstance();
  if (!cy) return;

  cy.elements().unselect();
  cy.elements().removeClass('is-focused');
  clearSelectedElement();
}

export function highlightElementsByIds({
  nodeIds = [],
  edgeIds = [],
  dimOthers = false,
  highlightClass = 'filtered-highlight',
} = {}) {
  const cy = getCyInstance();
  if (!cy) return;

  cy.elements().removeClass(highlightClass);
  cy.elements().removeClass('dimmed');

  const nodeSet = new Set(nodeIds);
  const edgeSet = new Set(edgeIds);

  cy.nodes().forEach((node) => {
    if (nodeSet.has(node.id())) {
      node.addClass(highlightClass);
    } else if (dimOthers) {
      node.addClass('dimmed');
    }
  });

  cy.edges().forEach((edge) => {
    if (edgeSet.has(edge.id())) {
      edge.addClass(highlightClass);
    } else if (dimOthers) {
      edge.addClass('dimmed');
    }
  });
}

export function clearGraphHighlighting() {
  const cy = getCyInstance();
  if (!cy) return;

  cy.elements().removeClass('filtered-highlight');
  cy.elements().removeClass('dimmed');
  cy.elements().removeClass('is-focused');
  cy.elements().removeClass('path-node');
  cy.elements().removeClass('path-edge');
  cy.elements().removeClass('muted-edge');
}

/**
 * Destroy current Cytoscape instance safely.
 */
export function destroyCytoscape() {
  const existing = getCyInstance();

  if (existing) {
    existing.destroy();
    setCyInstance(null);
    setGraphLoaded(false);
  }
}

/* =========================
   Internal Helpers
   ========================= */

function bindBaseGraphEvents(
  cy,
  {
    onElementSelect = null,
    onElementHover = null,
    onElementHoverOut = null,
  } = {}
) {
  cy.on('tap', 'node, edge', (event) => {
    const element = event.target;
    const type = element.isNode() ? 'node' : 'edge';
    const data = element.data();

    cy.elements().removeClass('is-focused');
    element.addClass('is-focused');

    setSelectedElement({
      type,
      id: element.id(),
      data,
    });

    if (typeof onElementSelect === 'function') {
      onElementSelect({
        type,
        id: element.id(),
        data,
        element,
        cy,
      });
    }
  });

  cy.on('tap', (event) => {
    if (event.target === cy) {
      clearGraphSelection();

      if (typeof onElementSelect === 'function') {
        onElementSelect(null);
      }
    }
  });

  cy.on('mouseover', 'node, edge', (event) => {
    const element = event.target;

    if (typeof onElementHover === 'function') {
      onElementHover({
        type: element.isNode() ? 'node' : 'edge',
        id: element.id(),
        data: element.data(),
        element,
        cy,
        renderedPosition: event.renderedPosition,
        originalEvent: event.originalEvent,
      });
    }
  });

  cy.on('mouseout', 'node, edge', (event) => {
    const element = event.target;

    if (typeof onElementHoverOut === 'function') {
      onElementHoverOut({
        type: element.isNode() ? 'node' : 'edge',
        id: element.id(),
        data: element.data(),
        element,
        cy,
        renderedPosition: event.renderedPosition,
        originalEvent: event.originalEvent,
      });
    }
  });
}

function runInitialPostProcessing(cy) {
  enrichElementData(cy);
  applyDirectedEdgeClasses(cy);
  applyLayout(cy);
  cy.fit(cy.elements(), 40);
  cy.center();
}

/**
 * Add derived data fields that Cytoscape styles or UI can use immediately.
 * For now, degree is attached to nodes if missing.
 */
function enrichElementData(cy) {
  cy.nodes().forEach((node) => {
    const currentDegree = node.degree();
    const currentInDegree = node.indegree ? node.indegree() : 0;
    const currentOutDegree = node.outdegree ? node.outdegree() : 0;

    node.data({
      ...node.data(),
      degree: Number.isFinite(node.data('degree')) ? node.data('degree') : currentDegree,
      indegree: Number.isFinite(node.data('indegree')) ? node.data('indegree') : currentInDegree,
      outdegree: Number.isFinite(node.data('outdegree')) ? node.data('outdegree') : currentOutDegree,
    });
  });

  cy.edges().forEach((edge) => {
    edge.data({
      ...edge.data(),
      weight: Number.isFinite(edge.data('weight')) ? edge.data('weight') : 1,
    });
  });
}

function applyDirectedEdgeClasses(cy) {
  cy.edges().forEach((edge) => {
    if (edge.data('directed') === false) {
      edge.addClass('undirected');
    } else {
      edge.removeClass('undirected');
    }
  });
}

function normalizeElements(elements, directed = false) {
  return (elements || []).map((element) => {
    const data = element.data ?? {};

    // Node
    if (data.id && !Object.prototype.hasOwnProperty.call(data, 'source')) {
      return {
        ...element,
        data: {
          label: data.label ?? data.id,
          group: data.group ?? 'default',
          ...data,
        },
      };
    }

    // Edge
    return {
      ...element,
      data: {
        weight: 1,
        directed,
        ...data,
      },
    };
  });
}

function getDefaultLayout() {
  return {
    name: 'cose',
    animate: true,
    animationDuration: 350,
    fit: true,
    padding: 40,
    nodeRepulsion: 120000,
    idealEdgeLength: 100,
    edgeElasticity: 100,
    nestingFactor: 1.2,
    gravity: 1,
    numIter: 800,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0,
  };
}