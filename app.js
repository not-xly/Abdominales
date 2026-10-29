// Semana fija: domingo 25 oct 2026 a sábado 31 oct 2026 (mes en base 1).
const WEEK_START = { year: 2026, month: 10, day: 25 };
const GOAL_ABS = 100;
const GOAL_SERIES_PER_ARM = 4;
const GOAL_SERIES = GOAL_SERIES_PER_ARM * 2;
const GOOD_FROM = 75;
const STORAGE_KEY = "abdominales-v1";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const data = loadData();
const daysEl = document.getElementById("days");
const todayKey = keyOf(new Date());

for (let i = 0; i < 7; i++) {
  const date = dayAt(i);
  const key = keyOf(date);
  const isToday = key === todayKey;
  const label = `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  daysEl.insertAdjacentHTML("beforeend", `
    <article class="day${isToday ? " today" : ""}" data-key="${key}">
      <header class="day-head">
        <h2>${label}</h2>
        ${isToday ? '<span class="hoy">Hoy</span>' : ""}
      </header>
      <div class="row">
        <span class="name">Abdominales</span>
        <input type="number" inputmode="numeric" min="0" data-field="abs" aria-label="Abdominales ${label}">
        <span class="goal">/ ${GOAL_ABS}</span>
        <span class="badge" data-pct="abs">0%</span>
      </div>
      <div class="row">
        <span class="name">Pesas</span>
        <span></span>
        <span class="goal">${GOAL_SERIES_PER_ARM} por brazo</span>
        <span class="badge" data-pct="pesas">0%</span>
      </div>
      <div class="row">
        <span class="name indent">Izquierdo</span>
        <input type="number" inputmode="numeric" min="0" data-field="izq" aria-label="Series brazo izquierdo ${label}">
        <span class="goal">/ ${GOAL_SERIES_PER_ARM} series</span>
        <span></span>
      </div>
      <div class="row">
        <span class="name indent">Derecho</span>
        <input type="number" inputmode="numeric" min="0" data-field="der" aria-label="Series brazo derecho ${label}">
        <span class="goal">/ ${GOAL_SERIES_PER_ARM} series</span>
        <span></span>
      </div>
    </article>`);
}

for (const card of daysEl.querySelectorAll(".day")) {
  const rec = data[card.dataset.key] || {};
  for (const input of card.querySelectorAll("input[data-field]")) {
    input.value = rec[input.dataset.field] ?? "";
  }
  refreshDay(card);
}
refreshSummary();

daysEl.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.matches("input[data-field]")) return;
  const card = input.closest(".day");
  const rec = data[card.dataset.key] || (data[card.dataset.key] = {});
  rec[input.dataset.field] = input.value;
  saveData();
  refreshDay(card);
  refreshSummary();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

function dayAt(offset) {
  return new Date(WEEK_START.year, WEEK_START.month - 1, WEEK_START.day + offset);
}

function keyOf(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Lo que se escribe puede ser vacío o no numérico: cuenta como 0.
function toCount(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Lo que pasa del máximo cuenta como 100 %: cada brazo se capa a 4 series y el día a 100.
function dayCounts(rec) {
  return {
    abs: Math.min(toCount(rec.abs), GOAL_ABS),
    series: Math.min(toCount(rec.izq), GOAL_SERIES_PER_ARM) + Math.min(toCount(rec.der), GOAL_SERIES_PER_ARM),
  };
}

function percent(done, goal) {
  return Math.min(100, Math.round((done / goal) * 100));
}

function setBadge(el, value) {
  el.textContent = `${value} %`;
  el.classList.toggle("good", value >= GOOD_FROM);
  el.classList.toggle("bad", value < GOOD_FROM);
}

function refreshDay(card) {
  const { abs, series } = dayCounts(data[card.dataset.key] || {});
  setBadge(card.querySelector('[data-pct="abs"]'), percent(abs, GOAL_ABS));
  setBadge(card.querySelector('[data-pct="pesas"]'), percent(series, GOAL_SERIES));
}

function refreshSummary() {
  let abs = 0;
  let series = 0;
  for (let i = 0; i < 7; i++) {
    const day = dayCounts(data[keyOf(dayAt(i))] || {});
    abs += day.abs;
    series += day.series;
  }
  const goalAbs = GOAL_ABS * 7;
  const goalSeries = GOAL_SERIES * 7;
  document.getElementById("sumAbsTxt").textContent = `${abs} / ${goalAbs}`;
  document.getElementById("sumPesasTxt").textContent = `${series} / ${goalSeries} series`;
  setBadge(document.getElementById("sumAbs"), percent(abs, goalAbs));
  setBadge(document.getElementById("sumPesas"), percent(series, goalSeries));
}
