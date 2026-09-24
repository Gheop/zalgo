import { ALL_PARTS, corrupt, purify, rand32 } from "./zalgo.js";
import { LANGS, STRINGS, countLabel, pickLang } from "./i18n.js";

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
const langSelect = $("lang");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const parts = { ...ALL_PARTS };
let seed = rand32();
let result = "";
let lang = "en";
let t = STRINGS.en;

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
  const i = v === 0 ? 0 : v < 20 ? 1 : v < 45 ? 2 : v < 70 ? 3 : v < 90 ? 4 : 5;
  return i === 5 ? corrupt(t.levels[5], 0.25, ALL_PARTS, 7) : t.levels[i];
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
  count.textContent = input.value ? countLabel(lang, n) : "";
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
  if (!ok) throw new Error("copy refused");
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
    copyLabel.textContent = t.copy;
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
    notify(t.toastEmpty, t.liveEmpty);
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(result);
    else fallbackCopy(result);
  } catch {
    try { fallbackCopy(result); } catch {
      notify(t.toastRefused, t.liveRefused);
      return;
    }
  }
  restart(out, "taken");
  copyBtn.classList.add("done");
  copyLabel.textContent = t.copied;
  notify(t.toastCopied, t.liveCopied);
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

let whisper = 0;
function tickWhisper() {
  if (!input.value && document.activeElement !== input) {
    input.classList.add("fade");
    setTimeout(() => {
      whisper = (whisper + 1) % t.whispers.length;
      input.placeholder = t.whispers[whisper];
      input.classList.remove("fade");
    }, 600);
  }
  document.title = corrupt("zalgo", 0.2, ALL_PARTS, rand32());
}

// Textes statiques en anglais dans le HTML, remplacés ici selon la langue
function applyLang(code) {
  lang = code;
  t = STRINGS[code];
  document.documentElement.lang = code;
  document.querySelector('meta[name="description"]').content = t.description;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t[el.dataset.i18n];
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t[el.dataset.i18nTitle];
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t[el.dataset.i18nAria]);
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.dataset.placeholder = t[el.dataset.i18nPlaceholder];
  sub.textContent = corrupt(t.tagline, 0.12, ALL_PARTS, 1337);
  whisper = 0;
  input.placeholder = t.whispers[0];
  if (!copyBtn.classList.contains("done")) copyLabel.textContent = t.copy;
  langSelect.value = code;
}

const LANG_STORE = "zalgo:lang";
function initLang() {
  let saved = null;
  try { saved = localStorage.getItem(LANG_STORE); } catch { /* stockage indisponible */ }
  const param = new URLSearchParams(location.search).get("lang");
  for (const [code, name] of Object.entries(LANGS)) langSelect.add(new Option(name, code));
  applyLang(pickLang({ param, saved, browser: navigator.languages ?? [navigator.language] }));
  langSelect.addEventListener("change", () => {
    applyLang(langSelect.value);
    render();
    try { localStorage.setItem(LANG_STORE, lang); } catch { /* navigation privée */ }
  });
  document.documentElement.classList.add("i18n");
}

initLang();
load();
autogrow();
render();
if (reducedMotion) {
  title.textContent = corrupt("zalgo", 0.2, ALL_PARTS, 666);
} else {
  tickTitle();
  setInterval(tickWhisper, 4200);
}
if (matchMedia("(hover: hover)").matches) input.focus();
