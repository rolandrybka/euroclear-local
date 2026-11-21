class YpsilonLocalCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._confirming = false;
    this._sending = false;
    this._error = "";
    this._stateKey = null;
    this._pendingAction = null;
    this._shadowClick = (event) => this._handleClick(event);
    this.shadowRoot.addEventListener("click", this._shadowClick);
    this.shadowRoot.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this._confirming && !this._sending) {
        this._confirming = false;
        this._pendingAction = null;
        this._error = "";
        this._render();
      }
    });
  }

  setConfig(config) {
    this._config = {
      title: config.title || "",
      subtitle: config.subtitle || "",
      flow_rate: config.flow_rate || "",
      daily_water: config.daily_water || "",
      residual_water: config.residual_water || "",
      weekly_average: config.weekly_average || "",
      station: config.station || "",
      vacation_status: config.vacation_status || "",
      alerts: Array.isArray(config.alerts) ? config.alerts : [],
      regeneration_button: config.regeneration_button || "",
      sync_clock_button: config.sync_clock_button || "",
    };
    this._stateKey = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._editor) {
      this._editor.hass = hass;
    }

    const config = this._config;
    const entities = config
      ? [
          config.flow_rate,
          config.daily_water,
          config.residual_water,
          config.weekly_average,
          config.station,
          config.vacation_status,
          ...config.alerts,
          config.regeneration_button,
          config.sync_clock_button,
        ].filter(Boolean)
      : [];
    const stateKey = JSON.stringify({
      language: hass.language,
      states: entities.map((entityId) => hass.states[entityId] || null),
    });
    if (stateKey !== this._stateKey) {
      this._stateKey = stateKey;
      this._render();
    }
  }

  static getConfigElement() {
    return document.createElement("ypsilon-local-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 4;
  }

  _handleClick(event) {
    const target = event.target;
    const button = target.closest && target.closest("button");
    if (button && button.dataset.action) {
      const action = button.dataset.action;
      if (action === "regeneration") {
        this._pendingAction = {
          entity: this._config.regeneration_button,
          label: this._text.regeneration,
          message: this._text.regenerationWarning,
        };
        this._confirming = true;
        this._error = "";
        this._render();
      } else if (action === "sync-clock") {
        this._runAction(this._config.sync_clock_button);
      }
    } else if (button && button.classList.contains("cancel")) {
      this._confirming = false;
      this._pendingAction = null;
      this._error = "";
      this._render();
    } else if (button && button.classList.contains("confirm")) {
      this._runAction(this._pendingAction && this._pendingAction.entity);
    } else if (
      target.classList &&
      target.classList.contains("scrim") &&
      !this._sending
    ) {
      this._confirming = false;
      this._pendingAction = null;
      this._error = "";
      this._render();
    }
  }

  _escape(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _state(entityId) {
    return entityId && this._hass && this._hass.states
      ? this._hass.states[entityId]
      : undefined;
  }

  _render() {
    if (!this.shadowRoot || !this._config || !this._hass) {
      return;
    }

    const hu = (this._hass.language || "").toLowerCase().startsWith("hu");
    this._text = hu
      ? {
          title: "Euro-Clear vízlágyító",
          subtitle: "Runxin Local · helyi vezérlés",
          configure: "A kártya szerkesztésénél válaszd ki az entitásokat.",
          noMetrics: "Válassz ki legalább egy megjelenítendő szenzort.",
          noAlertsConfigured: "Nincs riasztásérzékelő kiválasztva",
          noAlerts: "Nincs aktív riasztás",
          unavailableAlerts: "Egy vagy több riasztásérzékelő nem érhető el",
          station: "Működési állapot",
          backwash: "Visszamosás",
          brine: "Sóoldat",
          refill: "Utántöltés",
          rinse: "Öblítés",
          in_service: "Szolgálati állapot",
          brine_draw: "Sóoldat beszívása és lassú öblítés",
          brine_refill: "Sóoldat-utántöltés",
          fast_rinse: "Gyorsöblítés",
          closed: "Lezárva",
          salt_dissolving: "Sóoldódás",
          pause_1: "1. szünet",
          pause_2: "2. szünet",
          vacation: "Távolléti mód",
          regeneration: "Regenerálás indítása",
          regenerationWarning:
            "Ez elindítja a vízlágyító regenerálását. A folyamat több órán át tarthat, vizet és sót használ.",
          syncClock: "Óra szinkronizálása",
          confirm: "Biztosan folytatod?",
          cancel: "Mégse",
          sending: "Küldés…",
          sendError:
            "A parancs küldése nem sikerült. Ellenőrizd a Home Assistant naplóját, majd próbáld újra.",
          unavailable: "Nem érhető el",
        }
      : {
          title: "Euro-Clear water softener",
          subtitle: "Runxin Local · local control",
          configure: "Select the entities in the card editor.",
          noMetrics: "Select at least one sensor to display.",
          noAlertsConfigured: "No alarm sensors selected",
          noAlerts: "No active alerts",
          unavailableAlerts: "One or more alarm sensors are unavailable",
          station: "Operating status",
          backwash: "Backwash",
          brine: "Brine",
          refill: "Refill",
          rinse: "Rinse",
          in_service: "In service",
          brine_draw: "Brine draw and slow rinse",
          brine_refill: "Brine refill",
          fast_rinse: "Fast rinse",
          closed: "Closed",
          salt_dissolving: "Salt dissolving",
          pause_1: "Pause 1",
          pause_2: "Pause 2",
          vacation: "Vacation mode",
          regeneration: "Start regeneration",
          regenerationWarning:
            "This starts a regeneration cycle. It may take several hours and uses water and salt.",
          syncClock: "Sync clock",
          confirm: "Are you sure you want to continue?",
          cancel: "Cancel",
          sending: "Sending…",
          sendError:
            "The command could not be sent. Check Home Assistant logs and try again.",
          unavailable: "Unavailable",
        };

    const metrics = [
      ["flow_rate", "mdi:waves-arrow-right"],
      ["daily_water", "mdi:water"],
      ["residual_water", "mdi:water-check"],
      ["weekly_average", "mdi:chart-line"],
    ]
      .filter(([key]) => this._config[key])
      .map(([key, icon]) => this._renderMetric(this._config[key], icon))
      .join("");

    const alertResults = this._config.alerts.map((entityId) => ({
      entityId,
      state: this._state(entityId),
    }));
    const activeAlerts = alertResults
      .filter(({ state }) => state && state.state === "on")
      .map(({ entityId, state }) => {
        const label = state.attributes.friendly_name || entityId;
        return `<div class="alert"><ha-icon icon="mdi:alert-circle"></ha-icon><span>${this._escape(label)}</span></div>`;
      })
      .join("");
    const hasUnavailableAlert = alertResults.some(
      ({ state }) => !state || ["unavailable", "unknown"].includes(state.state),
    );
    const alertContent = activeAlerts
      ? `<div class="alerts">${activeAlerts}</div>`
      : hasUnavailableAlert
        ? `<div class="alert unavailable-alert"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${this._text.unavailableAlerts}</span></div>`
        : alertResults.length
          ? `<div class="all-clear"><ha-icon icon="mdi:check-circle-outline"></ha-icon><span>${this._text.noAlerts}</span></div>`
          : `<div class="all-clear muted"><ha-icon icon="mdi:information-outline"></ha-icon><span>${this._text.noAlertsConfigured}</span></div>`;

    const station = this._state(this._config.station);
    const rawCode = station && Number(station.attributes.raw_code);
    const stationNames = [
      "in_service",
      "backwash",
      "brine_draw",
      "brine_refill",
      "fast_rinse",
      "closed",
      "salt_dissolving",
      "pause_1",
      "pause_2",
    ];
    const stationName =
      Number.isInteger(rawCode) && stationNames[rawCode]
        ? this._text[stationNames[rawCode]]
        : station
          ? station.state
          : this._text.unavailable;
    const activeStep = Number.isInteger(rawCode) && rawCode >= 1 && rawCode <= 4
      ? rawCode - 1
      : -1;
    const stepLabels = [
      this._text.backwash,
      this._text.brine,
      this._text.refill,
      this._text.rinse,
    ];
    const steps = activeStep >= 0
      ? `<div class="steps">${stepLabels
          .map(
            (label, index) =>
              `<div class="step ${index <= activeStep ? "complete" : ""} ${index === activeStep ? "current" : ""}">
                <span class="step-dot">${index < activeStep ? "✓" : index + 1}</span><span>${label}</span>
              </div>`,
          )
          .join("")}</div>`
      : "";
    const statusPanel = station || this._config.vacation_status
      ? `<section class="status">
          ${
            station
              ? `<div class="status-row">
                  <ha-icon icon="mdi:water-sync"></ha-icon>
                  <div><span class="status-label">${this._text.station}</span><strong>${this._escape(stationName)}</strong></div>
                </div>`
              : ""
          }
          ${this._renderVacation()}
          ${steps}
        </section>`
      : "";

    const regeneration = this._config.regeneration_button
      ? `<button class="action danger" data-action="regeneration" type="button" ${this._sending ? "disabled" : ""}>
          <ha-icon icon="mdi:recycle-variant"></ha-icon>${this._text.regeneration}
        </button>`
      : "";
    const syncClock = this._config.sync_clock_button
      ? `<button class="action secondary" data-action="sync-clock" type="button" ${this._sending ? "disabled" : ""}>
          <ha-icon icon="mdi:clock-check"></ha-icon>${this._text.syncClock}
        </button>`
      : "";
    const dialog = this._confirming
      ? `<div class="scrim" role="presentation">
          <section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
            <div class="dialog-icon"><ha-icon icon="mdi:alert"></ha-icon></div>
            <h2 id="dialog-title">${this._escape(this._pendingAction.label)}</h2>
            <p>${this._escape(this._pendingAction.message)} ${this._text.confirm}</p>
            ${this._error ? `<p class="error" role="alert">${this._escape(this._error)}</p>` : ""}
            <div class="dialog-actions">
              <button class="cancel" type="button" ${this._sending ? "disabled" : ""}>${this._text.cancel}</button>
              <button class="confirm" type="button" ${this._sending ? "disabled" : ""}>${this._sending ? this._text.sending : this._escape(this._pendingAction.label)}</button>
            </div>
          </section>
        </div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          overflow: hidden; color: var(--primary-text-color);
          background: radial-gradient(ellipse at 100% 0%, rgba(91,190,207,.16), transparent 42%), var(--ha-card-background, var(--card-background-color));
          border: 1px solid var(--divider-color); border-radius: 22px;
          box-shadow: var(--ha-card-box-shadow, 0 8px 26px rgba(0,0,0,.12));
        }
        .content { padding: 22px; }
        .heading { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .drop { display: grid; place-items: center; flex: 0 0 52px; height: 52px; color: #fff; border-radius: 18px;
          background: linear-gradient(145deg,#38b8c5,#247da9); box-shadow: 0 7px 17px rgba(36,125,169,.28); }
        .drop ha-icon { --mdc-icon-size: 30px; }
        h1 { margin: 0; font-size: 20px; line-height: 1.3; font-weight: 650; }
        .subtitle { display: block; margin-top: 3px; color: var(--secondary-text-color); font-size: 13px; }
        .metrics { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
        .metric { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 13px;
          border: 1px solid var(--divider-color); border-radius: 15px; background: var(--secondary-background-color,rgba(127,127,127,.06)); }
        .metric ha-icon { flex: 0 0 auto; color: var(--accent-color,#35a9ba); --mdc-icon-size: 22px; }
        .metric-copy { display: flex; flex-direction: column; min-width: 0; gap: 4px; }
        .metric-label { overflow: hidden; color: var(--secondary-text-color); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .metric-value { font-size: 17px; font-weight: 650; overflow-wrap: anywhere; }
        .metric-value small { color: var(--secondary-text-color); font-size: 12px; font-weight: 500; }
        .all-clear,.alert { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; }
        .all-clear { color: var(--success-color,#398a63); }
        .muted { color: var(--secondary-text-color); }
        .alert { color: var(--error-color,#c33); }
        .all-clear ha-icon,.alert ha-icon { --mdc-icon-size: 19px; }
        .status { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 10px; margin-top: 15px; }
        .status-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px;
          border: 1px solid var(--divider-color); border-radius: 14px; background: var(--secondary-background-color,rgba(127,127,127,.06)); }
        .status-row ha-icon { color: var(--accent-color,#35a9ba); --mdc-icon-size: 21px; }
        .status-row div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .status-label { color: var(--secondary-text-color); font-size: 11px; }
        .status-row strong { font-size: 14px; }
        .steps { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 5px;
          padding: 14px; border: 1px solid var(--divider-color); border-radius: 14px; background: var(--secondary-background-color,rgba(127,127,127,.06)); }
        .step { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--secondary-text-color); text-align: center; font-size: 10px; }
        .step-dot { display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid var(--divider-color); border-radius: 50%; font-size: 11px; }
        .step.complete .step-dot { color: var(--primary-color); border-color: var(--primary-color); }
        .step.current { color: var(--primary-text-color); font-weight: 650; }
        .step.current .step-dot { color: #fff; background: var(--primary-color); }
        .action { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; margin-top: 10px; padding: 12px 16px;
          border: 0; border-radius: 13px; color: #fff; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; }
        .action:hover:not(:disabled) { filter: brightness(1.08); }
        .danger { background: linear-gradient(110deg,#b64c43,#d06b56); }
        .secondary { background: linear-gradient(110deg,#247da9,#35a9ba); }
        button:focus-visible { outline: 3px solid var(--primary-color); outline-offset: 3px; }
        button:disabled { cursor: not-allowed; opacity: .55; }
        .scrim { position: fixed; z-index: 9999; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(0,0,0,.56); }
        .dialog { box-sizing: border-box; width: min(440px,100%); padding: 24px; color: var(--primary-text-color);
          background: var(--ha-card-background,var(--card-background-color)); border-radius: 22px; box-shadow: 0 18px 60px rgba(0,0,0,.3); }
        .dialog-icon { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 14px; color: var(--warning-color,#bd7918);
          border-radius: 16px; background: rgba(189,121,24,.12); }
        .dialog-icon ha-icon { --mdc-icon-size: 26px; }
        h2 { margin: 0 0 8px; font-size: 20px; }
        .dialog p { color: var(--secondary-text-color); font-size: 14px; line-height: 1.55; }
        .dialog .error { color: var(--error-color,#c33); }
        .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
        .dialog-actions button { min-height: 42px; padding: 0 14px; border: 0; border-radius: 11px; font: inherit; font-weight: 600; cursor: pointer; }
        .cancel { color: var(--primary-text-color); background: var(--secondary-background-color,rgba(127,127,127,.12)); }
        .confirm { color: #fff; background: var(--error-color,#bd4d43); }
        @media (max-width: 420px) {
          .content { padding: 17px; } .metrics { gap: 8px; }
          .metric { padding: 10px; gap: 8px; } .metric-value { font-size: 15px; }
          .dialog-actions { flex-direction: column-reverse; } .dialog-actions button { width: 100%; }
        }
      </style>
      <ha-card>
        <div class="content">
          <header class="heading">
            <div class="drop"><ha-icon icon="mdi:water"></ha-icon></div>
            <div><h1>${this._escape(this._config.title || this._text.title)}</h1>
              <span class="subtitle">${this._escape(this._config.subtitle || this._text.subtitle)}</span></div>
          </header>
          ${metrics ? `<div class="metrics">${metrics}</div>` : `<p class="muted">${this._text.noMetrics}</p>`}
          ${alertContent}
          ${statusPanel}
          ${regeneration}
          ${syncClock}
          ${this._error && !this._confirming ? `<p class="error" role="alert">${this._escape(this._error)}</p>` : ""}
        </div>
      </ha-card>
      ${dialog}`;

    if (this._confirming) {
      this.shadowRoot.querySelector(".cancel")?.focus();
    }
  }

  _renderMetric(entityId, icon) {
    const state = this._state(entityId);
    const value = state ? state.state : this._text.unavailable;
    const unit = state?.attributes?.unit_of_measurement || "";
    const label = state?.attributes?.friendly_name || entityId;
    return `<div class="metric">
      <ha-icon icon="${this._escape(icon)}"></ha-icon>
      <div class="metric-copy"><span class="metric-label">${this._escape(label)}</span>
        <span class="metric-value">${this._escape(value)}${unit ? ` <small>${this._escape(unit)}</small>` : ""}</span></div>
    </div>`;
  }

  _renderVacation() {
    if (!this._config.vacation_status) {
      return "";
    }
    const state = this._state(this._config.vacation_status);
    const vacationLabels = {
      off: this._hass.language?.toLowerCase().startsWith("hu") ? "Kikapcsolva" : "Off",
      preparing: this._hass.language?.toLowerCase().startsWith("hu") ? "Előkészítés" : "Preparing",
      active: this._hass.language?.toLowerCase().startsWith("hu") ? "Aktív" : "Active",
    };
    const value = state
      ? vacationLabels[state.state] || state.state
      : this._text.unavailable;
    return `<div class="status-row"><ha-icon icon="mdi:beach"></ha-icon>
      <div><span class="status-label">${this._text.vacation}</span><strong>${this._escape(value)}</strong></div></div>`;
  }

  async _runAction(entityId) {
    if (!entityId || this._sending) {
      return;
    }
    this._sending = true;
    this._error = "";
    this._render();
    try {
      await this._hass.callService("button", "press", { entity_id: entityId });
      this._confirming = false;
      this._pendingAction = null;
    } catch (error) {
      console.error("Could not run Runxin Local button", error);
      this._error = this._text.sendError;
    } finally {
      this._sending = false;
      this._render();
    }
  }
}

class YpsilonLocalCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._schema = [
      { name: "title", selector: { text: {} } },
      { name: "subtitle", selector: { text: {} } },
      { name: "flow_rate", selector: { entity: { domain: "sensor" } } },
      { name: "daily_water", selector: { entity: { domain: "sensor" } } },
      { name: "residual_water", selector: { entity: { domain: "sensor" } } },
      { name: "weekly_average", selector: { entity: { domain: "sensor" } } },
      { name: "station", selector: { entity: { domain: "sensor" } } },
      { name: "vacation_status", selector: { entity: { domain: "sensor" } } },
      { name: "alerts", selector: { entity: { domain: "binary_sensor", multiple: true } } },
      { name: "regeneration_button", selector: { entity: { domain: "button" } } },
      { name: "sync_clock_button", selector: { entity: { domain: "button" } } },
    ];
    this._labels = {
      hu: {
        title: "Kártya címe",
        subtitle: "Alcím",
        flow_rate: "Vízáramlás szenzor",
        daily_water: "Napi vízfogyasztás szenzor",
        residual_water: "Hátralévő kapacitás szenzor",
        weekly_average: "Heti átlag szenzor",
        station: "Működési állapot szenzor",
        vacation_status: "Távolléti mód állapota",
        alerts: "Riasztásérzékelők",
        regeneration_button: "Regenerálás gomb",
        sync_clock_button: "Óraszinkronizálás gomb",
      },
      en: {
        title: "Card title",
        subtitle: "Subtitle",
        flow_rate: "Flow rate sensor",
        daily_water: "Daily water sensor",
        residual_water: "Remaining capacity sensor",
        weekly_average: "Weekly average sensor",
        station: "Operating status sensor",
        vacation_status: "Vacation status sensor",
        alerts: "Alarm sensors",
        regeneration_button: "Regeneration button",
        sync_clock_button: "Sync clock button",
      },
    };
    this._onValueChanged = (event) => {
      event.stopPropagation();
      this._config = { ...this._config, ...event.detail.value };
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        }),
      );
    };
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }
    let form = this.shadowRoot.querySelector("ha-form");
    if (!form) {
      this.shadowRoot.innerHTML = "<ha-form></ha-form>";
      form = this.shadowRoot.querySelector("ha-form");
      form.addEventListener("value-changed", this._onValueChanged);
    }
    form.hass = this._hass;
    form.schema = this._schema;
    form.data = this._config;
    const language = (this._hass?.language || "").toLowerCase().startsWith("hu")
      ? "hu"
      : "en";
    const labels = this._labels[language];
    form.computeLabel = (schema) => labels[schema.name] || schema.name;
  }
}

if (!customElements.get("ypsilon-local-card")) {
  customElements.define("ypsilon-local-card", YpsilonLocalCard);
}
if (!customElements.get("ypsilon-local-card-editor")) {
  customElements.define("ypsilon-local-card-editor", YpsilonLocalCardEditor);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "ypsilon-local-card")) {
  window.customCards.push({
    type: "ypsilon-local-card",
    name: "Runxin Local",
    description: "Local water-softener dashboard with status, alerts and guarded controls.",
  });
}
