en css avanzanzado de elementor esta el css 

#baWizardApp {
  --foreground: #e8edf7;
  --surface: #101723;
  --surface-muted: #0c131f;
  --line: #273348;
  --accent: #f59e0b;
  --accent-strong: #d97706;
  --success: #22c55e;
  --danger: #ef4444;
  --bg-spot-1: #1a2740;
  --bg-spot-2: #2b1f0e;
  --bg-grad-start: #070b12;
  --bg-grad-mid: #0b1320;
  --bg-grad-end: #070b12;
  --question-start: #f8fafc;
  --question-mid: #9bb9f6;
  --question-end: #f59e0b;
  --font-main: "Sora", "Manrope", "Segoe UI", sans-serif;
  color: var(--foreground);
  font-family: var(--font-main);
}

#baWizardApp[data-theme="light"] {
  --foreground: #0f172a;
  --surface: #ffffff;
  --surface-muted: #eef3f9;
  --line: #c1d0e2;
  --accent: #ca8a04;
  --accent-strong: #a16207;
  --success: #15803d;
  --danger: #dc2626;
  --bg-spot-1: #cfe0ff;
  --bg-spot-2: #f7e2be;
  --bg-grad-start: #f2f6fb;
  --bg-grad-mid: #eef4fb;
  --bg-grad-end: #f8fbff;
  --question-start: #0f172a;
  --question-mid: #1d4ed8;
  --question-end: #a16207;
}

#baWizardApp .ba-shell {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 28px;
  background:
    radial-gradient(circle at 12% 18%, var(--bg-spot-1) 0%, transparent 32%),
    radial-gradient(circle at 90% 2%, var(--bg-spot-2) 0%, transparent 28%),
    linear-gradient(180deg, var(--bg-grad-start) 0%, var(--bg-grad-mid) 45%, var(--bg-grad-end) 100%);
  box-shadow:
    0 1px 2px color-mix(in srgb, #000 42%, transparent),
    0 14px 34px color-mix(in srgb, #000 30%, transparent);
}

#baWizardApp[data-theme="light"] .ba-shell {
  box-shadow:
    0 1px 2px color-mix(in srgb, #cbd5e1 70%, transparent),
    0 12px 26px color-mix(in srgb, #cbd5e1 55%, transparent);
}

#baWizardApp .ba-topbar {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
}

#baWizardApp .ba-topbar-actions {
  display: flex;
  gap: 10px;
}

#baWizardApp .ba-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-muted) 94%, transparent);
  color: var(--foreground);
  cursor: pointer;
  transition: .18s ease;
}

#baWizardApp .ba-icon-btn:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
  background: color-mix(in srgb, var(--surface) 95%, var(--accent) 6%);
}

#baWizardApp .ba-icon-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
  transform: none;
}

#baWizardApp .ba-icon-btn svg {
  width: 20px;
  height: 20px;
}

#baWizardApp .ba-progress-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-muted) 88%, transparent);
  overflow: hidden;
}

#baWizardApp .ba-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  transition: width .25s ease;
}

#baWizardApp .ba-body {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  min-height: 760px;
}

#baWizardApp .ba-sidebar {
  padding: 36px 28px;
  border-right: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  background: color-mix(in srgb, var(--surface-muted) 60%, transparent);
}

#baWizardApp .ba-kicker,
#baWizardApp .ba-step-label {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .28em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent) 86%, var(--foreground));
}

#baWizardApp .ba-sidebar-title {
  margin: 14px 0 10px;
  font-size: clamp(28px, 4vw, 42px);
  line-height: .96;
  letter-spacing: -.04em;
  color: var(--foreground);
}

#baWizardApp .ba-sidebar-copy,
#baWizardApp .ba-helper {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: color-mix(in srgb, var(--foreground) 72%, transparent);
}

#baWizardApp .ba-live-summary {
  display: grid;
  gap: 12px;
  margin-top: 28px;
}

#baWizardApp .ba-summary-item {
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
}

#baWizardApp .ba-summary-item small {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--foreground) 56%, transparent);
}

#baWizardApp .ba-summary-item strong {
  display: block;
  font-size: 15px;
  line-height: 1.45;
  color: var(--foreground);
}

#baWizardApp .ba-stage {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 26px;
  padding: 42px 38px 34px;
}

#baWizardApp .ba-question-wrap {
  max-width: 920px;
  margin: 0 auto;
  text-align: center;
}

#baWizardApp .ba-question {
  margin: 16px 0 10px;
  font-size: clamp(34px, 5vw, 58px);
  line-height: 1.05;
  letter-spacing: -.05em;
  background-image: linear-gradient(
    120deg,
    var(--question-start) 0%,
    var(--question-mid) 52%,
    var(--question-end) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

#baWizardApp .ba-response-area {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

#baWizardApp .ba-composer {
  display: grid;
  gap: 16px;
  width: min(920px, 100%);
  margin: 0 auto;
}

#baWizardApp .ba-input-shell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
}

#baWizardApp .ba-plus {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  font-size: 26px;
  line-height: 1;
}

#baWizardApp .ba-input,
#baWizardApp .ba-textarea,
#baWizardApp .ba-select,
#baWizardApp .ba-time,
#baWizardApp .ba-number {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  outline: none;
  background: color-mix(in srgb, var(--surface-muted) 88%, transparent);
  color: var(--foreground);
  font: inherit;
  border-radius: 18px;
  padding: 14px 16px;
  box-sizing: border-box;
}

#baWizardApp .ba-input:disabled {
  opacity: 1;
  cursor: not-allowed;
  background: color-mix(in srgb, var(--surface-muted) 96%, transparent);
}

#baWizardApp .ba-input,
#baWizardApp .ba-number,
#baWizardApp .ba-select,
#baWizardApp .ba-time {
  min-height: 54px;
  font-size: 16px;
}

#baWizardApp .ba-textarea {
  min-height: 120px;
  resize: vertical;
  font-size: 16px;
  line-height: 1.6;
}

#baWizardApp .ba-input::placeholder,
#baWizardApp .ba-textarea::placeholder {
  color: color-mix(in srgb, var(--foreground) 34%, transparent);
}

#baWizardApp .ba-input:focus,
#baWizardApp .ba-textarea:focus,
#baWizardApp .ba-select:focus,
#baWizardApp .ba-time:focus,
#baWizardApp .ba-number:focus {
  border-color: color-mix(in srgb, var(--accent) 72%, var(--line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

#baWizardApp .ba-action,
#baWizardApp .ba-action-secondary,
#baWizardApp .ba-action-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 18px;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition: .18s ease;
  box-sizing: border-box;
}

#baWizardApp .ba-action {
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
}

#baWizardApp .ba-action:hover {
  filter: brightness(1.03);
  transform: translateY(-1px);
}

#baWizardApp .ba-action-secondary {
  border: 1px solid color-mix(in srgb, var(--accent) 72%, var(--line));
  color: var(--foreground);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

#baWizardApp .ba-action-secondary:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  transform: translateY(-1px);
}

#baWizardApp .ba-action-danger {
  border: 1px solid color-mix(in srgb, var(--danger) 32%, var(--line));
  color: #ffd4d4;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

#baWizardApp .ba-options,
#baWizardApp .ba-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

#baWizardApp .ba-option {
  border: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--foreground);
  padding: 14px 18px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: .18s ease;
}

#baWizardApp .ba-option:hover,
#baWizardApp .ba-option.is-active {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 72%, var(--line));
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

#baWizardApp .ba-grid {
  display: grid;
  gap: 18px;
}

#baWizardApp .ba-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

#baWizardApp .ba-card {
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
}

#baWizardApp .ba-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

#baWizardApp .ba-card-title {
  margin: 0;
  font-size: 15px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--foreground) 72%, transparent);
}

#baWizardApp .ba-label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--foreground) 84%, transparent);
}

#baWizardApp .ba-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--foreground);
}

#baWizardApp .ba-list,
#baWizardApp .ba-review {
  display: grid;
  gap: 14px;
}

#baWizardApp .ba-password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

#baWizardApp .ba-note {
  max-width: 900px;
  margin: 0 auto;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--foreground);
  font-size: 14px;
  line-height: 1.55;
}

#baWizardApp .ba-note strong {
  color: var(--accent-strong);
}

#baWizardApp .ba-review-card {
  padding: 18px 20px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
}

#baWizardApp .ba-review-card small {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .18em;
  color: color-mix(in srgb, var(--foreground) 56%, transparent);
}

#baWizardApp .ba-review-card strong,
#baWizardApp .ba-review-card span {
  display: block;
  font-size: 16px;
  line-height: 1.55;
  color: var(--foreground);
}

#baWizardApp .ba-message {
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 700;
  box-sizing: border-box;
}

#baWizardApp .ba-message.is-error {
  border-color: color-mix(in srgb, var(--danger) 28%, transparent);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

#baWizardApp .ba-message.is-success {
  border-color: color-mix(in srgb, var(--success) 28%, transparent);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
}

/* contraste extra tema claro */
#baWizardApp[data-theme="light"] .ba-sidebar {
  background: rgba(255, 255, 255, 0.58);
}

#baWizardApp[data-theme="light"] .ba-kicker,
#baWizardApp[data-theme="light"] .ba-step-label,
#baWizardApp[data-theme="light"] .ba-card-title,
#baWizardApp[data-theme="light"] .ba-summary-item small,
#baWizardApp[data-theme="light"] .ba-review-card small {
  color: #8a6508;
}

#baWizardApp[data-theme="light"] .ba-sidebar-title,
#baWizardApp[data-theme="light"] .ba-sidebar-copy,
#baWizardApp[data-theme="light"] .ba-helper,
#baWizardApp[data-theme="light"] .ba-summary-item strong,
#baWizardApp[data-theme="light"] .ba-label,
#baWizardApp[data-theme="light"] .ba-switch,
#baWizardApp[data-theme="light"] .ba-note,
#baWizardApp[data-theme="light"] .ba-review-card strong,
#baWizardApp[data-theme="light"] .ba-review-card span,
#baWizardApp[data-theme="light"] .ba-option,
#baWizardApp[data-theme="light"] .ba-action-secondary,
#baWizardApp[data-theme="light"] .ba-icon-btn {
  color: #0f172a;
}

#baWizardApp[data-theme="light"] .ba-question {
  background-image: linear-gradient(
    120deg,
    #0f172a 0%,
    #1d4ed8 58%,
    #a16207 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

#baWizardApp[data-theme="light"] .ba-summary-item,
#baWizardApp[data-theme="light"] .ba-card,
#baWizardApp[data-theme="light"] .ba-review-card,
#baWizardApp[data-theme="light"] .ba-input-shell {
  background: rgba(255, 255, 255, 0.92);
  border-color: #c8d6e6;
}

#baWizardApp[data-theme="light"] .ba-input,
#baWizardApp[data-theme="light"] .ba-textarea,
#baWizardApp[data-theme="light"] .ba-select,
#baWizardApp[data-theme="light"] .ba-time,
#baWizardApp[data-theme="light"] .ba-number {
  color: #0f172a;
  background: #ffffff;
  border-color: #bfd0e4;
}

#baWizardApp[data-theme="light"] .ba-input:disabled {
  color: #0f172a;
  background: #f8fafc;
  border-color: #cbd5e1;
}

#baWizardApp[data-theme="light"] .ba-input::placeholder,
#baWizardApp[data-theme="light"] .ba-textarea::placeholder {
  color: #64748b;
}

#baWizardApp[data-theme="light"] .ba-note {
  background: #fff7e6;
  border-color: #ebc977;
  color: #0f172a;
}

#baWizardApp[data-theme="light"] .ba-option {
  background: #ffffff;
  border-color: #c8d6e6;
}

#baWizardApp[data-theme="light"] .ba-option.is-active,
#baWizardApp[data-theme="light"] .ba-option:hover {
  background: #fef3c7;
  border-color: #d4a017;
  color: #0f172a;
}

#baWizardApp[data-theme="light"] .ba-action-secondary {
  background: #fff7e6;
  border-color: #d6b04b;
  color: #0f172a;
}

#baWizardApp[data-theme="light"] .ba-action-danger {
  background: #fff1f2;
  border-color: #f1b3bb;
  color: #991b1b;
}

#baWizardApp[data-theme="light"] .ba-icon-btn {
  background: #ffffff;
  border-color: #c8d6e6;
}

#baWizardApp[data-theme="light"] .ba-message.is-success {
  background: #ecfdf3;
  border-color: #86efac;
  color: #166534;
}

#baWizardApp[data-theme="light"] .ba-message.is-error {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #991b1b;
}

@media (max-width: 1024px) {
  #baWizardApp .ba-body {
    grid-template-columns: 1fr;
  }

  #baWizardApp .ba-sidebar {
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  }

  #baWizardApp .ba-grid-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  #baWizardApp .ba-stage,
  #baWizardApp .ba-sidebar {
    padding: 28px 18px 22px;
  }

  #baWizardApp .ba-question {
    font-size: 36px;
  }

  #baWizardApp .ba-input-shell {
    grid-template-columns: 1fr;
  }

  #baWizardApp .ba-plus {
    display: none;
  }

  #baWizardApp .ba-action,
  #baWizardApp .ba-action-secondary,
  #baWizardApp .ba-action-danger {
    width: 100%;
  }

  #baWizardApp .ba-password-row {
    grid-template-columns: 1fr;
  }
}

#baWizardApp .ba-success-actions {
  justify-content: center;
  gap: 14px;
  margin-top: 8px;
}

#baWizardApp .ba-success-actions .ba-action,
#baWizardApp .ba-success-actions .ba-action-secondary {
  min-width: 260px;
}

@media (max-width: 768px) {
  #baWizardApp .ba-success-actions {
    width: 100%;
  }

  #baWizardApp .ba-success-actions .ba-action,
  #baWizardApp .ba-success-actions .ba-action-secondary {
    min-width: 100%;
  }
}


y este s el html y js 

<section class="ba-wizard" id="baWizardApp" data-theme="dark">
  <div class="ba-shell">
    <header class="ba-topbar">
      <button class="ba-icon-btn" type="button" id="baBackBtn" aria-label="Volver">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M15 18l-6-6 6-6"></path>
        </svg>
      </button>

      <div class="ba-progress-track" aria-hidden="true">
        <div class="ba-progress-fill" id="baProgressFill"></div>
      </div>

      <div class="ba-topbar-actions">
        <button class="ba-icon-btn ba-ghost" type="button" id="baResetBtn" aria-label="Reiniciar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
            <path d="M21 3v6h-6"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="ba-body">
      <aside class="ba-sidebar">
        <p class="ba-kicker">Onboarding guiado</p>
        <h2 class="ba-sidebar-title">Crea tu barberia paso a paso</h2>
        <p class="ba-sidebar-copy">
          Este wizard arma el payload exacto del onboarding y crea el admin con el correo que escribas aqui.
        </p>
        <div class="ba-live-summary" id="baLiveSummary"></div>
      </aside>

      <main class="ba-stage">
        <div class="ba-question-wrap">
          <p class="ba-step-label" id="baStepLabel">Paso 1</p>
          <h1 class="ba-question" id="baQuestion">Cargando...</h1>
          <p class="ba-helper" id="baHelper"></p>
        </div>

        <div class="ba-response-area" id="baResponseArea"></div>
        <div class="ba-message" id="baMessage" hidden></div>
      </main>
    </div>
  </div>
</section>
<script>
(() => {
  const boot = () => {
    if (window.__BA_WP_ONBOARDING_READY__) return;

    const app = document.getElementById("baWizardApp");
    if (!app) return;

    window.__BA_WP_ONBOARDING_READY__ = true;

    const API_URL = "https://barberagency-app.gymh5g.easypanel.host/api/onboarding/complete";
    const LANDING_BUILDER_URL = "https://barberagency-barberagency.gymh5g.easypanel.host/landing_plantilla/";
    const STORAGE_KEY = "ba_wp_onboarding_v9";
    const LANDING_SEED_KEY = "ba_landing_seed";

    const DAYS = [
      { value: "lunes", label: "Lunes" },
      { value: "martes", label: "Martes" },
      { value: "miercoles", label: "Miercoles" },
      { value: "jueves", label: "Jueves" },
      { value: "viernes", label: "Viernes" },
      { value: "sabado", label: "Sabado" },
      { value: "domingo", label: "Domingo" }
    ];

    const STEPS = [
      {
        key: "barberia.nombre",
        label: "Paso 1",
        prompt: "Como se llama tu barberia?",
        helper: "Este nombre se usara como base del negocio y del slug.",
        type: "text",
        required: true,
        placeholder: "Ej: Barberia Central"
      },
      {
        key: "barberia.ciudad",
        label: "Paso 2",
        prompt: "En que ciudad esta ubicada?",
        helper: "Usa el nombre tal como lo quieres mostrar al cliente.",
        type: "text",
        required: true,
        placeholder: "Ej: Bogota, D.C."
      },
      {
        key: "barberia.direccion",
        label: "Paso 3",
        prompt: "Cual es la direccion del local?",
        helper: "Ayuda a ubicar el negocio desde el primer dia.",
        type: "text",
        required: true,
        placeholder: "Ej: Calle 10 #20-30"
      },
      {
        key: "barberia.telefono",
        label: "Paso 4",
        prompt: "Cual es el telefono principal?",
        helper: "Lo usaremos como telefono del negocio.",
        type: "tel",
        required: true,
        placeholder: "Ej: 3001234567"
      },
      {
        key: "barberia.slot_min",
        label: "Paso 5",
        prompt: "Cada cuantos minutos quieres manejar la agenda?",
        helper: "Tu API acepta 5, 10, 15, 20 o 30 minutos.",
        type: "choice",
        required: true,
        options: [
          { label: "5 min", value: 5 },
          { label: "10 min", value: 10 },
          { label: "15 min", value: 15 },
          { label: "20 min", value: 20 },
          { label: "30 min", value: 30 }
        ]
      },
      {
        key: "accesos.admin.nombre",
        label: "Paso 6",
        prompt: "Como se llama el administrador principal?",
        helper: "Este usuario principal se creara con los datos que pongas aqui.",
        type: "text",
        required: true,
        placeholder: "Ej: Carlos Alvis"
      },
      {
        key: "accesos.admin.email",
        label: "Paso 7",
        prompt: "Cual sera el email del administrador principal?",
        helper: "Este correo se creara como acceso principal del negocio.",
        type: "email",
        required: true,
        placeholder: "Ej: admin@correo.com"
      },
      {
        key: "accesos.admin.password",
        label: "Paso 8",
        prompt: "Define la password del administrador.",
        helper: "Minimo 6 caracteres.",
        type: "password",
        required: true,
        placeholder: "Escribe la password"
      },
      {
        key: "servicios",
        label: "Paso 9",
        prompt: "Configura los servicios iniciales.",
        helper: "Cada servicio debe llevar nombre, duracion y precio.",
        type: "services",
        required: true
      },
      {
        key: "horarios",
        label: "Paso 10",
        prompt: "Define los horarios de atencion.",
        helper: "Debe quedar al menos un dia activo.",
        type: "hours",
        required: true
      },
      {
        key: "barberos",
        label: "Paso 11",
        prompt: "Quieres crear barberos desde una vez?",
        helper: "Este paso es opcional. Si agregas barberos, deben quedar completos.",
        type: "barbers",
        required: false
      },
      {
        key: "review",
        label: "Paso final",
        prompt: "Revisa el resumen y crea la barberia.",
        helper: "Se enviara el draft exacto que tu endpoint espera.",
        type: "review",
        required: true
      }
    ];

    const progressFill = document.getElementById("baProgressFill");
    const stepLabel = document.getElementById("baStepLabel");
    const question = document.getElementById("baQuestion");
    const helper = document.getElementById("baHelper");
    const responseArea = document.getElementById("baResponseArea");
    const liveSummary = document.getElementById("baLiveSummary");
    const messageBox = document.getElementById("baMessage");
    const backBtn = document.getElementById("baBackBtn");
    const resetBtn = document.getElementById("baResetBtn");

    let currentStepIndex = 0;
    let draft = normalizeDraft(loadDraft());
    let onboardingCompleted = false;
    let onboardingResult = null;

    syncThemeFromGlobal();

    function clean(value) {
      return (value || "").toString().trim();
    }

    function escapeHtml(value) {
      return clean(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function slugify(input) {
      return clean(input)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
    }

    function getDefaultDraft() {
      return {
        barberia: {
          nombre: "",
          slug: "",
          telefono: "",
          direccion: "",
          ciudad: "",
          timezone: "America/Bogota",
          slot_min: 15
        },
        servicios: [
          { nombre: "", duracion_min: 30, precio: 0 }
        ],
        horarios: DAYS.map((day, index) => ({
          dia: day.value,
          activo: index < 6,
          hora_abre: "08:00",
          hora_cierra: "19:00"
        })),
        barberos: [],
        accesos: {
          admin: {
            nombre: "",
            email: "",
            password: ""
          },
          barberos: []
        }
      };
    }

    function loadDraft() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    function detectGlobalTheme() {
      const body = document.body;
      const html = document.documentElement;

      if (body && body.classList.contains("light-mode")) return "light";
      if (html && html.classList.contains("light-mode")) return "light";
      if (body && body.classList.contains("dark-mode")) return "dark";
      if (html && html.classList.contains("dark-mode")) return "dark";
      if (body && body.dataset && body.dataset.theme === "light") return "light";
      if (html && html.dataset && html.dataset.theme === "light") return "light";
      if (body && body.dataset && body.dataset.theme === "dark") return "dark";
      if (html && html.dataset && html.dataset.theme === "dark") return "dark";

      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function syncThemeFromGlobal() {
      app.setAttribute("data-theme", detectGlobalTheme());
    }

    function normalizeDraft(raw) {
      const base = getDefaultDraft();
      const source = raw && typeof raw === "object" ? raw : {};

      const horariosRaw = Array.isArray(source.horarios) ? source.horarios : [];
      const horarios = DAYS.map((day, index) => {
        const found = horariosRaw.find((item) => clean(item.dia).toLowerCase() === day.value);
        return {
          dia: day.value,
          activo: found ? Boolean(found.activo) : index < 6,
          hora_abre: clean(found && found.hora_abre) || "08:00",
          hora_cierra: clean(found && found.hora_cierra) || "19:00"
        };
      });

      return {
        barberia: Object.assign({}, base.barberia, source.barberia || {}),
        servicios: Array.isArray(source.servicios) && source.servicios.length
          ? source.servicios.map((item) => ({
              nombre: clean(item.nombre),
              duracion_min: Number(item.duracion_min || 30),
              precio: Number(item.precio || 0)
            }))
          : base.servicios,
        horarios,
        barberos: Array.isArray(source.barberos) ? source.barberos : [],
        accesos: {
          admin: Object.assign({}, base.accesos.admin, source.accesos && source.accesos.admin ? source.accesos.admin : {}),
          barberos: Array.isArray(source.accesos && source.accesos.barberos) ? source.accesos.barberos : []
        }
      };
    }

    function saveDraft() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch (_) {}
      renderLiveSummary();
    }

    function getByPath(obj, path) {
      return path.split(".").reduce((acc, key) => {
        if (acc && typeof acc === "object" && key in acc) return acc[key];
        return "";
      }, obj);
    }

    function setByPath(obj, path, value) {
      const keys = path.split(".");
      let ref = obj;
      for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (!ref[key] || typeof ref[key] !== "object") ref[key] = {};
        ref = ref[key];
      }
      ref[keys[keys.length - 1]] = value;
    }

    function setFieldValue(path, value) {
      setByPath(draft, path, value);
      if (path === "barberia.nombre") {
        draft.barberia.slug = slugify(value);
      }
      saveDraft();
    }

    function hideMessage() {
      messageBox.hidden = true;
      messageBox.className = "ba-message";
      messageBox.textContent = "";
    }

    function showMessage(type, text) {
      messageBox.hidden = false;
      messageBox.className = "ba-message is-" + type;
      messageBox.textContent = text;
    }

    function resetDraft() {
      draft = normalizeDraft(null);
      currentStepIndex = 0;
      onboardingCompleted = false;
      onboardingResult = null;
      hideMessage();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      render();
    }

    function progressPercent() {
      return ((currentStepIndex + 1) / STEPS.length) * 100;
    }

    function nextStep() {
      if (currentStepIndex < STEPS.length - 1) {
        currentStepIndex += 1;
        hideMessage();
        render();
      }
    }

    function prevStep() {
      if (currentStepIndex > 0) {
        currentStepIndex -= 1;
        hideMessage();
        render();
      }
    }

    function getBarberRows() {
      const rows = [];
      const count = Math.max(
        Array.isArray(draft.barberos) ? draft.barberos.length : 0,
        draft.accesos && Array.isArray(draft.accesos.barberos) ? draft.accesos.barberos.length : 0
      );

      for (let i = 0; i < count; i += 1) {
        const barber = draft.barberos[i] || {};
        const access = draft.accesos.barberos[i] || {};
        rows.push({
          nombre: clean(barber.nombre) || clean(access.nombre),
          email: clean(access.email),
          password: access.password || "",
          activo: barber.activo !== undefined ? Boolean(barber.activo) : Boolean(access.activo)
        });
      }

      return rows;
    }

    function setBarberRows(rows) {
      draft.barberos = rows.map((row) => ({
        nombre: clean(row.nombre),
        activo: Boolean(row.activo)
      }));

      draft.accesos.barberos = rows.map((row) => ({
        nombre: clean(row.nombre),
        email: clean(row.email).toLowerCase(),
        password: clean(row.password),
        activo: Boolean(row.activo)
      }));

      saveDraft();
    }

    function validateBarberRows(rows) {
      const normalized = rows.map((row, index) => ({
        _index: index + 1,
        nombre: clean(row.nombre),
        email: clean(row.email).toLowerCase(),
        password: clean(row.password),
        activo: Boolean(row.activo)
      }));

      const filled = normalized.filter((row) => row.nombre || row.email || row.password);

      for (let i = 0; i < filled.length; i += 1) {
        const row = filled[i];

        if (!row.nombre) return { ok: false, message: "Barbero " + row._index + ": falta el nombre." };
        if (!row.email) return { ok: false, message: "Barbero " + row._index + ": falta el email." };
        if (!isValidEmail(row.email)) return { ok: false, message: "Barbero " + row._index + ": el email no es valido." };
        if (!row.password) return { ok: false, message: "Barbero " + row._index + ": falta la password." };
        if (row.password.length < 6) return { ok: false, message: "Barbero " + row._index + ": la password debe tener minimo 6 caracteres." };
      }

      return {
        ok: true,
        rows: filled.map((row) => ({
          nombre: row.nombre,
          email: row.email,
          password: row.password,
          activo: row.activo
        }))
      };
    }

    function renderLiveSummary() {
      const activeDays = (draft.horarios || []).filter((item) => item.activo).length;

      const entries = [
        ["Barberia", draft.barberia.nombre],
        ["Ciudad", draft.barberia.ciudad],
        ["Telefono", draft.barberia.telefono],
        ["Slug", draft.barberia.slug],
        ["Admin", draft.accesos.admin.email],
        ["Servicios", String((draft.servicios || []).filter((item) => clean(item.nombre)).length)],
        ["Dias activos", String(activeDays)]
      ].filter((entry) => clean(entry[1]));

      liveSummary.innerHTML = entries.length
        ? entries.map((entry) => `
            <article class="ba-summary-item">
              <small>${escapeHtml(entry[0])}</small>
              <strong>${escapeHtml(entry[1])}</strong>
            </article>
          `).join("")
        : `
            <article class="ba-summary-item">
              <small>Resumen</small>
              <strong>Tu progreso aparecera aqui mientras completas el wizard.</strong>
            </article>
          `;
    }

    function renderTextStep(step) {
      const value = getByPath(draft, step.key) || "";
      const isPassword = step.type === "password";

      responseArea.innerHTML = `
        <div class="ba-composer">
          <div class="ba-input-shell">
            <button class="ba-plus" type="button" disabled>+</button>
            <input class="ba-input" id="baAnswerInput" type="${isPassword ? "password" : step.type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(step.placeholder || "")}" />
            ${isPassword ? '<button class="ba-action-secondary" type="button" id="baTogglePasswordBtn">Mostrar</button>' : (step.required ? '<span></span>' : '<button class="ba-action-secondary" type="button" id="baSkipBtn">Omitir</button>')}
            <button class="ba-action" type="button" id="baNextBtn">Continuar</button>
          </div>
        </div>
      `;

      const input = document.getElementById("baAnswerInput");
      const nextBtn = document.getElementById("baNextBtn");
      const skipBtn = document.getElementById("baSkipBtn");
      const toggleBtn = document.getElementById("baTogglePasswordBtn");

      nextBtn.addEventListener("click", () => {
        const answer = clean(input.value);

        if (step.required && !answer) {
          showMessage("error", "Este campo es obligatorio.");
          return;
        }

        if (step.type === "email" && answer && !isValidEmail(answer)) {
          showMessage("error", "Escribe un email valido.");
          return;
        }

        if (step.type === "password" && answer && answer.length < 6) {
          showMessage("error", "La password debe tener minimo 6 caracteres.");
          return;
        }

        setFieldValue(step.key, step.type === "email" ? answer.toLowerCase() : answer);
        nextStep();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          nextBtn.click();
        }
      });

      if (skipBtn) {
        skipBtn.addEventListener("click", () => {
          setFieldValue(step.key, "");
          nextStep();
        });
      }

      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          toggleBtn.textContent = hidden ? "Ocultar" : "Mostrar";
        });
      }

      setTimeout(() => input.focus(), 60);
    }

    function renderChoiceStep(step) {
      const selected = String(getByPath(draft, step.key));

      responseArea.innerHTML = `
        <div class="ba-composer">
          <div class="ba-options">
            ${step.options.map((option) => `
              <button type="button" class="ba-option ${selected === String(option.value) ? "is-active" : ""}" data-value="${escapeHtml(String(option.value))}">
                ${escapeHtml(option.label)}
              </button>
            `).join("")}
          </div>
        </div>
      `;

      Array.from(responseArea.querySelectorAll(".ba-option")).forEach((button) => {
        button.addEventListener("click", () => {
          setFieldValue(step.key, Number(button.dataset.value));
          nextStep();
        });
      });
    }

    function renderServicesStep() {
      const services = Array.isArray(draft.servicios) && draft.servicios.length
        ? draft.servicios
        : [{ nombre: "", duracion_min: 30, precio: 0 }];

      responseArea.innerHTML = `
        <div class="ba-composer">
          <div class="ba-list" id="baServicesList">
            ${services.map((service, index) => `
              <article class="ba-card">
                <div class="ba-card-head">
                  <h3 class="ba-card-title">Servicio ${index + 1}</h3>
                  <button class="ba-action-danger" type="button" data-remove="${index}">Eliminar</button>
                </div>

                <div class="ba-grid ba-grid-2">
                  <label class="ba-label">
                    Nombre
                    <input class="ba-input" type="text" data-field="nombre" data-index="${index}" value="${escapeHtml(service.nombre || "")}" placeholder="Ej: Corte clasico" />
                  </label>

                  <label class="ba-label">
                    Duracion (min)
                    <select class="ba-select" data-field="duracion_min" data-index="${index}">
                      ${[5, 10, 15, 20, 30, 45, 60].map((value) => `
                        <option value="${value}" ${Number(service.duracion_min) === value ? "selected" : ""}>${value} min</option>
                      `).join("")}
                    </select>
                  </label>

                  <label class="ba-label">
                    Precio
                    <input class="ba-number" type="number" min="0" step="1000" data-field="precio" data-index="${index}" value="${Number(service.precio || 0)}" />
                  </label>
                </div>
              </article>
            `).join("")}
          </div>

          <div class="ba-inline">
            <button class="ba-action-secondary" type="button" id="baAddServiceBtn">Agregar servicio</button>
            <button class="ba-action" type="button" id="baContinueServicesBtn">Continuar</button>
          </div>
        </div>
      `;

      const list = document.getElementById("baServicesList");

      Array.from(list.querySelectorAll("[data-field]")).forEach((input) => {
        input.addEventListener("input", syncServicesFromDom);
        input.addEventListener("change", syncServicesFromDom);
      });

      Array.from(list.querySelectorAll("[data-remove]")).forEach((button) => {
        button.addEventListener("click", () => {
          const next = getServicesFromDom();
          next.splice(Number(button.dataset.remove), 1);
          draft.servicios = next.length ? next : [{ nombre: "", duracion_min: 30, precio: 0 }];
          saveDraft();
          render();
        });
      });

      document.getElementById("baAddServiceBtn").addEventListener("click", () => {
        const next = getServicesFromDom();
        next.push({ nombre: "", duracion_min: 30, precio: 0 });
        draft.servicios = next;
        saveDraft();
        render();
      });

      document.getElementById("baContinueServicesBtn").addEventListener("click", () => {
        const rows = getServicesFromDom()
          .map((item) => ({
            nombre: clean(item.nombre),
            duracion_min: Number(item.duracion_min || 0),
            precio: Math.max(0, Number(item.precio || 0))
          }))
          .filter((item) => clean(item.nombre));

        if (!rows.length) {
          showMessage("error", "Debes crear al menos un servicio.");
          return;
        }

        if (rows.some((item) => !item.nombre || item.duracion_min <= 0)) {
          showMessage("error", "Cada servicio debe tener nombre y duracion valida.");
          return;
        }

        draft.servicios = rows;
        saveDraft();
        nextStep();
      });

      function syncServicesFromDom() {
        draft.servicios = getServicesFromDom();
        saveDraft();
      }

      function getServicesFromDom() {
        return Array.from(document.querySelectorAll("#baServicesList [data-index]"))
          .reduce((acc, node) => {
            const index = Number(node.dataset.index);
            if (!acc[index]) acc[index] = { nombre: "", duracion_min: 30, precio: 0 };
            if (node.dataset.field === "nombre") acc[index].nombre = node.value;
            if (node.dataset.field === "duracion_min") acc[index].duracion_min = Number(node.value || 0);
            if (node.dataset.field === "precio") acc[index].precio = Math.max(0, Number(node.value || 0));
            return acc;
          }, [])
          .filter(Boolean);
      }
    }

    function renderHoursStep() {
      const rows = Array.isArray(draft.horarios) && draft.horarios.length
        ? draft.horarios
        : getDefaultDraft().horarios;

      responseArea.innerHTML = `
        <div class="ba-composer">
          <div class="ba-grid ba-grid-2" id="baHoursGrid">
            ${rows.map((row, index) => `
              <article class="ba-card">
                <div class="ba-card-head">
                  <h3 class="ba-card-title">${escapeHtml(DAYS[index].label)}</h3>
                  <label class="ba-switch">
                    <input type="checkbox" data-hour-field="activo" data-hour-index="${index}" ${row.activo ? "checked" : ""} />
                    Activo
                  </label>
                </div>

                <div class="ba-grid ba-grid-2">
                  <label class="ba-label">
                    Hora abre
                    <input class="ba-time" type="time" data-hour-field="hora_abre" data-hour-index="${index}" value="${escapeHtml(row.hora_abre || "08:00")}" />
                  </label>

                  <label class="ba-label">
                    Hora cierra
                    <input class="ba-time" type="time" data-hour-field="hora_cierra" data-hour-index="${index}" value="${escapeHtml(row.hora_cierra || "19:00")}" />
                  </label>
                </div>
              </article>
            `).join("")}
          </div>

          <div class="ba-inline">
            <button class="ba-action" type="button" id="baContinueHoursBtn">Continuar</button>
          </div>
        </div>
      `;

      Array.from(document.querySelectorAll("[data-hour-field]")).forEach((input) => {
        input.addEventListener("input", syncHoursFromDom);
        input.addEventListener("change", syncHoursFromDom);
      });

      document.getElementById("baContinueHoursBtn").addEventListener("click", () => {
        const hours = getHoursFromDom();
        const active = hours.filter((item) => item.activo);

        if (!active.length) {
          showMessage("error", "Debes dejar al menos un dia activo.");
          return;
        }

        if (active.some((item) => !clean(item.hora_abre) || !clean(item.hora_cierra) || item.hora_cierra <= item.hora_abre)) {
          showMessage("error", "Revisa los horarios activos. La hora de cierre debe ser mayor.");
          return;
        }

        draft.horarios = hours;
        saveDraft();
        nextStep();
      });

      function syncHoursFromDom() {
        draft.horarios = getHoursFromDom();
        saveDraft();
      }

      function getHoursFromDom() {
        return DAYS.map((day, index) => {
          const activeInput = document.querySelector('[data-hour-field="activo"][data-hour-index="' + index + '"]');
          const openInput = document.querySelector('[data-hour-field="hora_abre"][data-hour-index="' + index + '"]');
          const closeInput = document.querySelector('[data-hour-field="hora_cierra"][data-hour-index="' + index + '"]');

          return {
            dia: day.value,
            activo: Boolean(activeInput && activeInput.checked),
            hora_abre: clean(openInput && openInput.value) || "08:00",
            hora_cierra: clean(closeInput && closeInput.value) || "19:00"
          };
        });
      }
    }

    function renderBarbersStep() {
      const rows = getBarberRows();

      responseArea.innerHTML = `
        <div class="ba-composer">
          <div class="ba-list" id="baBarbersList">
            ${rows.map((row, index) => `
              <article class="ba-card">
                <div class="ba-card-head">
                  <h3 class="ba-card-title">Barbero ${index + 1}</h3>
                  <div class="ba-inline">
                    <label class="ba-switch">
                      <input type="checkbox" data-barber-field="activo" data-barber-index="${index}" ${row.activo ? "checked" : ""} />
                      Activo
                    </label>
                    <button class="ba-action-danger" type="button" data-barber-remove="${index}">Eliminar</button>
                  </div>
                </div>

                <div class="ba-grid ba-grid-2">
                  <label class="ba-label">
                    Nombre
                    <input class="ba-input" type="text" data-barber-field="nombre" data-barber-index="${index}" value="${escapeHtml(row.nombre || "")}" placeholder="Ej: York" />
                  </label>

                  <label class="ba-label">
                    Email
                    <input class="ba-input" type="email" data-barber-field="email" data-barber-index="${index}" value="${escapeHtml(row.email || "")}" placeholder="Ej: york@correo.com" />
                  </label>

                  <label class="ba-label">
                    Password
                    <div class="ba-password-row">
                      <input class="ba-input" type="password" data-barber-field="password" data-barber-index="${index}" value="${escapeHtml(row.password || "")}" placeholder="Minimo 6 caracteres" />
                      <button class="ba-action-secondary" type="button" data-toggle-pass="${index}">Mostrar</button>
                    </div>
                  </label>
                </div>
              </article>
            `).join("")}
          </div>

          <div class="ba-inline">
            <button class="ba-action-secondary" type="button" id="baAddBarberBtn">Agregar barbero</button>
            <button class="ba-action-secondary" type="button" id="baSkipBarbersBtn">Continuar sin barberos</button>
            <button class="ba-action" type="button" id="baContinueBarbersBtn">Continuar</button>
          </div>
        </div>
      `;

      const list = document.getElementById("baBarbersList");

      Array.from(list.querySelectorAll("[data-barber-field]")).forEach((input) => {
        input.addEventListener("input", syncBarbersFromDom);
        input.addEventListener("change", syncBarbersFromDom);
      });

      Array.from(list.querySelectorAll("[data-barber-remove]")).forEach((button) => {
        button.addEventListener("click", () => {
          const next = getBarbersFromDom();
          next.splice(Number(button.dataset.barberRemove), 1);
          setBarberRows(next);
          render();
        });
      });

      Array.from(list.querySelectorAll("[data-toggle-pass]")).forEach((button) => {
        button.addEventListener("click", () => {
          const index = button.dataset.togglePass;
          const input = document.querySelector('[data-barber-field="password"][data-barber-index="' + index + '"]');
          if (!input) return;
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          button.textContent = hidden ? "Ocultar" : "Mostrar";
        });
      });

      document.getElementById("baAddBarberBtn").addEventListener("click", () => {
        const next = getBarbersFromDom();
        next.push({ nombre: "", email: "", password: "", activo: true });
        setBarberRows(next);
        render();
      });

      document.getElementById("baSkipBarbersBtn").addEventListener("click", () => {
        setBarberRows([]);
        nextStep();
      });

      document.getElementById("baContinueBarbersBtn").addEventListener("click", () => {
        const validation = validateBarberRows(getBarbersFromDom());

        if (!validation.ok) {
          showMessage("error", validation.message);
          return;
        }

        setBarberRows(validation.rows);
        nextStep();
      });

      function syncBarbersFromDom() {
        setBarberRows(getBarbersFromDom());
      }

      function getBarbersFromDom() {
        const rowsFromDom = [];
        const cards = document.querySelectorAll("#baBarbersList .ba-card");

        cards.forEach((card) => {
          const nameInput = card.querySelector('[data-barber-field="nombre"]');
          const emailInput = card.querySelector('[data-barber-field="email"]');
          const passInput = card.querySelector('[data-barber-field="password"]');
          const activeInput = card.querySelector('[data-barber-field="activo"]');

          rowsFromDom.push({
            nombre: clean(nameInput && nameInput.value),
            email: clean(emailInput && emailInput.value),
            password: clean(passInput && passInput.value),
            activo: Boolean(activeInput && activeInput.checked)
          });
        });

        return rowsFromDom;
      }
    }

    function buildReviewCards() {
      const activeDays = (draft.horarios || [])
        .filter((item) => item.activo)
        .map((item) => item.dia + " " + item.hora_abre + "-" + item.hora_cierra);

      const services = (draft.servicios || [])
        .filter((item) => clean(item.nombre))
        .map((item) => item.nombre + " | " + item.duracion_min + " min | $" + Number(item.precio || 0).toLocaleString("es-CO"));

      const barbers = getBarberRows()
        .filter((item) => clean(item.nombre))
        .map((item) => item.nombre + " | " + item.email);

      return `
        <div class="ba-review">
          <article class="ba-review-card">
            <small>Barberia</small>
            <strong>${escapeHtml(draft.barberia.nombre)}</strong>
            <span>${escapeHtml(draft.barberia.ciudad)} | ${escapeHtml(draft.barberia.direccion)}</span>
            <span>Telefono: ${escapeHtml(draft.barberia.telefono)}</span>
            <span>Slug: ${escapeHtml(draft.barberia.slug)}</span>
            <span>Timezone: ${escapeHtml(draft.barberia.timezone)}</span>
            <span>Slot: ${escapeHtml(String(draft.barberia.slot_min))} min</span>
          </article>

          <article class="ba-review-card">
            <small>Administrador</small>
            <strong>${escapeHtml(draft.accesos.admin.nombre)}</strong>
            <span>${escapeHtml(draft.accesos.admin.email)}</span>
          </article>

          <article class="ba-review-card">
            <small>Servicios</small>
            <span>${services.length ? services.map(escapeHtml).join("<br>") : "Sin servicios"}</span>
          </article>

          <article class="ba-review-card">
            <small>Horarios activos</small>
            <span>${activeDays.length ? activeDays.map(escapeHtml).join("<br>") : "Sin horarios"}</span>
          </article>

          <article class="ba-review-card">
            <small>Barberos</small>
            <span>${barbers.length ? barbers.map(escapeHtml).join("<br>") : "No se crearan barberos en este envio"}</span>
          </article>
        </div>
      `;
    }

    function renderReviewStep() {
      if (onboardingCompleted) {
        responseArea.innerHTML = `
          <div class="ba-composer">
            ${buildReviewCards()}

            <div class="ba-inline ba-success-actions">
              <button class="ba-action-secondary" type="button" id="baEditAfterSuccessBtn">
                Editar
              </button>
              <button class="ba-action" type="button" id="baGoLandingBtn">
                Ir a crear mi web de reservas
              </button>
            </div>
          </div>
        `;

        const editBtn = document.getElementById("baEditAfterSuccessBtn");
        const goBtn = document.getElementById("baGoLandingBtn");

        if (editBtn) {
          editBtn.addEventListener("click", () => {
            onboardingCompleted = false;
            hideMessage();
            currentStepIndex = 0;
            render();
          });
        }

        if (goBtn) {
          goBtn.addEventListener("click", () => {
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch (_) {}
            window.location.href = LANDING_BUILDER_URL;
          });
        }

        return;
      }

      responseArea.innerHTML = `
        <div class="ba-composer">
          ${buildReviewCards()}

          <div class="ba-inline">
            <button class="ba-action-secondary" type="button" id="baEditBtn">Volver a editar</button>
            <button class="ba-action" type="button" id="baSubmitBtn">Crear barberia</button>
          </div>
        </div>
      `;

      document.getElementById("baEditBtn").addEventListener("click", () => {
        currentStepIndex = 0;
        render();
      });

      document.getElementById("baSubmitBtn").addEventListener("click", submitDraft);
    }

    function persistLandingSeed(payload, data) {
      const landingSeed = {
        source: "onboarding_complete",
        created_at: new Date().toISOString(),
        barberia: {
          id: data && data.barberia ? data.barberia.id : null,
          slug: data && data.barberia ? data.barberia.slug : (payload.draft.barberia.slug || ""),
          nombre: payload.draft.barberia.nombre || "",
          ciudad: payload.draft.barberia.ciudad || "",
          direccion: payload.draft.barberia.direccion || "",
          telefono: payload.draft.barberia.telefono || "",
          timezone: payload.draft.barberia.timezone || "America/Bogota",
          slot_min: payload.draft.barberia.slot_min || 15
        },
        servicios: payload.draft.servicios || [],
        horarios: payload.draft.horarios || [],
        barberos: payload.draft.accesos && payload.draft.accesos.barberos ? payload.draft.accesos.barberos : [],
        onboarding_result: data || {}
      };

      try {
        sessionStorage.setItem(LANDING_SEED_KEY, JSON.stringify(landingSeed));
      } catch (_) {
        try {
          localStorage.setItem(LANDING_SEED_KEY, JSON.stringify(landingSeed));
        } catch (__){}
      }
    }

    async function submitDraft() {
      hideMessage();

      const barberValidation = validateBarberRows(getBarberRows());
      if (!barberValidation.ok) {
        showMessage("error", barberValidation.message);
        return;
      }

      setBarberRows(barberValidation.rows);

      const payload = {
        draft: {
          barberia: {
            nombre: clean(draft.barberia.nombre),
            slug: clean(draft.barberia.slug) || slugify(draft.barberia.nombre),
            telefono: clean(draft.barberia.telefono),
            direccion: clean(draft.barberia.direccion),
            ciudad: clean(draft.barberia.ciudad),
            timezone: clean(draft.barberia.timezone) || "America/Bogota",
            slot_min: Number(draft.barberia.slot_min || 15)
          },
          servicios: (draft.servicios || [])
            .filter((item) => clean(item.nombre))
            .map((item) => ({
              nombre: clean(item.nombre),
              duracion_min: Number(item.duracion_min || 0),
              precio: Math.max(0, Number(item.precio || 0))
            })),
          horarios: (draft.horarios || []).map((item) => ({
            dia: clean(item.dia),
            activo: Boolean(item.activo),
            hora_abre: clean(item.hora_abre),
            hora_cierra: clean(item.hora_cierra)
          })),
          barberos: (draft.barberos || [])
            .filter((item) => clean(item.nombre))
            .map((item) => ({
              nombre: clean(item.nombre),
              activo: Boolean(item.activo)
            })),
          accesos: {
            admin: {
              nombre: clean(draft.accesos.admin.nombre),
              email: clean(draft.accesos.admin.email).toLowerCase(),
              password: clean(draft.accesos.admin.password)
            },
            barberos: (draft.accesos.barberos || [])
              .filter((item) => clean(item.nombre))
              .map((item) => ({
                nombre: clean(item.nombre),
                email: clean(item.email).toLowerCase(),
                password: clean(item.password),
                activo: Boolean(item.activo)
              }))
          }
        }
      };

      if (!payload.draft.barberia.nombre) {
        showMessage("error", "Falta el nombre de la barberia.");
        return;
      }

      if (!isValidEmail(payload.draft.accesos.admin.email)) {
        showMessage("error", "El email del administrador no es valido.");
        return;
      }

      if ((payload.draft.accesos.admin.password || "").length < 6) {
        showMessage("error", "La password del administrador debe tener minimo 6 caracteres.");
        return;
      }

      if (!payload.draft.servicios.length) {
        showMessage("error", "Debes crear al menos un servicio.");
        return;
      }

      if (!payload.draft.horarios.some((item) => item.activo)) {
        showMessage("error", "Debes dejar al menos un horario activo.");
        return;
      }

      const submitBtn = document.getElementById("baSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creando...";
      }

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.ok === false) {
          throw new Error(data.message || "No se pudo crear la barberia.");
        }

        persistLandingSeed(payload, data);
        onboardingCompleted = true;
        onboardingResult = data;
        showMessage("success", data.message || "Barberia creada correctamente.");
        render();
      } catch (error) {
        showMessage(
          "error",
          error && error.message
            ? error.message
            : "Fallo el envio. Si WordPress y la API viven en dominios diferentes, revisa CORS o usa n8n como puente."
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Crear barberia";
        }
      }
    }

    function render() {
      syncThemeFromGlobal();

      const step = STEPS[currentStepIndex];
      progressFill.style.width = progressPercent() + "%";
      stepLabel.textContent = step.label;
      question.textContent = step.prompt;
      helper.textContent = step.helper || "";

      if (step.type === "text" || step.type === "email" || step.type === "tel" || step.type === "password") {
        renderTextStep(step);
      } else if (step.type === "choice") {
        renderChoiceStep(step);
      } else if (step.type === "services") {
        renderServicesStep();
      } else if (step.type === "hours") {
        renderHoursStep();
      } else if (step.type === "barbers") {
        renderBarbersStep();
      } else if (step.type === "review") {
        renderReviewStep();
      }

      backBtn.disabled = currentStepIndex === 0;
      renderLiveSummary();
    }

    const themeObserver = new MutationObserver(() => {
      syncThemeFromGlobal();
    });

    if (document.body) {
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme"]
      });
    }

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });

    backBtn.addEventListener("click", prevStep);
    resetBtn.addEventListener("click", resetDraft);

    render();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
</script>



