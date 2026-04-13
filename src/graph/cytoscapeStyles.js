// src/graph/cytoscapeStyles.js

function getCssVar(name, fallback = '') {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim() || fallback;
}

export function createCytoscapeStyles() {
  const colorText = getCssVar('--color-text', '#f5f7fb');
  const colorTextMuted = getCssVar('--color-text-muted', '#a9b1c6');

  const colorNode = getCssVar('--color-node', '#6ea8fe');
  const colorNodeHighlight = getCssVar('--color-node-highlight', '#7ef0c2');
  const colorNodeDim = getCssVar('--color-node-dim', 'rgba(255,255,255,0.2)');

  const colorEdge = getCssVar('--color-edge', '#7c8aa5');
  const colorEdgeHighlight = getCssVar('--color-edge-highlight', '#7ef0c2');
  const colorEdgeDim = getCssVar('--color-edge-dim', 'rgba(255,255,255,0.15)');

  const colorAccent = getCssVar('--color-accent', '#6ea8fe');
  const colorDanger = getCssVar('--color-danger', '#ff7b7b');
  const colorSuccess = getCssVar('--color-success', '#7ef0c2');
  const colorWarning = getCssVar('--color-warning', '#ffcc66');

  return [
    /**
     * Base node style
     */
    {
      selector: 'node',
      style: {
        'background-color': colorNode,
        label: 'data(label)',
        color: colorText,
        'font-size': 10,
        'font-weight': 600,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'none',
        'overlay-opacity': 0,
        'border-width': 1.5,
        'border-color': 'rgba(255,255,255,0.10)',
        width: 'mapData(degree, 0, 20, 22, 54)',
        height: 'mapData(degree, 0, 20, 22, 54)',
        'transition-property': 'background-color, border-color, opacity, width, height',
        'transition-duration': '180ms',
      },
    },

    /**
     * Base edge style
     */
    {
      selector: 'edge',
      style: {
        width: 'mapData(weight, 1, 10, 1.5, 6)',
        'line-color': colorEdge,
        'target-arrow-color': colorEdge,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        opacity: 0.88,
        'overlay-opacity': 0,
        label: '',
        'font-size': 9,
        color: colorTextMuted,
        'text-background-opacity': 0,
        'transition-property': 'line-color, target-arrow-color, opacity, width',
        'transition-duration': '180ms',
      },
    },

    /**
     * Undirected edge helper class
     */
    {
      selector: 'edge.undirected',
      style: {
        'target-arrow-shape': 'none',
      },
    },

    /**
     * Weighted edge labels
     */
    {
      selector: 'edge.show-weight',
      style: {
        label: 'data(weight)',
        'text-background-color': 'rgba(15, 23, 42, 0.72)',
        'text-background-opacity': 1,
        'text-background-padding': 3,
        'text-border-opacity': 0,
        'text-rotation': 'autorotate',
      },
    },

    /**
     * Selected node
     */
    {
      selector: 'node:selected',
      style: {
        'background-color': colorAccent,
        'border-width': 3,
        'border-color': '#ffffff',
        'z-index': 999,
      },
    },

    /**
     * Selected edge
     */
    {
      selector: 'edge:selected',
      style: {
        'line-color': colorAccent,
        'target-arrow-color': colorAccent,
        width: 5,
        'z-index': 999,
      },
    },

    /**
     * Hover-like / focus class
     */
    {
      selector: '.is-focused',
      style: {
        'border-width': 3,
        'border-color': '#ffffff',
        'z-index': 950,
      },
    },

    /**
     * Highlighted by filter or analysis
     */
    {
      selector: '.filtered-highlight',
      style: {
        'background-color': colorNodeHighlight,
        'line-color': colorEdgeHighlight,
        'target-arrow-color': colorEdgeHighlight,
        opacity: 1,
      },
    },

    /**
     * Dimmed elements when filters are active
     */
    {
      selector: '.dimmed',
      style: {
        opacity: 0.14,
      },
    },

    /**
     * Hidden class helper
     */
    {
      selector: '.is-hidden',
      style: {
        display: 'none',
      },
    },

    /**
     * Hub node styling
     */
    {
      selector: '.hub-node',
      style: {
        'background-color': colorWarning,
        'border-width': 2.5,
        'border-color': 'rgba(255,255,255,0.22)',
      },
    },

    /**
     * Bridge / high-betweenness node styling
     */
    {
      selector: '.bridge-node',
      style: {
        'background-color': colorSuccess,
        'border-width': 2.5,
        'border-color': 'rgba(255,255,255,0.22)',
      },
    },

    /**
     * Vulnerable / robustness target node styling
     */
    {
      selector: '.vulnerable-node',
      style: {
        'background-color': colorDanger,
        'border-width': 2.5,
        'border-color': 'rgba(255,255,255,0.22)',
      },
    },

    /**
     * Core node styling
     */
    {
      selector: '.core-node',
      style: {
        'background-color': colorAccent,
        'border-width': 3,
        'border-color': colorNodeHighlight,
      },
    },

    /**
     * Path node styling
     */
    {
      selector: '.path-node',
      style: {
        'background-color': colorSuccess,
        'border-width': 3,
        'border-color': '#ffffff',
      },
    },

    /**
     * Path edge styling
     */
    {
      selector: '.path-edge',
      style: {
        'line-color': colorSuccess,
        'target-arrow-color': colorSuccess,
        width: 5,
        opacity: 1,
      },
    },

    /**
     * Newly added node
     */
    {
      selector: '.new-node',
      style: {
        'background-color': '#ffffff',
        color: '#111827',
        'border-width': 3,
        'border-color': colorAccent,
      },
    },

    /**
     * Newly added edge
     */
    {
      selector: '.new-edge',
      style: {
        'line-style': 'dashed',
        'line-color': colorAccent,
        'target-arrow-color': colorAccent,
        width: 4,
      },
    },

    /**
     * Component coloring helpers
     */
    {
      selector: '.component-1',
      style: {
        'background-color': '#6ea8fe',
      },
    },
    {
      selector: '.component-2',
      style: {
        'background-color': '#7ef0c2',
      },
    },
    {
      selector: '.component-3',
      style: {
        'background-color': '#ffcc66',
      },
    },
    {
      selector: '.component-4',
      style: {
        'background-color': '#ff7b7b',
      },
    },

    /**
     * Group-based fallback examples
     */
    {
      selector: 'node[group = "hub"]',
      style: {
        'background-color': colorWarning,
      },
    },
    {
      selector: 'node[group = "leaf"]',
      style: {
        'background-color': colorNode,
      },
    },

    /**
     * Edge class for de-emphasized non-path edges
     */
    {
      selector: '.muted-edge',
      style: {
        opacity: 0.1,
      },
    },
  ];
}

/**
 * Rebuildable style getter.
 * Useful when theme changes and Cytoscape styles must be refreshed.
 */
export function getFreshCytoscapeStyles() {
  return createCytoscapeStyles();
}