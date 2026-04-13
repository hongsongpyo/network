// src/graph/graphState.js

const initialState = () => ({
  dataset: null,
  datasetMeta: {
    id: null,
    name: null,
    description: null,
    directed: false,
    weighted: false,
  },

  graph: {
    nodes: [],
    edges: [],
    elements: [],
  },

  cy: null,

  selection: {
    type: null, // 'node' | 'edge' | null
    id: null,
    data: null,
  },

  view: {
    theme: 'dark',
    filterMode: 'highlight', // 'highlight' | 'hide'
    graphType: 'undirected',
    weighted: false,
  },

  filters: [],

  metrics: {
    lastRunMetric: null,
    results: {},
  },

  ui: {
    isGraphLoaded: false,
    isLoading: false,
  },
});

let state = initialState();

/* =========================
   Core State Access
   ========================= */

export function getGraphState() {
  return state;
}

export function resetGraphState() {
  state = initialState();
  return state;
}

/* =========================
   Dataset
   ========================= */

export function setDataset(dataset) {
  if (!dataset) {
    throw new Error('setDataset(dataset) requires a valid dataset.');
  }

  state.dataset = dataset;
  state.datasetMeta = {
    id: dataset.id ?? null,
    name: dataset.name ?? null,
    description: dataset.description ?? null,
    directed: Boolean(dataset.directed),
    weighted: Boolean(dataset.weighted),
  };

  state.view.graphType = dataset.directed ? 'directed' : 'undirected';
  state.view.weighted = Boolean(dataset.weighted);

  state.graph.nodes = Array.isArray(dataset.nodes) ? [...dataset.nodes] : [];
  state.graph.edges = Array.isArray(dataset.edges) ? [...dataset.edges] : [];

  return state.dataset;
}

export function getDataset() {
  return state.dataset;
}

export function getDatasetMeta() {
  return state.datasetMeta;
}

/* =========================
   Graph Elements
   ========================= */

export function setGraphElements(elements) {
  state.graph.elements = Array.isArray(elements) ? [...elements] : [];
  state.ui.isGraphLoaded = state.graph.elements.length > 0;
  return state.graph.elements;
}

export function getGraphElements() {
  return state.graph.elements;
}

export function setGraphData({ nodes = [], edges = [] } = {}) {
  state.graph.nodes = [...nodes];
  state.graph.edges = [...edges];
  return {
    nodes: state.graph.nodes,
    edges: state.graph.edges,
  };
}

export function getGraphData() {
  return {
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    elements: state.graph.elements,
  };
}

/* =========================
   Cytoscape Instance
   ========================= */

export function setCyInstance(cyInstance) {
  state.cy = cyInstance ?? null;
  return state.cy;
}

export function getCyInstance() {
  return state.cy;
}

export function clearCyInstance() {
  state.cy = null;
}

/* =========================
   Selection
   ========================= */

export function setSelectedElement({ type = null, id = null, data = null } = {}) {
  state.selection = {
    type,
    id,
    data,
  };

  return state.selection;
}

export function getSelectedElement() {
  return state.selection;
}

export function clearSelectedElement() {
  state.selection = {
    type: null,
    id: null,
    data: null,
  };

  return state.selection;
}

/* =========================
   Theme / View
   ========================= */

export function setTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error('Theme must be either "dark" or "light".');
  }

  state.view.theme = theme;
  return state.view.theme;
}

export function getTheme() {
  return state.view.theme;
}

export function setFilterMode(mode) {
  if (mode !== 'highlight' && mode !== 'hide') {
    throw new Error('Filter mode must be either "highlight" or "hide".');
  }

  state.view.filterMode = mode;
  return state.view.filterMode;
}

export function getFilterMode() {
  return state.view.filterMode;
}

export function setGraphType(graphType) {
  if (graphType !== 'undirected' && graphType !== 'directed') {
    throw new Error('Graph type must be either "undirected" or "directed".');
  }

  state.view.graphType = graphType;
  return state.view.graphType;
}

export function getGraphType() {
  return state.view.graphType;
}

export function setWeightedMode(isWeighted) {
  state.view.weighted = Boolean(isWeighted);
  return state.view.weighted;
}

export function isWeightedMode() {
  return state.view.weighted;
}

export function getViewState() {
  return state.view;
}

/* =========================
   Filters
   ========================= */

export function setFilters(filters = []) {
  state.filters = Array.isArray(filters) ? [...filters] : [];
  return state.filters;
}

export function getFilters() {
  return state.filters;
}

export function addFilter(filter) {
  if (!filter) return state.filters;

  state.filters = [...state.filters, filter];
  return state.filters;
}

export function clearFilters() {
  state.filters = [];
  return state.filters;
}

/* =========================
   Metrics
   ========================= */

export function setMetricResult(metricKey, result) {
  if (!metricKey) {
    throw new Error('setMetricResult(metricKey, result) requires a metricKey.');
  }

  state.metrics.results[metricKey] = result;
  state.metrics.lastRunMetric = metricKey;

  return state.metrics.results[metricKey];
}

export function getMetricResult(metricKey) {
  return state.metrics.results[metricKey] ?? null;
}

export function getAllMetricResults() {
  return state.metrics.results;
}

export function getLastRunMetric() {
  return state.metrics.lastRunMetric;
}

export function clearMetricResults() {
  state.metrics.results = {};
  state.metrics.lastRunMetric = null;
}

/* =========================
   UI State
   ========================= */

export function setGraphLoaded(isLoaded) {
  state.ui.isGraphLoaded = Boolean(isLoaded);
  return state.ui.isGraphLoaded;
}

export function isGraphLoaded() {
  return state.ui.isGraphLoaded;
}

export function setLoading(isLoading) {
  state.ui.isLoading = Boolean(isLoading);
  return state.ui.isLoading;
}

export function isLoading() {
  return state.ui.isLoading;
}

export function getUiState() {
  return state.ui;
}

/* =========================
   Helpers
   ========================= */

export function getStateSnapshot() {
  return {
    dataset: state.dataset,
    datasetMeta: { ...state.datasetMeta },
    graph: {
      nodes: [...state.graph.nodes],
      edges: [...state.graph.edges],
      elements: [...state.graph.elements],
    },
    cy: state.cy,
    selection: { ...state.selection },
    view: { ...state.view },
    filters: [...state.filters],
    metrics: {
      lastRunMetric: state.metrics.lastRunMetric,
      results: { ...state.metrics.results },
    },
    ui: { ...state.ui },
  };
}