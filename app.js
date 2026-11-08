// Ejercicios disponibles. El id es la clave con la que se guarda cada valor.
const EXERCISES = [
  { id: "abs", name: "Abdominales", short: "Abdominales", unit: "", target: 100 },
  { id: "bici", name: "Bicicleta", short: "Bicicleta", unit: "min", target: 20 },
  { id: "flex", name: "Flexiones", short: "Flexiones", unit: "", target: 20 },
  { id: "izq", name: "Pesas brazo izquierdo", short: "Pesas izq.", unit: "series", target: 4 },
  { id: "der", name: "Pesas brazo derecho", short: "Pesas der.", unit: "series", target: 4 },
];
const GOOD_FROM = 75;
const MAX_DAYS = 120;
const RECORDS_KEY = "abdominales-v1";
const CONFIG_KEY = "abdominales-config-v1";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// records: { "2026-11-08": { abs: "100", izq: "4", ... } }
// config: { start, end, chosen: [ids], targets: { id: n } } o null si aún no hay periodo.
let records = loadJSON(RECORDS_KEY, {});
let config = loadJSON(CONFIG_KEY, null);
let active = [];

const setupEl = document.getElementById("setup");
const setupForm = document.getElementById("setupForm");
const setupError = document.getElementById("setupError");
const setupCancel = document.getElementById("setupCancel");
const exerciseOptions = document.getElementById("exerciseOptions");
const editBtn = document.getElementById("editBtn");
const resetBtn = document.getElementById("resetBtn");
const periodLabel = document.getElementById("periodLabel");
const trackingEl = document.getElementById("tracking");
const summaryEl = document.getElementById("summary");
const daysEl = document.getElementById("days");

editBtn.addEventListener("click", showSetup);
setupCancel.addEventListener("click", showTracking);
resetBtn.addEventListener("click", resetAll);

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const next = readSetup();
  if (!next) return;
  config = next;
  saveJSON(CONFIG_KEY, config);
  showTracking();
});

daysEl.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.matches("input[data-field]")) return;
  const card = input.closest(".day");
  const rec = records[card.dataset.key] || (records[card.dataset.key] = {});
  rec[input.dataset.field] = input.value;
  saveJSON(RECORDS_KEY, records);
  refreshDay(card);
  refreshSummary();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

if (config) {
  showTracking();
} else {
  showSetup();
}

function showSetup() {
  const start = config ? config.start : keyOf(new Date());
  const end = config ? config.end : keyOf(addDays(new Date(), 6));
  setupForm.elements.start.value = start;
  setupForm.elements.end.value = end;
  exerciseOptions.innerHTML = EXERCISES.map((ex) => {
    const checked = !config || config.chosen.includes(ex.id);
    const target = config?.targets?.[ex.id] ?? ex.target;
    return `
      <div class="ex-option">
        <input type="checkbox" name="chosen" value="${ex.id}" id="chk-${ex.id}"${checked ? " checked" : ""}>
        <label for="chk-${ex.id}" class="ex-name">${ex.name}</label>
        <input type="number" inputmode="numeric" min="1" name="target-${ex.id}" value="${target}" aria-label="Objetivo de ${ex.name}">
        <span class="unit">${ex.unit || "reps"}</span>
      </div>`;
  }).join("");
  setupError.hidden = true;
  setupCancel.hidden = !config;
  setupEl.hidden = false;
  trackingEl.hidden = true;
  editBtn.hidden = true;
  resetBtn.hidden = true;
}

// Borra anotaciones y periodo, y vuelve al formulario inicial.
function resetAll() {
  if (!confirm("¿Borrar todas las anotaciones y el periodo, y empezar de nuevo?")) return;
  records = {};
  config = null;
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(CONFIG_KEY);
  showSetup();
}

// Devuelve la configuración leída del formulario, o null si hay un error (y lo muestra).
function readSetup() {
  const { start, end } = setupForm.elements;
  const fail = (msg) => {
    setupError.textContent = msg;
    setupError.hidden = false;
    return null;
  };
  if (!start.value || !end.value) return fail("Elige el día de inicio y el de final.");
  if (end.value < start.value) return fail("El final tiene que ser igual o posterior al inicio.");
  const days = Math.round((parseKey(end.value) - parseKey(start.value)) / 86400000) + 1;
  if (days > MAX_DAYS) return fail(`El periodo puede tener como máximo ${MAX_DAYS} días.`);

  const chosen = [];
  const targets = {};
  for (const ex of EXERCISES) {
    const target = parseInt(setupForm.elements[`target-${ex.id}`].value, 10);
    const valid = Number.isFinite(target) && target > 0;
    if (setupForm.querySelector(`input[name="chosen"][value="${ex.id}"]`).checked) {
      if (!valid) return fail(`Pon un objetivo mayor que 0 para ${ex.name}.`);
      chosen.push(ex.id);
    }
    targets[ex.id] = valid ? target : ex.target;
  }
  if (!chosen.length) return fail("Elige al menos un ejercicio.");
  return { start: start.value, end: end.value, chosen, targets };
}

function showTracking() {
  active = EXERCISES
    .filter((ex) => config.chosen.includes(ex.id))
    .map((ex) => ({ ...ex, target: config.targets[ex.id] }));

  const dates = periodDates();
  const first = dates[0];
  const last = dates[dates.length - 1];
  periodLabel.textContent = dates.length > 1
    ? `${fmtDay(first)} – ${fmtDay(last)} ${last.getFullYear()}`
    : `${fmtDay(first)} ${first.getFullYear()}`;

  summaryEl.innerHTML = `
    <div class="sum-card">
      <p class="sum-title"></p>
      ${active.map((ex) => `
        <div class="sum-row">
          <span class="name">${ex.short}</span>
          <span class="sum-value" data-sum-txt="${ex.id}"></span>
          <span class="badge" data-sum-pct="${ex.id}">0%</span>
        </div>`).join("")}
    </div>`;

  daysEl.innerHTML = dates.map(dayCard).join("");
  for (const card of daysEl.querySelectorAll(".day")) {
    const rec = records[card.dataset.key] || {};
    for (const input of card.querySelectorAll("input[data-field]")) {
      input.value = rec[input.dataset.field] ?? "";
    }
    refreshDay(card);
  }
  refreshSummary();

  setupEl.hidden = true;
  trackingEl.hidden = false;
  editBtn.hidden = false;
  resetBtn.hidden = false;
}

function dayCard(date) {
  const key = keyOf(date);
  const label = `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const isToday = key === keyOf(new Date());
  const rows = active.map((ex) => `
      <div class="row">
        <span class="name">${ex.short}</span>
        <input type="number" inputmode="numeric" min="0" data-field="${ex.id}" aria-label="${ex.name} ${label}">
        <span class="goal">/ ${ex.target}${ex.unit ? " " + ex.unit : ""}</span>
        <span class="badge" data-pct="${ex.id}">0%</span>
      </div>`).join("");
  return `
    <article class="day${isToday ? " today" : ""}" data-key="${key}">
      <header class="day-head">
        <h2>${label}</h2>
        ${isToday ? '<span class="hoy">Hoy</span>' : ""}
      </header>${rows}
    </article>`;
}

function refreshDay(card) {
  const rec = records[card.dataset.key] || {};
  for (const ex of active) {
    const done = Math.min(toCount(rec[ex.id]), ex.target);
    setBadge(card.querySelector(`[data-pct="${ex.id}"]`), percent(done, ex.target));
  }
}

// Compara lo hecho hasta hoy con el objetivo acumulado hasta hoy, no con el periodo entero.
function refreshSummary() {
  const dates = periodDates();
  const today = keyOf(new Date());
  const elapsed = dates.filter((date) => keyOf(date) <= today).length;
  const keys = dates.slice(0, elapsed).map(keyOf);
  summaryEl.querySelector(".sum-title").textContent = elapsed === 0
    ? "El periodo aún no ha empezado"
    : `Acumulado hasta ${fmtDay(dates[elapsed - 1])} · día ${elapsed} de ${dates.length}`;
  for (const ex of active) {
    const total = keys.reduce((sum, key) => {
      const rec = records[key] || {};
      return sum + Math.min(toCount(rec[ex.id]), ex.target);
    }, 0);
    const goal = ex.target * keys.length;
    summaryEl.querySelector(`[data-sum-txt="${ex.id}"]`).textContent =
      `${total} / ${goal}${ex.unit ? " " + ex.unit : ""}`;
    setBadge(summaryEl.querySelector(`[data-sum-pct="${ex.id}"]`), goal ? percent(total, goal) : null);
  }
}

// Días del periodo, de inicio a final incluidos.
function periodDates() {
  const dates = [];
  for (let d = parseKey(config.start); keyOf(d) <= config.end && dates.length < MAX_DAYS; d = addDays(d, 1)) {
    dates.push(d);
  }
  return dates;
}

function fmtDay(date) {
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function keyOf(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Lo que se escribe puede ser vacío o no numérico: cuenta como 0.
function toCount(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Lo que pasa del objetivo cuenta como 100 %.
function percent(done, goal) {
  return Math.min(100, Math.round((done / goal) * 100));
}

// value null: todavía no hay objetivo acumulado; se muestra neutro.
function setBadge(el, value) {
  if (value === null) {
    el.textContent = "–";
    el.classList.remove("good", "bad");
    return;
  }
  el.textContent = `${value} %`;
  el.classList.toggle("good", value >= GOOD_FROM);
  el.classList.toggle("bad", value < GOOD_FROM);
}
