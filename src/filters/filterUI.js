// src/filters/filterUI.js

import {
  FILTER_OPERATORS,
  FILTER_PRESETS,
  getAvailableDefinitionsForContext,
  getFilterOperatorById,
} from './filterDefinitions.js';

import {
  getFilterState,
  getFilterRules,
  setFilterMode,
  getFilterMode,
  addFilterRule,
  removeFilterRule,
  clearAllFilters,
  enableFilters,
  disableFilters,
  isFilterEnabled,
  applyPresetRules,
  getEnabledFilterRules,
} from './filterState.js';

import {
  applyFilters,
  formatFilterResultForDisplay,
} from './filterEngine.js';

/**
 * Filter UI controller
 *
 * Main responsibilities:
 * - render filter panel
 * - manage add/remove rule interactions
 * - apply presets
 * - run filter engine and notify caller
 */

/* =========================
   Public API
   ========================= */

/**
 * Mount filter UI into a container.
 *
 * @param {Object} params
 * @param {HTMLElement} params.container
 * @param {Function} params.getGraphData - () => ({ nodes, edges })
 * @param {Function} [params.onFilterApplied]
 * @param {boolean} [params.directed=false]
 * @param {boolean} [params.weighted=false]
 * @returns {Object}
 */
export function initFilterUI({
  container,
  getGraphData,
  onFilterApplied = null,
  directed = false,
  weighted = false,
} = {}) {
  if (!container) {
    throw new Error('initFilterUI requires a container element.');
  }

  if (typeof getGraphData !== 'function') {
    throw new Error('initFilterUI requires getGraphData() function.');
  }

  renderFilterPanel(container, { directed, weighted });

  bindFilterUIEvents({
    container,
    getGraphData,
    onFilterApplied,
    directed,
    weighted,
  });

  renderRulesList(container);

  return {
    refresh(context = {}) {
      const nextDirected =
        typeof context.directed === 'boolean' ? context.directed : directed;
      const nextWeighted =
        typeof context.weighted === 'boolean' ? context.weighted : weighted;

      renderFilterPanel(container, {
        directed: nextDirected,
        weighted: nextWeighted,
        preserveBody: true,
      });

      renderRulesList(container);
    },

    run() {
      return runCurrentFilters({
        getGraphData,
        onFilterApplied,
      });
    },
  };
}

/**
 * Execute the current filter state against graph data.
 *
 * @param {Object} params
 * @param {Function} params.getGraphData
 * @param {Function|null} [params.onFilterApplied]
 * @returns {Object}
 */
export function runCurrentFilters({
  getGraphData,
  onFilterApplied = null,
} = {}) {
  const graphData = getGraphData?.() ?? { nodes: [], edges: [] };
  const state = getFilterState();

  const result = applyFilters({
    nodes: graphData.nodes ?? [],
    edges: graphData.edges ?? [],
    rules: getEnabledFilterRules(),
    mode: state.mode,
    enabled: state.enabled,
  });

  const display = formatFilterResultForDisplay(result);

  if (typeof onFilterApplied === 'function') {
    onFilterApplied({
      raw: result,
      display,
    });
  }

  return {
    raw: result,
    display,
  };
}

/* =========================
   Rendering
   ========================= */

function renderFilterPanel(
  container,
  { directed = false, weighted = false, preserveBody = false } = {}
) {
  if (!preserveBody) {
    container.innerHTML = '';
  }

  const definitions = getAvailableDefinitionsForContext({
    directed,
    weighted,
    target: 'node',
  });

  const edgeDefinitions = getAvailableDefinitionsForContext({
    directed,
    weighted,
    target: 'edge',
  });

  const mode = getFilterMode();

  container.innerHTML = `
    <div class="filter-stack">
      <div class="filter-card">
        <div class="filter-card__header">
          <div class="filter-card__title">Filter Mode</div>
        </div>

        <div class="filter-card__body">
          <div class="button-row">
            <button
              type="button"
              class="btn btn--secondary ${mode === 'highlight' ? 'is-active' : ''}"
              data-filter-mode="highlight"
            >
              Highlight
            </button>
            <button
              type="button"
              class="btn btn--secondary ${mode === 'hide' ? 'is-active' : ''}"
              data-filter-mode="hide"
            >
              Hide
            </button>
          </div>

          <div class="filter-actions">
            <button type="button" class="btn btn--ghost" id="filters-enable-btn">
              ${isFilterEnabled() ? 'Disable Filters' : 'Enable Filters'}
            </button>
            <button type="button" class="btn btn--ghost" id="filters-clear-btn">
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div class="filter-card">
        <div class="filter-card__header">
          <div class="filter-card__title">Add Rule</div>
        </div>

        <div class="filter-card__body">
          <label class="field">
            <span class="field__label">Target</span>
            <select class="select" id="filter-target-select">
              <option value="node">Node</option>
              <option value="edge">Edge</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">Metric</span>
            <select class="select" id="filter-field-select">
              ${renderDefinitionOptions(definitions)}
            </select>
          </label>

          <label class="field">
            <span class="field__label">Operator</span>
            <select class="select" id="filter-operator-select">
              ${FILTER_OPERATORS.map((op) => {
                return `<option value="${op.id}">${op.label}</option>`;
              }).join('')}
            </select>
          </label>

          <label class="field" id="filter-value-field">
            <span class="field__label">Value</span>
            <input class="input" id="filter-value-input" type="text" placeholder="e.g. 5" />
          </label>

          <div class="button-row">
            <button type="button" class="btn btn--primary" id="filter-add-rule-btn">
              Add Rule
            </button>
            <button type="button" class="btn btn--secondary" id="filter-apply-btn">
              Apply
            </button>
          </div>
        </div>
      </div>

      <div class="filter-card">
        <div class="filter-card__header">
          <div class="filter-card__title">Presets</div>
        </div>

        <div class="filter-card__body">
          <div class="button-row" id="filter-presets-row">
            ${FILTER_PRESETS.map((preset) => {
              return `
                <button
                  type="button"
                  class="btn btn--ghost"
                  data-filter-preset="${preset.id}"
                  title="${preset.description}"
                >
                  ${preset.label}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="filter-card">
        <div class="filter-card__header">
          <div class="filter-card__title">Active Rules</div>
        </div>

        <div class="filter-card__body">
          <div id="filter-rules-list"></div>
        </div>
      </div>

      <div class="filter-card">
        <div class="filter-card__header">
          <div class="filter-card__title">Available Fields</div>
        </div>

        <div class="filter-card__body">
          <div class="filter-summary">
            <div class="filter-summary__text">
              <strong>Node fields:</strong> ${definitions.map((d) => d.label).join(', ') || '-'}
            </div>
            <div class="filter-summary__text">
              <strong>Edge fields:</strong> ${edgeDefinitions.map((d) => d.label).join(', ') || '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDefinitionOptions(definitions = []) {
  return definitions
    .map((definition) => {
      return `<option value="${definition.field}">${definition.label}</option>`;
    })
    .join('');
}

function renderRulesList(container) {
  const rulesList = container.querySelector('#filter-rules-list');
  if (!rulesList) return;

  const rules = getFilterRules();

  if (!rules.length) {
    rulesList.innerHTML = `
      <div class="panel-placeholder-box">
        <div class="panel-placeholder-box__title">No active rules</div>
        <div class="panel-placeholder-box__text">
          Add a rule above to start filtering nodes or edges.
        </div>
      </div>
    `;
    return;
  }

  rulesList.innerHTML = `
    <div class="filter-stack">
      ${rules.map((rule) => renderRuleCard(rule)).join('')}
    </div>
  `;
}

function renderRuleCard(rule) {
  const operator = getFilterOperatorById(rule.operator);

  return `
    <div class="filter-card" data-rule-id="${rule.id}">
      <div class="filter-card__header">
        <div class="filter-card__title">${rule.target.toUpperCase()} · ${rule.field}</div>
        <div class="button-row">
          <button
            type="button"
            class="btn btn--ghost"
            data-remove-rule-id="${rule.id}"
          >
            Remove
          </button>
        </div>
      </div>

      <div class="filter-card__body">
        <div class="stat-list">
          <div class="stat-item">
            <div class="stat-item__label">Operator</div>
            <div class="stat-item__value">${operator?.label ?? rule.operator}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__label">Value</div>
            <div class="stat-item__value">${formatRuleValue(rule.value)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__label">Enabled</div>
            <div class="stat-item__value">${rule.enabled !== false ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* =========================
   Events
   ========================= */

function bindFilterUIEvents({
  container,
  getGraphData,
  onFilterApplied,
  directed = false,
  weighted = false,
} = {}) {
  container.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-filter-mode]');
    if (modeButton) {
      const mode = modeButton.dataset.filterMode;
      setFilterMode(mode);
      rerenderAndApply({
        container,
        getGraphData,
        onFilterApplied,
        directed,
        weighted,
      });
      return;
    }

    const presetButton = event.target.closest('[data-filter-preset]');
    if (presetButton) {
      const presetId = presetButton.dataset.filterPreset;
      const preset = FILTER_PRESETS.find((item) => item.id === presetId);

      if (preset) {
        applyPresetRules(preset);
        rerenderAndApply({
          container,
          getGraphData,
          onFilterApplied,
          directed,
          weighted,
        });
      }
      return;
    }

    const removeButton = event.target.closest('[data-remove-rule-id]');
    if (removeButton) {
      const ruleId = removeButton.dataset.removeRuleId;
      removeFilterRule(ruleId);
      rerenderAndApply({
        container,
        getGraphData,
        onFilterApplied,
        directed,
        weighted,
      });
      return;
    }

    if (event.target.id === 'filters-enable-btn') {
      if (isFilterEnabled()) {
        disableFilters();
      } else {
        enableFilters();
      }

      rerenderAndApply({
        container,
        getGraphData,
        onFilterApplied,
        directed,
        weighted,
      });
      return;
    }

    if (event.target.id === 'filters-clear-btn') {
      clearAllFilters();
      rerenderAndApply({
        container,
        getGraphData,
        onFilterApplied,
        directed,
        weighted,
      });
      return;
    }

    if (event.target.id === 'filter-add-rule-btn') {
      const rule = buildRuleFromForm(container);

      if (rule) {
        addFilterRule(rule);
        enableFilters();

        rerenderAndApply({
          container,
          getGraphData,
          onFilterApplied,
          directed,
          weighted,
        });
      }
      return;
    }

    if (event.target.id === 'filter-apply-btn') {
      enableFilters();
      runCurrentFilters({
        getGraphData,
        onFilterApplied,
      });
    }
  });

  container.addEventListener('change', (event) => {
    if (event.target.id === 'filter-target-select') {
      updateFieldOptions(container, {
        directed,
        weighted,
      });
      updateValueInputByOperator(container);
      return;
    }

    if (event.target.id === 'filter-operator-select') {
      updateValueInputByOperator(container);
    }
  });
}

/* =========================
   Form handling
   ========================= */

function updateFieldOptions(container, { directed = false, weighted = false } = {}) {
  const targetSelect = container.querySelector('#filter-target-select');
  const fieldSelect = container.querySelector('#filter-field-select');

  if (!targetSelect || !fieldSelect) return;

  const target = targetSelect.value;
  const definitions = getAvailableDefinitionsForContext({
    directed,
    weighted,
    target,
  });

  fieldSelect.innerHTML = renderDefinitionOptions(definitions);
}

function updateValueInputByOperator(container) {
  const operatorSelect = container.querySelector('#filter-operator-select');
  const valueField = container.querySelector('#filter-value-field');

  if (!operatorSelect || !valueField) return;

  const operator = operatorSelect.value;

  if (operator === 'between') {
    valueField.innerHTML = `
      <span class="field__label">Value Range</span>
      <div class="filter-inline">
        <input class="input" id="filter-value-min-input" type="number" placeholder="min" />
        <input class="input" id="filter-value-max-input" type="number" placeholder="max" />
      </div>
    `;
    return;
  }

  valueField.innerHTML = `
    <span class="field__label">Value</span>
    <input class="input" id="filter-value-input" type="text" placeholder="e.g. 5" />
  `;
}

function buildRuleFromForm(container) {
  const target = container.querySelector('#filter-target-select')?.value ?? 'node';
  const field = container.querySelector('#filter-field-select')?.value ?? '';
  const operator = container.querySelector('#filter-operator-select')?.value ?? 'gte';

  if (!field) {
    return null;
  }

  let value = null;

  if (operator === 'between') {
    const minValue = container.querySelector('#filter-value-min-input')?.value;
    const maxValue = container.querySelector('#filter-value-max-input')?.value;

    if (minValue === '' || maxValue === '') {
      return null;
    }

    value = [Number(minValue), Number(maxValue)];
  } else {
    const rawValue = container.querySelector('#filter-value-input')?.value ?? '';

    if (rawValue === '') {
      return null;
    }

    const numericValue = Number(rawValue);
    value = Number.isFinite(numericValue) ? numericValue : rawValue;
  }

  return {
    id: createRuleId(),
    target,
    field,
    operator,
    value,
    enabled: true,
  };
}

/* =========================
   Utility
   ========================= */

function rerenderAndApply({
  container,
  getGraphData,
  onFilterApplied,
  directed = false,
  weighted = false,
} = {}) {
  renderFilterPanel(container, { directed, weighted });
  renderRulesList(container);

  runCurrentFilters({
    getGraphData,
    onFilterApplied,
  });
}

function formatRuleValue(value) {
  if (Array.isArray(value)) {
    return `${value[0]} ~ ${value[1]}`;
  }

  return String(value);
}

function createRuleId() {
  return `filter-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}