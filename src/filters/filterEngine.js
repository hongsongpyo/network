// src/filters/filterEngine.js

import {
  getFilterDefinitionByField,
  getFilterOperatorById,
} from './filterDefinitions.js';

/**
 * Filter engine
 *
 * Responsibilities:
 * - evaluate rules against node / edge data
 * - compute matched node / edge ids
 * - support highlight / hide mode
 * - produce UI-friendly filter result summary
 */

/* =========================
   Public API
   ========================= */

/**
 * Apply filters to graph data.
 *
 * @param {Object} params
 * @param {Array} params.nodes
 * @param {Array} params.edges
 * @param {Array} params.rules
 * @param {string} [params.mode='highlight'] - 'highlight' | 'hide'
 * @param {boolean} [params.enabled=true]
 * @returns {Object}
 */
export function applyFilters({
  nodes = [],
  edges = [],
  rules = [],
  mode = 'highlight',
  enabled = true,
} = {}) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeRules = Array.isArray(rules) ? rules.filter((rule) => rule?.enabled !== false) : [];

  if (!enabled || safeRules.length === 0) {
    return createNoFilterResult(safeNodes, safeEdges, mode);
  }

  const nodeRules = safeRules.filter((rule) => rule.target === 'node');
  const edgeRules = safeRules.filter((rule) => rule.target === 'edge');

  const matchedNodes = safeNodes.filter((node) => evaluateRuleSet(node, nodeRules, 'node'));
  const matchedEdges = safeEdges.filter((edge) => evaluateRuleSet(edge, edgeRules, 'edge'));

  const matchedNodeIds = matchedNodes.map((node) => node.id);
  const matchedEdgeIds = matchedEdges.map((edge) => edge.id);

  const result = {
    enabled: true,
    mode: normalizeMode(mode),

    rules: safeRules,

    matched: {
      nodes: matchedNodes,
      edges: matchedEdges,
      nodeIds: matchedNodeIds,
      edgeIds: matchedEdgeIds,
    },

    unmatched: {
      nodes: safeNodes.filter((node) => !matchedNodeIds.includes(node.id)),
      edges: safeEdges.filter((edge) => !matchedEdgeIds.includes(edge.id)),
      nodeIds: safeNodes
        .map((node) => node.id)
        .filter((id) => !matchedNodeIds.includes(id)),
      edgeIds: safeEdges
        .map((edge) => edge.id)
        .filter((id) => !matchedEdgeIds.includes(id)),
    },

    summary: {
      nodeCount: safeNodes.length,
      edgeCount: safeEdges.length,
      matchedNodeCount: matchedNodeIds.length,
      matchedEdgeCount: matchedEdgeIds.length,
      matchedNodeRatio:
        safeNodes.length > 0 ? matchedNodeIds.length / safeNodes.length : 0,
      matchedEdgeRatio:
        safeEdges.length > 0 ? matchedEdgeIds.length / safeEdges.length : 0,
    },

    actions: buildFilterActions({
      nodes: safeNodes,
      edges: safeEdges,
      matchedNodeIds,
      matchedEdgeIds,
      mode: normalizeMode(mode),
    }),
  };

  return result;
}

/**
 * Evaluate a single rule against an element.
 *
 * @param {Object} element
 * @param {Object} rule
 * @param {'node'|'edge'} target
 * @returns {boolean}
 */
export function evaluateRule(element, rule, target) {
  if (!element || !rule) {
    return false;
  }

  const definition = getFilterDefinitionByField(rule.field, target);
  const operator = getFilterOperatorById(rule.operator);

  if (!definition || !operator) {
    return false;
  }

  const rawValue = element[definition.field];
  if (rawValue === undefined || rawValue === null) {
    return false;
  }

  if (definition.type === 'number') {
    const numericValue = toNumber(rawValue);
    if (numericValue === null) return false;

    const threshold =
      rule.operator === 'between'
        ? normalizeBetweenValue(rule.value)
        : toNumber(rule.value);

    if (threshold === null) return false;

    return operator.fn(numericValue, threshold);
  }

  if (definition.type === 'string') {
    const elementValue = String(rawValue);
    const expectedValue = Array.isArray(rule.value)
      ? rule.value.map((item) => String(item))
      : String(rule.value);

    if (rule.operator === 'eq') {
      return Array.isArray(expectedValue)
        ? expectedValue.includes(elementValue)
        : elementValue === expectedValue;
    }

    if (rule.operator === 'between') {
      return false;
    }

    /**
     * For strings, fall back to eq-like behavior on unsupported operators.
     */
    return Array.isArray(expectedValue)
      ? expectedValue.includes(elementValue)
      : elementValue === expectedValue;
  }

  return false;
}

/**
 * Evaluate multiple rules with AND logic.
 * If no rules exist for the target, the element is treated as matched.
 *
 * @param {Object} element
 * @param {Array} rules
 * @param {'node'|'edge'} target
 * @returns {boolean}
 */
export function evaluateRuleSet(element, rules = [], target) {
  const safeRules = Array.isArray(rules) ? rules : [];

  if (safeRules.length === 0) {
    return true;
  }

  return safeRules.every((rule) => evaluateRule(element, rule, target));
}

/**
 * Build a compact summary that UI can render as chips / cards.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatFilterResultForDisplay(result) {
  if (!result) {
    return {
      title: 'Filters',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const metrics = [
    {
      label: 'Mode',
      value: result.mode,
    },
    {
      label: 'Matched Nodes',
      value: `${result.summary.matchedNodeCount} / ${result.summary.nodeCount}`,
    },
    {
      label: 'Matched Edges',
      value: `${result.summary.matchedEdgeCount} / ${result.summary.edgeCount}`,
    },
    {
      label: 'Node Match Ratio',
      value: formatPercent(result.summary.matchedNodeRatio),
    },
    {
      label: 'Edge Match Ratio',
      value: formatPercent(result.summary.matchedEdgeRatio),
    },
  ];

  const interpretation = buildFilterInterpretation(result);

  return {
    title: 'Filters',
    metrics,
    interpretation,
    sections: [],
  };
}

/* =========================
   Internal helpers
   ========================= */

function createNoFilterResult(nodes, edges, mode) {
  const nodeIds = nodes.map((node) => node.id);
  const edgeIds = edges.map((edge) => edge.id);

  return {
    enabled: false,
    mode: normalizeMode(mode),
    rules: [],

    matched: {
      nodes,
      edges,
      nodeIds,
      edgeIds,
    },

    unmatched: {
      nodes: [],
      edges: [],
      nodeIds: [],
      edgeIds: [],
    },

    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      matchedNodeCount: nodes.length,
      matchedEdgeCount: edges.length,
      matchedNodeRatio: nodes.length > 0 ? 1 : 0,
      matchedEdgeRatio: edges.length > 0 ? 1 : 0,
    },

    actions: {
      highlightNodeIds: nodeIds,
      highlightEdgeIds: edgeIds,
      dimNodeIds: [],
      dimEdgeIds: [],
      hideNodeIds: [],
      hideEdgeIds: [],
    },
  };
}

function buildFilterActions({
  nodes,
  edges,
  matchedNodeIds,
  matchedEdgeIds,
  mode,
}) {
  const allNodeIds = nodes.map((node) => node.id);
  const allEdgeIds = edges.map((edge) => edge.id);

  const unmatchedNodeIds = allNodeIds.filter((id) => !matchedNodeIds.includes(id));
  const unmatchedEdgeIds = allEdgeIds.filter((id) => !matchedEdgeIds.includes(id));

  if (mode === 'hide') {
    return {
      highlightNodeIds: matchedNodeIds,
      highlightEdgeIds: matchedEdgeIds,
      dimNodeIds: [],
      dimEdgeIds: [],
      hideNodeIds: unmatchedNodeIds,
      hideEdgeIds: unmatchedEdgeIds,
    };
  }

  return {
    highlightNodeIds: matchedNodeIds,
    highlightEdgeIds: matchedEdgeIds,
    dimNodeIds: unmatchedNodeIds,
    dimEdgeIds: unmatchedEdgeIds,
    hideNodeIds: [],
    hideEdgeIds: [],
  };
}

function buildFilterInterpretation(result) {
  const lines = [];

  if (!result.enabled || result.rules.length === 0) {
    return ['No active filters are applied, so the full graph is shown.'];
  }

  lines.push(
    `${result.rules.length} active filter rule(s) are applied in ${result.mode} mode.`
  );

  lines.push(
    `${result.summary.matchedNodeCount} of ${result.summary.nodeCount} node(s) and ${result.summary.matchedEdgeCount} of ${result.summary.edgeCount} edge(s) satisfy the current conditions.`
  );

  if (result.summary.matchedNodeRatio <= 0.2 && result.summary.nodeCount > 0) {
    lines.push(
      'The current filters are restrictive, so only a small structural subset is visible.'
    );
  } else if (result.summary.matchedNodeRatio >= 0.8 && result.summary.nodeCount > 0) {
    lines.push(
      'The current filters are broad, so most of the graph remains included.'
    );
  }

  if (result.mode === 'highlight') {
    lines.push(
      'Matched elements should be emphasized while unmatched elements are dimmed.'
    );
  } else {
    lines.push(
      'Matched elements should remain visible while unmatched elements are hidden.'
    );
  }

  return lines;
}

function normalizeMode(mode) {
  return mode === 'hide' ? 'hide' : 'highlight';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBetweenValue(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const a = toNumber(value[0]);
  const b = toNumber(value[1]);

  if (a === null || b === null) {
    return null;
  }

  return a <= b ? [a, b] : [b, a];
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}