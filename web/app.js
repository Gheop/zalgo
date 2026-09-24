import { ALL_PARTS, corrupt, purify, rand32 } from "./zalgo.js";

const $ = (id) => document.getElementById(id);
const input = $("src");
const out = $("out");
const level = $("level");
const levelVal = $("level-val");
const count = $("count");
const echo = $("echo");
const copyBtn = $("copy");
const copyLabel = $("copy-label");
const toast = $("toast");
const live = $("live");
const purifyBtn = $("purify");
const title = $("title");
const sub = $("sub");
const chips = [...document.querySelectorAll(".chip[data-part]")];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const parts = { ...ALL_PARTS };
let seed = rand32();
let result = "";

const STORE = "zalgo:v1";
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!saved) return;
    if (typeof saved.text === "string") input.value = saved.text;
    if (Number.isFinite(saved.level)) level.value = saved.level;
    if (saved.parts) Object.assign(parts, saved.parts);
    if (Number.isFinite(saved.seed)) seed = saved.seed;
  } catch { /* stockage indisponible : on part des valeurs par défaut */ }
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ text: input.value, level: +level.value, parts, seed }));
  } catch { /* navigation privée : tant pis */ }
}

function levelName(v) {
  if (v === 0) return "pur";
  if (v < 20) return "murmure";
  if (v < 45) return "trouble";
  if (v < 70) return "possédé";
  if (v < 90) return "abîme";
  return corrupt("IL VIENT", 0.25, ALL_PARTS, 7);
}

function autogrow() {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + 2 + "px";
}

function render() {
  const v = +level.value;
  result = corrupt(input.value, v / 100, parts, seed);
  out.textContent = result;
  echo.textContent = result.slice(0, 600);
  level.style.setProperty("--p", v + "%");
  levelVal.textContent = levelName(v);
  const n = [...result].length;
  count.textContent = input.value ? `${n} caractère${n > 1 ? "s" : ""}` : "";
  purifyBtn.classList.toggle("hot", purify(input.value) !== input.value.normalize("NFC"));
  chips.forEach((b) => b.setAttribute("aria-pressed", parts[b.dataset.part]));
  save();
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copie refusée");
}

let toastTimer;
function notify(msg, readable) {
  toast.textContent = corrupt(msg, 0.28, ALL_PARTS, rand32());
  toast.classList.add("show");
  live.textContent = readable;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    copyBtn.classList.remove("done");
    copyLabel.textContent = "copier";
  }, 1500);
}

function restart(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

async function copy() {
  if (!result) {
    input.focus();
    notify("écris d'abord", "Écris d'abord un texte.");
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(result);
    else fallbackCopy(result);
  } catch {
    try { fallbackCopy(result); } catch {
      notify("refusé", "Le navigateur a refusé la copie. Sélectionne le résultat à la main.");
      return;
    }
  }
  restart(out, "taken");
  copyBtn.classList.add("done");
  copyLabel.textContent = "copié";
  notify("copié", "Copié dans le presse-papiers.");
}

function reroll() {
  seed = rand32();
  render();
  restart(out, "shiver");
}

input.addEventListener("input", () => { autogrow(); render(); });
level.addEventListener("input", render);
chips.forEach((b) => b.addEventListener("click", () => {
  parts[b.dataset.part] = !parts[b.dataset.part];
  render();
}));
$("reroll").addEventListener("click", reroll);
purifyBtn.addEventListener("click", () => {
  input.value = purify(input.value);
  autogrow();
  render();
  input.focus();
});
copyBtn.addEventListener("click", copy);
out.addEventListener("click", copy);
out.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copy(); }
  else if (e.altKey && e.code === "KeyR") { e.preventDefault(); reroll(); }
});

if (/Mac|iPhone|iPad/.test(navigator.platform)) $("kbd").textContent = "⌘ ↵";

// Lueur, grain et dérive de l'écho suivent l'horloge du titre (~8 images/s).
// En animations CSS infinies, Chrome recomposait toute la page à 60 images/s,
// flous compris, pour des écarts invisibles d'une image à l'autre. Seuls
// transform et opacity changent, sur des calques à part : pas de repeinture.
const glow = $("glow");
const fx = $("fx");
function ambient(t) {
  glow.style.opacity = (0.775 + 0.225 * Math.cos((2 * Math.PI * t) / 9)).toFixed(3);
  fx.style.transform = `translate(${(Math.random() * 14 - 7).toFixed(1)}%, ${(Math.random() * 16 - 8).toFixed(1)}%)`;
  // Aller-retour de 40 s, même amplitude que l'ancienne animation drift
  const p = (1 - Math.cos((Math.PI * t) / 40)) / 2;
  echo.style.transform = `translate(${(-2 + 4 * p).toFixed(2)}%, ${(-1 + 2.5 * p).toFixed(2)}%) `
    + `rotate(${(-1.5 + 2.5 * p).toFixed(2)}deg) scale(${(1.02 - 0.04 * p).toFixed(4)})`;
}

// Le titre se recorrompt en continu, avec de rares secousses
function tickTitle() {
  if (!document.hidden) {
    const burst = Math.random() < 0.07;
    title.textContent = corrupt("zalgo", burst ? 0.7 : 0.05 + Math.random() * 0.15, ALL_PARTS, rand32());
    title.parentElement.classList.toggle("burst", burst);
    if (burst) {
      const s = title.parentElement.style;
      s.setProperty("--jx", (Math.random() * 14 - 7).toFixed(1) + "px");
      s.setProperty("--jy", (Math.random() * 6 - 3).toFixed(1) + "px");
      s.setProperty("--sk", (Math.random() * 20 - 10).toFixed(1) + "deg");
    }
    ambient(performance.now() / 1000);
  }
  setTimeout(tickTitle, 90 + Math.random() * 80);
}

const WHISPERS = [
  "écris ce qui doit être corrompu…",
  "il attend ton texte…",
  "nomme-le, et il viendra…",
  "chaque lettre a un prix…",
  "tape. ne regarde pas derrière toi.",
];
let whisper = 0;
function tickWhisper() {
  if (!input.value && document.activeElement !== input) {
    input.classList.add("fade");
    setTimeout(() => {
      whisper = (whisper + 1) % WHISPERS.length;
      input.placeholder = WHISPERS[whisper];
      input.classList.remove("fade");
    }, 600);
  }
  document.title = corrupt("zalgo", 0.2, ALL_PARTS, rand32());
}

load();
sub.textContent = corrupt("il vient", 0.12, ALL_PARTS, 1337);
autogrow();
render();
if (reducedMotion) {
  title.textContent = corrupt("zalgo", 0.2, ALL_PARTS, 666);
} else {
  tickTitle();
  setInterval(tickWhisper, 4200);
}
if (matchMedia("(hover: hover)").matches) input.focus();
