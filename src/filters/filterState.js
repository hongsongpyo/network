// src/filters/filterState.js

/**
 * Filter state store
 *
 * Manages:
 * - active filter rules
 * - filter mode (highlight / hide)
 * - enabled status
 * - selected preset
 * - draft rule (optional, for UI editing)
 */

/* =========================
   Initial State
   ========================= */

function createInitialFilterState() {
  return {
    enabled: false,

    /**
     * How matched / unmatched elements should be shown:
     * - highlight: matched elements highlighted, others dimmed
     * - hide: unmatched elements hidden
     */
    mode: 'highlight',

    /**
     * Array of filter rules:
     * {
     *   id: string,
     *   target: 'node' | 'edge',
     *   field: string,
     *   operator: string,
     *   value: number|string|Array,
     *   enabled: boolean
     * }
     */
    rules: [],

    /**
     * Optional preset id
     */
    presetId: null,

    /**
     * Optional draft rule for UI form editing
     */
    draftRule: null,
  };
}

let filterState = createInitialFilterState();

/* =========================
   Core Access
   ========================= */

export function getFilterState() {
  return filterState;
}

export function resetFilterState() {
  filterState = createInitialFilterState();
  return filterState;
}

/* =========================
   Enable / Disable
   ========================= */

export function isFilterEnabled() {
  return Boolean(filterState.enabled);
}

export function setFilterEnabled(enabled) {
  filterState.enabled = Boolean(enabled);
  return filterState.enabled;
}

export function enableFilters() {
  filterState.enabled = true;
  return filterState.enabled;
}

export function disableFilters() {
  filterState.enabled = false;
  return filterState.enabled;
}

/* =========================
   Mode
   ========================= */

export function getFilterMode() {
  return filterState.mode;
}

export function setFilterMode(mode) {
  if (mode !== 'highlight' && mode !== 'hide') {
    throw new Error('Filter mode must be "highlight" or "hide".');
  }

  filterState.mode = mode;
  return filterState.mode;
}

/* =========================
   Rules
   ========================= */

export function getFilterRules() {
  return [...filterState.rules];
}

export function setFilterRules(rules = []) {
  filterState.rules = Array.isArray(rules)
    ? rules.map((rule) => normalizeRule(rule))
    : [];

  return getFilterRules();
}

export function addFilterRule(rule) {
  const normalizedRule = normalizeRule(rule);

  filterState.rules = [...filterState.rules, normalizedRule];
  return normalizedRule;
}

export function updateFilterRule(ruleId, updates = {}) {
  let updatedRule = null;

  filterState.rules = filterState.rules.map((rule) => {
    if (rule.id !== ruleId) {
      return rule;
    }

    updatedRule = normalizeRule({
      ...rule,
      ...updates,
      id: rule.id,
    });

    return updatedRule;
  });

  return updatedRule;
}

export function removeFilterRule(ruleId) {
  const previousLength = filterState.rules.length;

  filterState.rules = filterState.rules.filter((rule) => rule.id !== ruleId);

  return filterState.rules.length < previousLength;
}

export function clearFilterRules() {
  filterState.rules = [];
  return filterState.rules;
}

export function getFilterRuleById(ruleId) {
  return filterState.rules.find((rule) => rule.id === ruleId) ?? null;
}

export function toggleFilterRule(ruleId, enabled) {
  return updateFilterRule(ruleId, {
    enabled: typeof enabled === 'boolean'
      ? enabled
      : !Boolean(getFilterRuleById(ruleId)?.enabled),
  });
}

/* =========================
   Preset
   ========================= */

export function getSelectedPresetId() {
  return filterState.presetId;
}

export function setSelectedPresetId(presetId) {
  filterState.presetId = presetId ?? null;
  return filterState.presetId;
}

export function clearSelectedPresetId() {
  filterState.presetId = null;
  return filterState.presetId;
}

/* =========================
   Draft Rule
   ========================= */

export function getDraftRule() {
  return filterState.draftRule ? { ...filterState.draftRule } : null;
}

export function setDraftRule(rule) {
  filterState.draftRule = rule ? normalizeRule(rule, { allowGeneratedId: true }) : null;
  return getDraftRule();
}

export function updateDraftRule(updates = {}) {
  const current = filterState.draftRule ?? createEmptyDraftRule();

  filterState.draftRule = normalizeRule(
    {
      ...current,
      ...updates,
    },
    { allowGeneratedId: true }
  );

  return getDraftRule();
}

export function clearDraftRule() {
  filterState.draftRule = null;
  return filterState.draftRule;
}

export function createEmptyDraftRule() {
  return {
    id: createRuleId(),
    target: 'node',
    field: 'degree',
    operator: 'gte',
    value: 0,
    enabled: true,
  };
}

/* =========================
   Bulk Apply Helpers
   ========================= */

export function applyPresetRules(preset) {
  if (!preset || !Array.isArray(preset.rules)) {
    throw new Error('A valid preset with rules is required.');
  }

  const normalizedRules = preset.rules.map((rule) =>
    normalizeRule({
      ...rule,
      id: rule.id ?? createRuleId(),
      enabled: rule.enabled ?? true,
    })
  );

  filterState.rules = normalizedRules;
  filterState.presetId = preset.id ?? null;
  filterState.enabled = true;

  return getFilterState();
}

export function clearAllFilters() {
  filterState.enabled = false;
  filterState.rules = [];
  filterState.presetId = null;
  filterState.draftRule = null;

  return getFilterState();
}

/* =========================
   Meta Helpers
   ========================= */

export function getEnabledFilterRules() {
  return filterState.rules.filter((rule) => rule.enabled !== false);
}

export function hasAnyFilterRules() {
  return filterState.rules.length > 0;
}

export function hasAnyEnabledFilterRules() {
  return getEnabledFilterRules().length > 0;
}

export function getFilterStateSnapshot() {
  return {
    enabled: filterState.enabled,
    mode: filterState.mode,
    rules: filterState.rules.map((rule) => ({ ...rule })),
    presetId: filterState.presetId,
    draftRule: filterState.draftRule ? { ...filterState.draftRule } : null,
  };
}

/* =========================
   Internal Helpers
   ========================= */

function normalizeRule(rule = {}, options = {}) {
  const allowGeneratedId = Boolean(options.allowGeneratedId);

  const normalized = {
    id: rule.id ?? (allowGeneratedId ? createRuleId() : undefined),
    target: rule.target === 'edge' ? 'edge' : 'node',
    field: String(rule.field ?? '').trim(),
    operator: String(rule.operator ?? 'gte').trim(),
    value: normalizeRuleValue(rule.value),
    enabled: rule.enabled !== false,
  };

  if (!normalized.id) {
    throw new Error('Filter rule must have an id.');
  }

  if (!normalized.field) {
    throw new Error('Filter rule must have a field.');
  }

  return normalized;
}

function normalizeRuleValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePrimitiveValue(item));
  }

  return normalizePrimitiveValue(value);
}

function normalizePrimitiveValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const asNumber = Number(value);
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(asNumber)) {
    return asNumber;
  }

  return value;
}

function createRuleId() {
  return `filter-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}