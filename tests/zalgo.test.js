import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ABOVE, ALL_PARTS, BELOW, OVERLAY, corrupt, purify } from "../web/zalgo.js";

const MARK = /\p{M}/u;
const stripMarks = (s) => s.normalize("NFD").replace(/\p{M}/gu, "");
// Découpe en graphèmes simples : une lettre suivie de ses marques
const clusters = (s) => s.match(/\P{M}\p{M}*/gu) ?? [];

test("niveau 0 rend le texte intact", () => {
  assert.equal(corrupt("il vient", 0, ALL_PARTS, 1), "il vient");
});

test("la corruption garde les lettres d'origine", () => {
  for (const level of [0.1, 0.5, 1]) {
    assert.equal(stripMarks(corrupt("Il vient 2026", level, ALL_PARTS, 42)), "Il vient 2026");
  }
});

test("seules les lettres et chiffres reçoivent des marques", () => {
  const out = corrupt("a, b! 3?", 1, ALL_PARTS, 7);
  for (const c of clusters(out)) {
    if (!/[\p{L}\p{N}]/u.test(c[0])) assert.equal(c.length, 1, `« ${c[0]} » ne doit pas être marqué`);
  }
});

test("même graine, même résultat ; autre graine, autre résultat", () => {
  const text = "personne ne l'arrêtera";
  assert.equal(corrupt(text, 0.6, ALL_PARTS, 123), corrupt(text, 0.6, ALL_PARTS, 123));
  assert.notEqual(corrupt(text, 0.6, ALL_PARTS, 123), corrupt(text, 0.6, ALL_PARTS, 124));
});

test("taper une lettre de plus ne change pas les précédentes", () => {
  const before = corrupt("il vien", 0.8, ALL_PARTS, 99);
  assert.ok(corrupt("il vient", 0.8, ALL_PARTS, 99).startsWith(before));
});

test("les zones désactivées ne reçoivent aucune marque", () => {
  const only = (parts, allowed) => {
    const out = corrupt("zalgo arrive", 1, parts, 5);
    for (const ch of out) if (MARK.test(ch)) assert.ok(allowed.includes(ch), `U+${ch.codePointAt(0).toString(16)} hors zone`);
    assert.ok(MARK.test(out), "au moins une marque attendue");
  };
  only({ above: true, through: false, below: false }, ABOVE);
  only({ above: false, through: false, below: true }, BELOW);
  only({ above: false, through: true, below: false }, OVERLAY);
});

test("à 100 %, chaque lettre est barrée", () => {
  const out = corrupt("zalgo", 1, { above: false, through: true, below: false }, 3);
  for (const c of clusters(out)) assert.ok(OVERLAY.includes(c[1]), `« ${c[0]} » non barrée`);
});

test("l'intensité augmente le nombre de marques", () => {
  const count = (level) => [...corrupt("il vient et personne ne l'arrêtera", level, ALL_PARTS, 11)].filter((c) => MARK.test(c)).length;
  assert.ok(count(0.1) < count(0.5) && count(0.5) < count(1));
});

test("purifier retire le zalgo et garde les accents français", () => {
  assert.equal(purify("Ċorr̃p̃tioṅ ! My̳ ḃitch"), "Corrption ! My bitch");
  assert.equal(purify("l'arrêtera, ça, où, Noël, ñ"), "l'arrêtera, ça, où, Noël, ñ");
  assert.equal(purify("é̴̖ z̵̗a̶lgo"), "e zalgo");
});

test("purifier annule une corruption forte", () => {
  const text = "il vient et personne ne l'arretera";
  for (let seed = 0; seed < 20; seed++) assert.equal(purify(corrupt(text, 1, ALL_PARTS, seed)), text);
});

test("mêmes listes de marques que zalgo.py", () => {
  const py = execFileSync("python3", ["-c",
    "import json, sys; sys.path.insert(0, '.'); import zalgo; print(json.dumps([zalgo.OVERLAY, zalgo.ABOVE, zalgo.BELOW]))",
  ], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(py), [OVERLAY, ABOVE, BELOW]);
});
