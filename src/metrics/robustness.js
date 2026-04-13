// src/metrics/robustness.js

/**
 * Robustness analysis
 *
 * Included:
 * - random node removal simulation
 * - targeted attack simulation (highest-degree-first)
 * - giant component ratio tracking
 * - robustness comparison summary
 *
 * Notes:
 * - Uses undirected connectivity view for robustness evaluation.
 * - For directed graphs, edges are treated as undirected when measuring fragmentation.
 * - Main outcome: how quickly the giant component collapses as nodes are removed.
 */

/* =========================
   Public API
   ========================= */

/**
 * Compute robustness simulations.
 *
 * @param {Object} graphData
 * @param {Array} graphData.nodes
 * @param {Array} graphData.edges
 * @param {boolean} [graphData.directed=false]
 * @param {Object} [options]
 * @param {number} [options.stepRatio=0.1] - fraction removed per step
 * @param {number} [options.randomTrials=10] - number of random simulations to average
 * @param {number} [options.randomSeed=42]
 * @returns {Object}
 */
export function computeRobustness(graphData = {}, options = {}) {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];

  const stepRatio =
    typeof options.stepRatio === 'number' && options.stepRatio > 0
      ? options.stepRatio
      : 0.1;

  const randomTrials =
    Number.isInteger(options.randomTrials) && options.randomTrials > 0
      ? options.randomTrials
      : 10;

  const randomSeed =
    Number.isInteger(options.randomSeed) ? options.randomSeed : 42;

  const nodeIds = nodes.map((node) => node.id);

  const randomFailureCurve = simulateRandomFailure(
    nodeIds,
    edges,
    {
      stepRatio,
      randomTrials,
      randomSeed,
    }
  );

  const targetedAttackCurve = simulateTargetedAttack(
    nodeIds,
    edges,
    {
      stepRatio,
    }
  );

  const randomAuc = computeCurveArea(randomFailureCurve);
  const targetedAuc = computeCurveArea(targetedAttackCurve);

  const randomCollapsePoint = estimateCollapsePoint(randomFailureCurve);
  const targetedCollapsePoint = estimateCollapsePoint(targetedAttackCurve);

  const result = {
    summary: {
      nodeCount: nodeIds.length,
      edgeCount: edges.length,
      stepRatio,
      randomTrials,

      randomFailureAUC: randomAuc,
      targetedAttackAUC: targetedAuc,

      randomCollapsePoint,
      targetedCollapsePoint,

      moreRobustToRandomFailure: randomAuc > targetedAuc,
      vulnerabilityGap: randomAuc - targetedAuc,
    },

    curves: {
      randomFailure: randomFailureCurve,
      targetedAttack: targetedAttackCurve,
    },

    interpretation: buildRobustnessInterpretation({
      randomAuc,
      targetedAuc,
      randomCollapsePoint,
      targetedCollapsePoint,
    }),
  };

  return result;
}

/**
 * Format robustness result for UI display.
 *
 * @param {Object} result
 * @returns {Object}
 */
export function formatRobustnessForDisplay(result) {
  if (!result || !result.summary) {
    return {
      title: 'Robustness',
      metrics: [],
      interpretation: [],
      sections: [],
    };
  }

  const { summary, interpretation } = result;

  const metrics = [
    {
      label: 'Random Failure AUC',
      value: formatNumber(summary.randomFailureAUC, 3),
    },
    {
      label: 'Targeted Attack AUC',
      value: formatNumber(summary.targetedAttackAUC, 3),
    },
    {
      label: 'Random Collapse Point',
      value: formatPercent(summary.randomCollapsePoint),
    },
    {
      label: 'Targeted Collapse Point',
      value: formatPercent(summary.targetedCollapsePoint),
    },
    {
      label: 'Vulnerability Gap',
      value: formatNumber(summary.vulnerabilityGap, 3),
    },
    {
      label: 'Random > Targeted',
      value: summary.moreRobustToRandomFailure ? 'Yes' : 'No',
    },
  ];

  const sections = [
    {
      title: 'Interpretation Hint',
      items: [
        {
          label: 'Rule of Thumb',
          value:
            'If targeted attack destroys the giant component much faster than random failure, hub dependence is strong.',
        },
      ],
    },
  ];

  return {
    title: 'Robustness',
    metrics,
    interpretation,
    sections,
  };
}

/**
 * Convenience wrapper
 *
 * @param {Object} graphData
 * @param {Object} [options]
 * @returns {Object}
 */
export function runRobustness(graphData = {}, options = {}) {
  const raw = computeRobustness(graphData, options);
  const display = formatRobustnessForDisplay(raw);

  return {
    raw,
    display,
  };
}

/* =========================
   Interpretation
   ========================= */

export function buildRobustnessInterpretation({
  randomAuc = 0,
  targetedAuc = 0,
  randomCollapsePoint = 0,
  targetedCollapsePoint = 0,
} = {}) {
  const lines = [];

  lines.push(
    `Under random failure, the robustness curve area is ${formatNumber(randomAuc, 3)}, while under targeted attack it is ${formatNumber(targetedAuc, 3)}.`
  );

  if (randomAuc > targetedAuc) {
    lines.push(
      'The network is more robust to random failure than to targeted attack.'
    );
  } else {
    lines.push(
      'The network does not show a strong robustness advantage under random failure.'
    );
  }

  lines.push(
    `The giant component falls below 50% of original size after removing about ${formatPercent(randomCollapsePoint)} of nodes at random, but after only about ${formatPercent(targetedCollapsePoint)} under targeted attack.`
  );

  if (targetedCollapsePoint < randomCollapsePoint) {
    lines.push(
      'This suggests strong dependence on highly connected nodes, which is typical of hub-dominated networks.'
    );
  }

  if (targetedAuc < 0.4) {
    lines.push(
      'The network appears quite vulnerable to targeted attack, meaning hub removal quickly fragments the graph.'
    );
  } else {
    lines.push(
      'The network retains some structure even under targeted attack, so vulnerability is not extreme.'
    );
  }

  return lines;
}

/* =========================
   Simulations
   ========================= */

function simulateRandomFailure(nodeIds, edges, options) {
  const { stepRatio, randomTrials, randomSeed } = options;

  const allCurves = [];

  for (let trial = 0; trial < randomTrials; trial += 1) {
    const rng = createSeededRandom(randomSeed + trial);
    const shuffled = shuffleArray([...nodeIds], rng);

    const curve = simulateRemovalSequence(nodeIds, edges, shuffled, stepRatio);
    allCurves.push(curve);
  }

  return averageCurves(allCurves);
}

function simulateTargetedAttack(nodeIds, edges, options) {
  const { stepRatio } = options;

  const degreeMap = computeDegrees(nodeIds, edges);
  const ordered = [...nodeIds].sort((a, b) => {
    const degreeDiff = (degreeMap[b] ?? 0) - (degreeMap[a] ?? 0);
    if (degreeDiff !== 0) return degreeDiff;
    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return simulateRemovalSequence(nodeIds, edges, ordered, stepRatio);
}

/**
 * Simulate node removal in given order.
 * Returns points:
 * [{ removedFraction, giantComponentRatio, removedCount, giantComponentSize }]
 */
function simulateRemovalSequence(originalNodeIds, originalEdges, removalOrder, stepRatio) {
  const totalNodes = originalNodeIds.length;

  if (totalNodes === 0) {
    return [];
  }

  const stepSize = Math.max(1, Math.round(totalNodes * stepRatio));
  const curve = [];

  let removedCount = 0;
  let activeNodes = new Set(originalNodeIds);

  curve.push(
    evaluateCurrentGraphState(activeNodes, originalEdges, totalNodes, removedCount)
  );

  while (removedCount < totalNodes) {
    const nextRemoved = removalOrder.slice(removedCount, removedCount + stepSize);
    nextRemoved.forEach((nodeId) => {
      activeNodes.delete(nodeId);
    });

    removedCount += nextRemoved.length;

    curve.push(
      evaluateCurrentGraphState(activeNodes, originalEdges, totalNodes, removedCount)
    );
  }

  return curve;
}

function evaluateCurrentGraphState(activeNodes, originalEdges, totalNodes, removedCount) {
  const giantComponentSize = computeGiantComponentSize(activeNodes, originalEdges);
  const removedFraction = totalNodes > 0 ? removedCount / totalNodes : 0;
  const giantComponentRatio = totalNodes > 0 ? giantComponentSize / totalNodes : 0;

  return {
    removedFraction,
    giantComponentSize,
    giantComponentRatio,
    removedCount,
  };
}

/* =========================
   Graph fragmentation helpers
   ========================= */

function computeGiantComponentSize(activeNodes, originalEdges) {
  if (activeNodes.size === 0) {
    return 0;
  }

  const adjacency = buildActiveUndirectedAdjacency(activeNodes, originalEdges);
  const visited = new Set();
  let maxComponentSize = 0;

  activeNodes.forEach((startNode) => {
    if (visited.has(startNode)) return;

    const stack = [startNode];
    visited.add(startNode);
    let componentSize = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      componentSize += 1;

      const neighbors = adjacency.get(current) ?? new Set();

      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      });
    }

    if (componentSize > maxComponentSize) {
      maxComponentSize = componentSize;
    }
  });

  return maxComponentSize;
}

function buildActiveUndirectedAdjacency(activeNodes, edges) {
  const adjacency = new Map();

  activeNodes.forEach((id) => {
    adjacency.set(id, new Set());
  });

  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;

    if (!activeNodes.has(source) || !activeNodes.has(target)) {
      return;
    }

    if (source === target) {
      return;
    }

    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  });

  return adjacency;
}

/* =========================
   Degree helper
   ========================= */

function computeDegrees(nodeIds, edges) {
  const degreeMap = {};

  nodeIds.forEach((id) => {
    degreeMap[id] = 0;
  });

  edges.forEach((edge) => {
    const s = edge.source;
    const t = edge.target;

    if (s in degreeMap) degreeMap[s] += 1;
    if (t in degreeMap) degreeMap[t] += 1;
  });

  return degreeMap;
}

/* =========================
   Curve helpers
   ========================= */

function averageCurves(curves) {
  if (!curves.length) {
    return [];
  }

  const maxLength = Math.max(...curves.map((curve) => curve.length));
  const averaged = [];

  for (let i = 0; i < maxLength; i += 1) {
    const points = curves.map((curve) => curve[i]).filter(Boolean);

    averaged.push({
      removedFraction: mean(points.map((p) => p.removedFraction)),
      giantComponentSize: mean(points.map((p) => p.giantComponentSize)),
      giantComponentRatio: mean(points.map((p) => p.giantComponentRatio)),
      removedCount: mean(points.map((p) => p.removedCount)),
    });
  }

  return averaged;
}

/**
 * Approximate AUC using trapezoidal rule.
 * x = removedFraction, y = giantComponentRatio
 */
function computeCurveArea(curve) {
  if (!curve.length) {
    return 0;
  }

  let area = 0;

  for (let i = 1; i < curve.length; i += 1) {
    const x1 = curve[i - 1].removedFraction;
    const x2 = curve[i].removedFraction;
    const y1 = curve[i - 1].giantComponentRatio;
    const y2 = curve[i].giantComponentRatio;

    area += ((y1 + y2) / 2) * (x2 - x1);
  }

  return area;
}

/**
 * First removedFraction where giant component ratio <= 0.5
 */
function estimateCollapsePoint(curve) {
  for (let i = 0; i < curve.length; i += 1) {
    if (curve[i].giantComponentRatio <= 0.5) {
      return curve[i].removedFraction;
    }
  }

  return 1;
}

/* =========================
   Random helpers
   ========================= */

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffleArray(array, randomFn) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/* =========================
   Numeric helpers
   ========================= */

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return Number(value).toFixed(digits);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}