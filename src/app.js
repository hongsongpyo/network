// src/app.js

import { getDefaultSampleDataset, toCytoscapeElements } from './data/sampleDatasets.js';
import { parseGraphFile, datasetToCytoscapeElements } from './data/parser.js';

import {
  initCytoscape,
  loadGraphElements,
  zoomIn,
  zoomOut,
  fitGraph,
  resetGraphView,
  refreshCytoscapeStyles,
  clearGraphHighlighting,
} from './graph/cytoscapeInit.js';

import {
  getCyInstance,
  setDataset,
  getDataset,
  getDatasetMeta,
  setGraphElements,
  setGraphLoaded,
  setTheme,
  getTheme,
  setFilterMode as setGraphFilterMode,
  getFilterMode as getGraphFilterMode,
} from './graph/graphState.js';

import { initFilterUI } from './filters/filterUI.js';

import { runBasicStats } from './metrics/basicStats.js';
import { runConnectedness } from './metrics/connectedness.js';
import { runShortestPath } from './metrics/shortestPath.js';
import { runClustering } from './metrics/clustering.js';
import { runCentrality } from './metrics/centrality.js';
import { runAssortativity } from './metrics/assortativity.js';
import { runCentralityDistribution } from './metrics/centralityDistribution.js';
import { runSquaredDegree } from './metrics/squaredDegree.js';
import { runFriendshipParadox } from './metrics/friendshipParadox.js';
import { runUltraSmallWorld } from './metrics/ultrasmallworld.js';
import { runRobustness } from './metrics/robustness.js';
import { runCoreDecomposition } from './metrics/coreDecomposition.js';

/* =========================
   App bootstrap
   ========================= */

export function initApp(root) {
  if (!root) {
    throw new Error('initApp(root) requires a valid root element.');
  }

  root.innerHTML = `
    <div class="app-shell" data-theme="dark">
      <header class="app-header" id="app-header">
        <div class="app-header__left">
          <div class="app-logo">Network Analysis Studio</div>
          <div class="app-subtitle">Interactive Graph Explorer for GitHub Pages</div>
        </div>

        <div class="app-header__right" id="header-actions">
          <button class="btn btn--ghost" id="theme-toggle-btn" type="button">Theme</button>
          <button class="btn btn--primary" id="load-sample-btn" type="button">Load Sample</button>
        </div>
      </header>

      <main class="app-main">
        <aside class="app-sidebar" id="app-sidebar">
          <section class="panel" id="dataset-panel">
            <div class="panel__header">
              <h2 class="panel__title">Dataset</h2>
            </div>

            <div class="panel__body">
              <label class="field">
                <span class="field__label">Upload file</span>
                <input class="input" id="file-input" type="file" accept=".json,.csv,.txt,.edges,.edgelist" />
              </label>

              <label class="field">
                <span class="field__label">Graph type</span>
                <select class="select" id="graph-type-select">
                  <option value="undirected">Undirected</option>
                  <option value="directed">Directed</option>
                </select>
              </label>

              <label class="checkbox-row">
                <input id="weighted-toggle" type="checkbox" />
                <span>Weighted graph</span>
              </label>
            </div>
          </section>

          <section class="panel" id="filters-panel">
            <div class="panel__header">
              <h2 class="panel__title">Filters</h2>
            </div>

            <div class="panel__body" id="filters-panel-body"></div>
          </section>

          <section class="panel" id="edit-panel">
            <div class="panel__header">
              <h2 class="panel__title">Graph Editing</h2>
            </div>

            <div class="panel__body">
              <p class="panel__placeholder">
                Graph editing UI can be connected next. Current build focuses on loading, analysis, and filtering.
              </p>
            </div>
          </section>

          <section class="panel" id="metrics-menu-panel">
            <div class="panel__header">
              <h2 class="panel__title">Metrics</h2>
            </div>

            <div class="panel__body">
              <div class="metric-list">
                <button class="btn btn--secondary metric-btn" data-metric="basicStats" type="button">Basic Stats</button>
                <button class="btn btn--secondary metric-btn" data-metric="connectedness" type="button">Connectedness</button>
                <button class="btn btn--secondary metric-btn" data-metric="shortestPath" type="button">Shortest Path</button>
                <button class="btn btn--secondary metric-btn" data-metric="clustering" type="button">Clustering</button>
                <button class="btn btn--secondary metric-btn" data-metric="centrality" type="button">Centrality</button>
                <button class="btn btn--secondary metric-btn" data-metric="assortativity" type="button">Assortativity</button>
                <button class="btn btn--secondary metric-btn" data-metric="centralityDistribution" type="button">Centrality Distribution</button>
                <button class="btn btn--secondary metric-btn" data-metric="squaredDegree" type="button">Squared Degree</button>
                <button class="btn btn--secondary metric-btn" data-metric="friendshipParadox" type="button">Friendship Paradox</button>
                <button class="btn btn--secondary metric-btn" data-metric="ultrasmallworld" type="button">Ultra-small World</button>
                <button class="btn btn--secondary metric-btn" data-metric="robustness" type="button">Robustness</button>
                <button class="btn btn--secondary metric-btn" data-metric="coreDecomposition" type="button">Core Decomposition</button>
              </div>
            </div>
          </section>
        </aside>

        <section class="app-canvas">
          <div class="graph-toolbar panel panel--toolbar" id="graph-toolbar">
            <div class="toolbar-group">
              <button class="btn btn--ghost" id="zoom-in-btn" type="button">Zoom In</button>
              <button class="btn btn--ghost" id="zoom-out-btn" type="button">Zoom Out</button>
              <button class="btn btn--ghost" id="fit-btn" type="button">Fit</button>
              <button class="btn btn--ghost" id="reset-view-btn" type="button">Reset View</button>
            </div>

            <div class="toolbar-group">
              <button class="btn btn--ghost" id="highlight-mode-btn" type="button">Highlight Mode</button>
              <button class="btn btn--ghost" id="hide-mode-btn" type="button">Hide Mode</button>
            </div>
          </div>

          <div class="graph-stage" id="graph-stage">
            <div class="graph-stage__overlay" id="graph-empty-state">
              <div class="empty-state-card">
                <h2 class="empty-state-card__title">No graph loaded</h2>
                <p class="empty-state-card__text">
                  Upload a dataset or load a sample network to begin analysis.
                </p>
              </div>
            </div>

            <div class="graph-container" id="graph-container"></div>
            <div class="graph-tooltip" id="graph-tooltip" hidden></div>
          </div>

          <div class="bottom-panel panel" id="activity-panel">
            <div class="panel__header">
              <h2 class="panel__title">Activity / Change Log</h2>
            </div>

            <div class="panel__body">
              <ul class="activity-log" id="activity-log">
                <li class="activity-log__item">App initialized.</li>
              </ul>
            </div>
          </div>
        </section>

        <aside class="app-inspector" id="app-inspector">
          <section class="panel" id="summary-panel">
            <div class="panel__header">
              <h2 class="panel__title">Summary</h2>
            </div>

            <div class="panel__body" id="summary-panel-body">
              <p class="panel__placeholder">Dataset summary and quick statistics will appear here.</p>
            </div>
          </section>

          <section class="panel" id="detail-panel">
            <div class="panel__header">
              <h2 class="panel__title">Selected Element</h2>
            </div>

            <div class="panel__body" id="detail-panel-body">
              <p class="panel__placeholder">Hover or click a node / edge to inspect its details.</p>
            </div>
          </section>

          <section class="panel" id="metric-result-panel">
            <div class="panel__header">
              <h2 class="panel__title">Metric Results</h2>
            </div>

            <div class="panel__body" id="metric-result-body">
              <p class="panel__placeholder">Choose a metric from the left panel to run analysis.</p>
            </div>
          </section>
        </aside>
      </main>
    </div>
  `;

  const refs = createAppRefs(root);
  setInitialAppState(refs);
  bindBaseEvents(refs);
  mountFilterUI(refs);

  appendActivity(refs.activityLog, 'UI mounted.');
}

/* =========================
   Refs / initial state
   ========================= */

function createAppRefs(root) {
  return {
    root,
    shell: root.querySelector('.app-shell'),
    graphContainer: root.querySelector('#graph-container'),
    graphEmptyState: root.querySelector('#graph-empty-state'),
    graphTooltip: root.querySelector('#graph-tooltip'),

    summaryPanelBody: root.querySelector('#summary-panel-body'),
    detailPanelBody: root.querySelector('#detail-panel-body'),
    metricResultBody: root.querySelector('#metric-result-body'),
    activityLog: root.querySelector('#activity-log'),

    themeToggleButton: root.querySelector('#theme-toggle-btn'),
    loadSampleButton: root.querySelector('#load-sample-btn'),
    fileInput: root.querySelector('#file-input'),
    graphTypeSelect: root.querySelector('#graph-type-select'),
    weightedToggle: root.querySelector('#weighted-toggle'),

    zoomInButton: root.querySelector('#zoom-in-btn'),
    zoomOutButton: root.querySelector('#zoom-out-btn'),
    fitButton: root.querySelector('#fit-btn'),
    resetViewButton: root.querySelector('#reset-view-btn'),
    highlightModeButton: root.querySelector('#highlight-mode-btn'),
    hideModeButton: root.querySelector('#hide-mode-btn'),

    metricButtons: root.querySelectorAll('.metric-btn'),
    filtersPanelBody: root.querySelector('#filters-panel-body'),
  };
}

function setInitialAppState(refs) {
  refs.shell.dataset.theme = 'dark';
  setTheme('dark');
  setGraphFilterMode('highlight');

  refs.summaryPanelBody.innerHTML = `
    <div class="info-stack">
      <div class="info-row"><span class="info-label">Nodes</span><span class="info-value">-</span></div>
      <div class="info-row"><span class="info-label">Edges</span><span class="info-value">-</span></div>
      <div class="info-row"><span class="info-label">Density</span><span class="info-value">-</span></div>
      <div class="info-row"><span class="info-label">Graph Type</span><span class="info-value">-</span></div>
    </div>
  `;

  refs.detailPanelBody.innerHTML = `
    <div class="detail-placeholder">
      <p>No node or edge selected yet.</p>
    </div>
  `;

  refs.metricResultBody.innerHTML = `
    <div class="result-placeholder">
      <h3 class="result-placeholder__title">Ready for analysis</h3>
      <p class="result-placeholder__text">
        Select a metric from the left menu to display results here.
      </p>
    </div>
  `;

  updateGraphEmptyState(refs, true, 'Upload a dataset or load a sample network to begin analysis.');
  updateModeButtons(refs);
}

/* =========================
   Events
   ========================= */

function bindBaseEvents(refs) {
  refs.themeToggleButton?.addEventListener('click', () => {
    const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    refs.shell.dataset.theme = nextTheme;
    refreshCytoscapeStyles();
    updateModeButtons(refs);
    appendActivity(refs.activityLog, `Theme changed to ${nextTheme}.`);
  });

  refs.loadSampleButton?.addEventListener('click', async () => {
    try {
      const dataset = getDefaultSampleDataset();
      await loadDatasetIntoApp(refs, dataset);
      appendActivity(refs.activityLog, `Sample dataset loaded: ${dataset.name}`);
    } catch (error) {
      appendActivity(refs.activityLog, `Failed to load sample: ${error.message}`);
    }
  });

  refs.fileInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataset = await parseGraphFile(file, {
        directed: refs.graphTypeSelect?.value === 'directed',
        weighted: refs.weightedToggle?.checked === true,
      });

      await loadDatasetIntoApp(refs, dataset);
      appendActivity(refs.activityLog, `Uploaded dataset loaded: ${file.name}`);
    } catch (error) {
      appendActivity(refs.activityLog, `File parse error: ${error.message}`);
      updateGraphEmptyState(refs, true, `Failed to parse file: ${error.message}`);
    }
  });

  refs.graphTypeSelect?.addEventListener('change', () => {
    appendActivity(refs.activityLog, `Graph type set to ${refs.graphTypeSelect.value}.`);
  });

  refs.weightedToggle?.addEventListener('change', () => {
    appendActivity(
      refs.activityLog,
      `Weighted mode ${refs.weightedToggle.checked ? 'enabled' : 'disabled'}.`
    );
  });

  refs.zoomInButton?.addEventListener('click', () => zoomIn());
  refs.zoomOutButton?.addEventListener('click', () => zoomOut());
  refs.fitButton?.addEventListener('click', () => fitGraph());
  refs.resetViewButton?.addEventListener('click', () => resetGraphView());

  refs.highlightModeButton?.addEventListener('click', () => {
    setGraphFilterMode('highlight');
    updateModeButtons(refs);
    rerunFiltersIfAvailable(refs);
    appendActivity(refs.activityLog, 'Filter display mode set to highlight.');
  });

  refs.hideModeButton?.addEventListener('click', () => {
    setGraphFilterMode('hide');
    updateModeButtons(refs);
    rerunFiltersIfAvailable(refs);
    appendActivity(refs.activityLog, 'Filter display mode set to hide.');
  });

  refs.metricButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const metricKey = button.dataset.metric ?? 'unknown';
      setActiveMetricButton(refs.metricButtons, button);
      await runMetricByKey(metricKey, refs);
    });
  });
}

/* =========================
   Dataset / graph load
   ========================= */

async function loadDatasetIntoApp(refs, dataset) {
  setDataset(dataset);

  refs.graphTypeSelect.value = dataset.directed ? 'directed' : 'undirected';
  refs.weightedToggle.checked = Boolean(dataset.weighted);

  const elements =
    typeof datasetToCytoscapeElements === 'function'
      ? datasetToCytoscapeElements(dataset)
      : toCytoscapeElements(dataset);

  setGraphElements(elements);
  setGraphLoaded(elements.length > 0);

  if (!window.__NETWORK_STUDIO_CY_INITIALIZED__) {
    initCytoscape({
      container: refs.graphContainer,
      elements,
      directed: dataset.directed,
      onElementSelect: (payload) => handleElementSelect(payload, refs),
      onElementHover: (payload) => handleElementHover(payload, refs),
      onElementHoverOut: () => hideTooltip(refs),
    });
    window.__NETWORK_STUDIO_CY_INITIALIZED__ = true;
  } else {
    loadGraphElements(elements, {
      directed: dataset.directed,
      fit: true,
    });
  }

  clearAppliedFilterVisuals();
  updateGraphEmptyState(refs, false);
  updateSummaryPanel(refs, dataset);
  updateDetailPanelEmpty(refs);

  mountFilterUI(refs, {
    directed: dataset.directed,
    weighted: dataset.weighted,
  });
}

/* =========================
   Filters
   ========================= */

let filterUiController = null;

function mountFilterUI(refs, context = {}) {
  if (!refs.filtersPanelBody) return;

  filterUiController = initFilterUI({
    container: refs.filtersPanelBody,
    getGraphData: () => {
      const dataset = getDataset();
      return {
        nodes: enrichNodesForFiltering(dataset),
        edges: enrichEdgesForFiltering(dataset),
      };
    },
    onFilterApplied: ({ raw, display }) => {
      applyFilterResultToGraph(raw);
      renderMetricLikeDisplay(refs.metricResultBody, display);
      appendActivity(
        refs.activityLog,
        `Filters applied: ${raw.summary.matchedNodeCount}/${raw.summary.nodeCount} nodes matched.`
      );
    },
    directed: context.directed ?? getDatasetMeta().directed ?? false,
    weighted: context.weighted ?? getDatasetMeta().weighted ?? false,
  });
}

function rerunFiltersIfAvailable(refs) {
  if (!filterUiController || typeof filterUiController.run !== 'function') {
    return;
  }

  filterUiController.run();
}

/* =========================
   Filter -> Cytoscape visual application
   ========================= */

function applyFilterResultToGraph(filterResult) {
  const cy = getCyInstance();
  if (!cy) return;

  clearAppliedFilterVisuals();

  if (!filterResult || !filterResult.enabled) {
    return;
  }

  const actions = filterResult.actions ?? {};

  applyClassToIds(cy, actions.highlightNodeIds, 'node', 'filtered-highlight');
  applyClassToIds(cy, actions.highlightEdgeIds, 'edge', 'filtered-highlight');

  applyClassToIds(cy, actions.dimNodeIds, 'node', 'dimmed');
  applyClassToIds(cy, actions.dimEdgeIds, 'edge', 'dimmed');

  applyClassToIds(cy, actions.hideNodeIds, 'node', 'is-hidden');
  applyClassToIds(cy, actions.hideEdgeIds, 'edge', 'is-hidden');

  /**
   * If a node is hidden, its incident edges should also disappear visually.
   * Cytoscape often hides incident rendering already when node hidden,
   * but we explicitly hide them for consistency.
   */
  (actions.hideNodeIds || []).forEach((nodeId) => {
    const node = cy.getElementById(nodeId);
    if (node && node.length > 0) {
      node.connectedEdges().addClass('is-hidden');
    }
  });
}

function clearAppliedFilterVisuals() {
  const cy = getCyInstance();
  if (!cy) return;

  clearGraphHighlighting();
  cy.elements().removeClass('is-hidden');
}

function applyClassToIds(cy, ids = [], elementType, className) {
  const safeIds = Array.isArray(ids) ? ids : [];

  safeIds.forEach((id) => {
    const el = cy.getElementById(id);
    if (!el || el.length === 0) return;

    if (elementType === 'node' && el.isNode()) {
      el.addClass(className);
    }

    if (elementType === 'edge' && el.isEdge()) {
      el.addClass(className);
    }
  });
}

/* =========================
   Metric execution
   ========================= */

async function runMetricByKey(metricKey, refs) {
  const dataset = getDataset();

  if (!dataset) {
    refs.metricResultBody.innerHTML = `
      <div class="result-card">
        <div class="result-card__header">
          <h3 class="result-card__title">No dataset loaded</h3>
        </div>
        <div class="result-card__body">
          <p class="result-card__text">Load a sample or upload a file first.</p>
        </div>
      </div>
    `;
    return;
  }

  const graphInput = {
    nodes: enrichNodesForMetrics(dataset),
    edges: enrichEdgesForMetrics(dataset),
    directed: dataset.directed,
    weighted: dataset.weighted,
  };

  let result = null;

  switch (metricKey) {
    case 'basicStats':
      result = runBasicStats(graphInput);
      updateSummaryFromBasicStats(refs, dataset, result.raw);
      break;

    case 'connectedness':
      result = runConnectedness(graphInput);
      break;

    case 'shortestPath':
      result = runShortestPath(graphInput, {
        useWeights: dataset.weighted,
      });
      break;

    case 'clustering':
      result = runClustering(graphInput);
      break;

    case 'centrality':
      result = runCentrality(graphInput);
      break;

    case 'assortativity':
      result = runAssortativity(graphInput);
      break;

    case 'centralityDistribution': {
      const centrality = runCentrality(graphInput);
      result = runCentralityDistribution(centrality.raw, {
        binCount: 10,
        topK: 5,
      });
      break;
    }

    case 'squaredDegree':
      result = runSquaredDegree(graphInput);
      break;

    case 'friendshipParadox':
      result = runFriendshipParadox(graphInput);
      break;

    case 'ultrasmallworld': {
      const shortestPath = runShortestPath(graphInput, {
        useWeights: dataset.weighted,
      });
      const squaredDegree = runSquaredDegree(graphInput);
      const centrality = runCentrality(graphInput);

      result = runUltraSmallWorld({
        shortestPathSummary: shortestPath.raw.summary,
        squaredDegreeSummary: squaredDegree.raw.summary,
        centralitySummary: centrality.raw.summary,
      });
      break;
    }

    case 'robustness':
      result = runRobustness(graphInput, {
        stepRatio: 0.1,
        randomTrials: 10,
        randomSeed: 42,
      });
      break;

    case 'coreDecomposition':
      result = runCoreDecomposition(graphInput);
      break;

    default:
      refs.metricResultBody.innerHTML = `
        <div class="result-card">
          <div class="result-card__header">
            <h3 class="result-card__title">Unknown metric</h3>
          </div>
          <div class="result-card__body">
            <p class="result-card__text">Metric key: ${metricKey}</p>
          </div>
        </div>
      `;
      return;
  }

  renderMetricLikeDisplay(refs.metricResultBody, result.display);
  appendActivity(refs.activityLog, `Metric executed: ${metricKey}`);
}

/* =========================
   Selection / tooltip
   ========================= */

function handleElementSelect(payload, refs) {
  if (!payload) {
    updateDetailPanelEmpty(refs);
    return;
  }

  const { type, id, data } = payload;

  refs.detailPanelBody.innerHTML = `
    <div class="detail-stack">
      <div class="detail-card">
        <div class="detail-card__title">${type === 'node' ? 'Node' : 'Edge'}: ${escapeHtml(id)}</div>
        <div class="detail-card__body">
          <div class="stat-list">
            ${Object.entries(data)
              .map(([key, value]) => {
                return `
                  <div class="stat-item">
                    <div class="stat-item__label">${escapeHtml(key)}</div>
                    <div class="stat-item__value">${escapeHtml(String(value))}</div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleElementHover(payload, refs) {
  if (!payload || !refs.graphTooltip) return;

  const { type, id, data, renderedPosition } = payload;

  refs.graphTooltip.innerHTML = `
    <div class="graph-tooltip__title">${escapeHtml(id)}</div>
    <div class="graph-tooltip__subtitle">${type}</div>
    <div class="graph-tooltip__section">
      ${Object.entries(data)
        .slice(0, 8)
        .map(([key, value]) => {
          return `
            <div class="graph-tooltip__row">
              <div class="graph-tooltip__label">${escapeHtml(key)}</div>
              <div class="graph-tooltip__value">${escapeHtml(String(value))}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  refs.graphTooltip.hidden = false;
  refs.graphTooltip.style.left = `${Math.min(renderedPosition.x + 14, refs.graphContainer.clientWidth - 220)}px`;
  refs.graphTooltip.style.top = `${Math.min(renderedPosition.y + 14, refs.graphContainer.clientHeight - 180)}px`;
}

function hideTooltip(refs) {
  if (!refs.graphTooltip) return;
  refs.graphTooltip.hidden = true;
}

/* =========================
   Summary rendering
   ========================= */

function updateSummaryPanel(refs, dataset) {
  const nodeCount = dataset?.nodes?.length ?? 0;
  const edgeCount = dataset?.edges?.length ?? 0;
  const density = computeQuickDensity(nodeCount, edgeCount, dataset?.directed);

  refs.summaryPanelBody.innerHTML = `
    <div class="info-stack">
      <div class="info-row"><span class="info-label">Nodes</span><span class="info-value">${nodeCount}</span></div>
      <div class="info-row"><span class="info-label">Edges</span><span class="info-value">${edgeCount}</span></div>
      <div class="info-row"><span class="info-label">Density</span><span class="info-value">${formatNumber(density, 4)}</span></div>
      <div class="info-row"><span class="info-label">Graph Type</span><span class="info-value">${dataset?.directed ? 'Directed' : 'Undirected'}</span></div>
      <div class="info-row"><span class="info-label">Weighted</span><span class="info-value">${dataset?.weighted ? 'Yes' : 'No'}</span></div>
    </div>
  `;
}

function updateSummaryFromBasicStats(refs, dataset, basicStatsRaw) {
  const s = basicStatsRaw.summary;

  refs.summaryPanelBody.innerHTML = `
    <div class="info-stack">
      <div class="info-row"><span class="info-label">Nodes</span><span class="info-value">${s.nodeCount}</span></div>
      <div class="info-row"><span class="info-label">Edges</span><span class="info-value">${s.edgeCount}</span></div>
      <div class="info-row"><span class="info-label">Density</span><span class="info-value">${formatNumber(s.density, 4)}</span></div>
      <div class="info-row"><span class="info-label">Avg Degree</span><span class="info-value">${formatNumber(s.averageDegree, 3)}</span></div>
      <div class="info-row"><span class="info-label">Max Degree</span><span class="info-value">${s.maxDegree}</span></div>
      <div class="info-row"><span class="info-label">Graph Type</span><span class="info-value">${dataset?.directed ? 'Directed' : 'Undirected'}</span></div>
    </div>
  `;
}

function updateDetailPanelEmpty(refs) {
  refs.detailPanelBody.innerHTML = `
    <div class="detail-placeholder">
      <p>No node or edge selected yet.</p>
    </div>
  `;
}

/* =========================
   Generic result renderer
   ========================= */

function renderMetricLikeDisplay(container, display) {
  const metricsHtml = (display.metrics || [])
    .map((metric) => {
      return `
        <div class="result-metric">
          <div class="result-metric__label">${escapeHtml(metric.label)}</div>
          <div class="result-metric__value">${escapeHtml(String(metric.value))}</div>
        </div>
      `;
    })
    .join('');

  const sectionsHtml = (display.sections || [])
    .map((section) => {
      return `
        <div class="analysis-card">
          <div class="analysis-card__title">${escapeHtml(section.title)}</div>
          <div class="analysis-card__body">
            <div class="stat-list">
              ${(section.items || [])
                .map((item) => {
                  return `
                    <div class="stat-item">
                      <div class="stat-item__label">${escapeHtml(item.label)}</div>
                      <div class="stat-item__value">${escapeHtml(String(item.value))}</div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const interpretationHtml = (display.interpretation || [])
    .map((line) => `<p class="result-card__text">${escapeHtml(line)}</p>`)
    .join('');

  container.innerHTML = `
    <div class="result-stack">
      <div class="analysis-card analysis-card--accent">
        <div class="analysis-card__title">${escapeHtml(display.title ?? 'Result')}</div>
        <div class="analysis-card__body">
          <div class="result-grid">${metricsHtml}</div>
        </div>
      </div>

      <div class="analysis-card">
        <div class="analysis-card__title">Interpretation</div>
        <div class="analysis-card__body">
          ${interpretationHtml || '<p class="result-card__text">No interpretation available.</p>'}
        </div>
      </div>

      ${sectionsHtml}
    </div>
  `;
}

/* =========================
   Helpers
   ========================= */

function updateGraphEmptyState(refs, isVisible, message = '') {
  if (!refs.graphEmptyState) return;

  if (isVisible) {
    refs.graphEmptyState.classList.remove('is-hidden');
    if (message) {
      refs.graphEmptyState.innerHTML = `
        <div class="empty-state-card">
          <h2 class="empty-state-card__title">No graph loaded</h2>
          <p class="empty-state-card__text">${escapeHtml(message)}</p>
        </div>
      `;
    }
  } else {
    refs.graphEmptyState.classList.add('is-hidden');
  }
}

function updateModeButtons(refs) {
  const mode = getGraphFilterMode();
  refs.highlightModeButton?.classList.toggle('is-active', mode === 'highlight');
  refs.hideModeButton?.classList.toggle('is-active', mode === 'hide');
}

function setActiveMetricButton(buttons, activeButton) {
  buttons.forEach((button) => button.classList.remove('is-active'));
  activeButton.classList.add('is-active');
}

function appendActivity(activityLogElement, message) {
  if (!activityLogElement) return;

  const item = document.createElement('li');
  item.className = 'activity-log__item';
  item.textContent = `${getTimeLabel()} - ${message}`;
  activityLogElement.prepend(item);
}

function getTimeLabel() {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function computeQuickDensity(nodeCount, edgeCount, directed) {
  if (!nodeCount || nodeCount <= 1) return 0;
  return directed
    ? edgeCount / (nodeCount * (nodeCount - 1))
    : (2 * edgeCount) / (nodeCount * (nodeCount - 1));
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return Number(value).toFixed(digits);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* =========================
   Data enrichment
   ========================= */

function enrichNodesForMetrics(dataset) {
  if (!dataset?.nodes) return [];
  return dataset.nodes.map((node) => ({ ...node }));
}

function enrichEdgesForMetrics(dataset) {
  if (!dataset?.edges) return [];
  return dataset.edges.map((edge, index) => ({
    id: edge.id ?? `${edge.source}->${edge.target}-${index}`,
    ...edge,
  }));
}

function enrichNodesForFiltering(dataset) {
  if (!dataset?.nodes) return [];

  const graphInput = {
    nodes: enrichNodesForMetrics(dataset),
    edges: enrichEdgesForMetrics(dataset),
    directed: dataset.directed,
    weighted: dataset.weighted,
  };

  const basic = runBasicStats(graphInput).raw;
  const clustering = runClustering(graphInput).raw;
  const centrality = runCentrality(graphInput).raw;
  const friendship = runFriendshipParadox(graphInput).raw;
  const core = runCoreDecomposition(graphInput).raw;

  return dataset.nodes.map((node) => {
    const id = node.id;

    return {
      ...node,
      degree: basic.maps.degree[id] ?? 0,
      indegree: basic.maps.inDegree?.[id] ?? 0,
      outdegree: basic.maps.outDegree?.[id] ?? 0,
      strength: basic.maps.strength?.[id] ?? null,
      degreeCentrality: centrality.maps.degreeCentrality?.[id] ?? 0,
      closenessCentrality: centrality.maps.closenessCentrality?.[id] ?? 0,
      betweennessCentrality: centrality.maps.betweennessCentrality?.[id] ?? 0,
      clusteringCoefficient: clustering.maps.clusteringCoefficient?.[id] ?? null,
      coreness: core.maps.coreness?.[id] ?? 0,
      averageNeighborDegree: friendship.maps.averageNeighborDegreeByNode?.[id] ?? null,
      triangleCount: clustering.maps.triangleCount?.[id] ?? 0,
    };
  });
}

function enrichEdgesForFiltering(dataset) {
  if (!dataset?.edges) return [];

  return dataset.edges.map((edge, index) => ({
    id: edge.id ?? `${edge.source}->${edge.target}-${index}`,
    weight: edge.weight ?? 1,
    source: edge.source,
    target: edge.target,
    ...edge,
  }));
}