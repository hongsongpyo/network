// src/data/parser.js

/**
 * Supported input formats:
 * 1) JSON
 *    - full dataset object
 *    - { nodes: [...], edges: [...] }
 *    - Cytoscape-style { elements: [...] }
 *
 * 2) CSV
 *    Header examples:
 *    source,target
 *    source,target,weight
 *    id,label,group   (node csv)
 *
 * 3) TXT / edge list
 *    A B
 *    A B 3
 *
 * Default strategy:
 * - If CSV has source/target columns -> edge CSV
 * - If CSV has id column only -> node CSV
 * - TXT is treated as edge list
 */

export async function parseGraphFile(file, options = {}) {
  if (!file) {
    throw new Error('parseGraphFile(file) requires a valid file.');
  }

  const text = await file.text();
  const fileName = file.name || 'uploaded-dataset';
  const extension = getFileExtension(fileName);

  const parseOptions = {
    directed: Boolean(options.directed),
    weighted: Boolean(options.weighted),
    datasetName: options.datasetName || stripExtension(fileName),
    description: options.description || `Uploaded from ${fileName}`,
  };

  if (extension === 'json') {
    return parseJsonDataset(text, parseOptions);
  }

  if (extension === 'csv') {
    return parseCsvDataset(text, parseOptions);
  }

  if (extension === 'txt' || extension === 'edges' || extension === 'edgelist') {
    return parseEdgeListDataset(text, parseOptions);
  }

  throw new Error(`Unsupported file format: .${extension}`);
}

/* =========================
   JSON
   ========================= */

export function parseJsonDataset(jsonText, options = {}) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('Invalid JSON file.');
  }

  const datasetName = options.datasetName || parsed.name || 'JSON Dataset';
  const description = options.description || parsed.description || 'Parsed from JSON';
  const directed = resolveDirected(parsed, options);
  const weighted = resolveWeighted(parsed, options);

  // Case 1: already in dataset format
  if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
    return normalizeDataset({
      id: slugify(datasetName),
      name: datasetName,
      description,
      directed,
      weighted,
      nodes: parsed.nodes,
      edges: parsed.edges,
    });
  }

  // Case 2: Cytoscape-style elements
  if (Array.isArray(parsed.elements)) {
    const { nodes, edges } = splitCytoscapeElements(parsed.elements);

    return normalizeDataset({
      id: slugify(datasetName),
      name: datasetName,
      description,
      directed,
      weighted,
      nodes,
      edges,
    });
  }

  throw new Error(
    'JSON format not recognized. Expected {nodes, edges} or {elements}.'
  );
}

/* =========================
   CSV
   ========================= */

export function parseCsvDataset(csvText, options = {}) {
  const rows = parseCsvRows(csvText);

  if (!rows.length) {
    throw new Error('CSV file is empty.');
  }

  const headers = Object.keys(rows[0]).map((header) => header.trim().toLowerCase());

  const hasSource = headers.includes('source');
  const hasTarget = headers.includes('target');
  const hasId = headers.includes('id');

  const datasetName = options.datasetName || 'CSV Dataset';
  const description = options.description || 'Parsed from CSV';

  // Edge CSV
  if (hasSource && hasTarget) {
    const edgeRows = rows;
    const nodeMap = new Map();

    const edges = edgeRows.map((row, index) => {
      const source = safeString(row.source);
      const target = safeString(row.target);

      if (!source || !target) {
        throw new Error(`Invalid edge row at index ${index}: source/target missing.`);
      }

      nodeMap.set(source, { id: source, label: source });
      nodeMap.set(target, { id: target, label: target });

      const weightValue = toOptionalNumber(row.weight);

      return {
        id: row.id ? safeString(row.id) : `${source}->${target}-${index}`,
        source,
        target,
        ...(weightValue !== null ? { weight: weightValue } : {}),
      };
    });

    const nodes = Array.from(nodeMap.values());

    return normalizeDataset({
      id: slugify(datasetName),
      name: datasetName,
      description,
      directed: Boolean(options.directed),
      weighted:
        Boolean(options.weighted) || edges.some((edge) => typeof edge.weight === 'number'),
      nodes,
      edges,
    });
  }

  // Node CSV only
  if (hasId && !hasSource && !hasTarget) {
    const nodes = rows.map((row, index) => {
      const id = safeString(row.id);

      if (!id) {
        throw new Error(`Invalid node row at index ${index}: id missing.`);
      }

      return {
        id,
        label: safeString(row.label) || id,
        ...(row.group ? { group: safeString(row.group) } : {}),
      };
    });

    return normalizeDataset({
      id: slugify(datasetName),
      name: datasetName,
      description,
      directed: Boolean(options.directed),
      weighted: Boolean(options.weighted),
      nodes,
      edges: [],
    });
  }

  throw new Error(
    'CSV format not recognized. Expected headers like source,target[,weight] or id,label[,group].'
  );
}

/* =========================
   Edge List / TXT
   ========================= */

export function parseEdgeListDataset(edgeListText, options = {}) {
  const lines = edgeListText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  if (!lines.length) {
    throw new Error('Edge list file is empty.');
  }

  const nodeMap = new Map();
  const edges = [];

  lines.forEach((line, index) => {
    const parts = line.split(/\s+/);

    if (parts.length < 2) {
      throw new Error(`Invalid edge list line ${index + 1}: "${line}"`);
    }

    const [source, target, rawWeight] = parts;

    nodeMap.set(source, { id: source, label: source });
    nodeMap.set(target, { id: target, label: target });

    const edge = {
      id: `${source}->${target}-${index}`,
      source,
      target,
    };

    if (rawWeight !== undefined) {
      const parsedWeight = Number(rawWeight);

      if (!Number.isNaN(parsedWeight)) {
        edge.weight = parsedWeight;
      }
    }

    edges.push(edge);
  });

  const nodes = Array.from(nodeMap.values());

  return normalizeDataset({
    id: slugify(options.datasetName || 'edge-list-dataset'),
    name: options.datasetName || 'Edge List Dataset',
    description: options.description || 'Parsed from edge list',
    directed: Boolean(options.directed),
    weighted:
      Boolean(options.weighted) || edges.some((edge) => typeof edge.weight === 'number'),
    nodes,
    edges,
  });
}

/* =========================
   Normalization
   ========================= */

export function normalizeDataset(dataset) {
  const nodeMap = new Map();
  const edges = [];

  (dataset.nodes || []).forEach((node) => {
    const normalizedNode = normalizeNode(node);

    if (!normalizedNode.id) {
      throw new Error('Every node must have an id.');
    }

    nodeMap.set(normalizedNode.id, normalizedNode);
  });

  (dataset.edges || []).forEach((edge, index) => {
    const normalizedEdge = normalizeEdge(edge, index);

    if (!normalizedEdge.source || !normalizedEdge.target) {
      throw new Error('Every edge must have source and target.');
    }

    // ensure nodes referenced by edges also exist
    if (!nodeMap.has(normalizedEdge.source)) {
      nodeMap.set(normalizedEdge.source, {
        id: normalizedEdge.source,
        label: normalizedEdge.source,
      });
    }

    if (!nodeMap.has(normalizedEdge.target)) {
      nodeMap.set(normalizedEdge.target, {
        id: normalizedEdge.target,
        label: normalizedEdge.target,
      });
    }

    edges.push(normalizedEdge);
  });

  return {
    id: dataset.id || slugify(dataset.name || 'dataset'),
    name: dataset.name || 'Untitled Dataset',
    description: dataset.description || '',
    directed: Boolean(dataset.directed),
    weighted:
      Boolean(dataset.weighted) || edges.some((edge) => typeof edge.weight === 'number'),
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

function normalizeNode(node) {
  return {
    id: safeString(node.id),
    label: safeString(node.label) || safeString(node.id),
    ...(node.group ? { group: safeString(node.group) } : {}),
    ...pickExtraNodeFields(node),
  };
}

function normalizeEdge(edge, index = 0) {
  const weight = toOptionalNumber(edge.weight);

  return {
    id:
      safeString(edge.id) ||
      `${safeString(edge.source)}->${safeString(edge.target)}-${index}`,
    source: safeString(edge.source),
    target: safeString(edge.target),
    ...(weight !== null ? { weight } : {}),
    ...pickExtraEdgeFields(edge),
  };
}

/* =========================
   Cytoscape conversion
   ========================= */

export function datasetToCytoscapeElements(dataset) {
  if (!dataset) return [];

  const nodes = (dataset.nodes || []).map((node) => ({
    data: {
      ...node,
      id: node.id,
      label: node.label ?? node.id,
      group: node.group ?? 'default',
    },
  }));

  const edges = (dataset.edges || []).map((edge, index) => ({
    data: {
      ...edge,
      id: edge.id || `${edge.source}->${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      weight: typeof edge.weight === 'number' ? edge.weight : 1,
      directed: Boolean(dataset.directed),
    },
  }));

  return [...nodes, ...edges];
}

/* =========================
   CSV Utilities
   ========================= */

function parseCsvRows(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

/* =========================
   Element split helpers
   ========================= */

function splitCytoscapeElements(elements) {
  const nodes = [];
  const edges = [];

  elements.forEach((element) => {
    const data = element.data ?? {};

    if (data.id && !Object.prototype.hasOwnProperty.call(data, 'source')) {
      nodes.push({
        id: safeString(data.id),
        label: safeString(data.label) || safeString(data.id),
        ...(data.group ? { group: safeString(data.group) } : {}),
        ...pickExtraNodeFields(data),
      });
    } else if (data.source && data.target) {
      edges.push({
        id: safeString(data.id),
        source: safeString(data.source),
        target: safeString(data.target),
        ...(toOptionalNumber(data.weight) !== null
          ? { weight: Number(data.weight) }
          : {}),
        ...pickExtraEdgeFields(data),
      });
    }
  });

  return { nodes, edges };
}

/* =========================
   Small helpers
   ========================= */

function resolveDirected(parsed, options) {
  if (typeof parsed.directed === 'boolean') return parsed.directed;
  return Boolean(options.directed);
}

function resolveWeighted(parsed, options) {
  if (typeof parsed.weighted === 'boolean') return parsed.weighted;
  return Boolean(options.weighted);
}

function pickExtraNodeFields(node) {
  const extra = { ...node };
  delete extra.id;
  delete extra.label;
  delete extra.group;
  return extra;
}

function pickExtraEdgeFields(edge) {
  const extra = { ...edge };
  delete extra.id;
  delete extra.source;
  delete extra.target;
  delete extra.weight;
  return extra;
}

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getFileExtension(fileName) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');
}

function slugify(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dataset';
}