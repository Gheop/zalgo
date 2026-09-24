import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_LANG, LANGS, STRINGS, countLabel, pickLang } from "../web/i18n.js";

const shape = (v) => (Array.isArray(v) ? `array:${v.length}` : typeof v === "object" ? `object:${Object.keys(v).sort()}` : typeof v);

test("chaque langue a toutes les clés de l'anglais, de même forme", () => {
  const ref = STRINGS[DEFAULT_LANG];
  for (const code of Object.keys(LANGS)) {
    const s = STRINGS[code];
    assert.ok(s, `${code} absent de STRINGS`);
    assert.deepEqual(Object.keys(s).sort(), Object.keys(ref).sort(), `clés de ${code}`);
    for (const k of Object.keys(ref)) assert.equal(shape(s[k]), shape(ref[k]), `${code}.${k}`);
    for (const [k, v] of Object.entries(s)) if (typeof v === "string") assert.ok(v.trim(), `${code}.${k} vide`);
  }
  assert.deepEqual(Object.keys(STRINGS).sort(), Object.keys(LANGS).sort());
});

test("6 niveaux, 5 murmures et un {n} dans chaque forme du compteur", () => {
  for (const [code, s] of Object.entries(STRINGS)) {
    assert.equal(s.levels.length, 6, code);
    assert.equal(s.whispers.length, 5, code);
    for (const form of Object.values(s.count)) assert.ok(form.includes("{n}"), `${code}: ${form}`);
  }
});

test("chaque clé utilisée dans index.html existe", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-\w+)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10);
  for (const k of keys) assert.ok(k in STRINGS.en, `clé inconnue : ${k}`);
});

test("choix de la langue : URL, puis choix mémorisé, puis navigateur, puis anglais", () => {
  assert.equal(pickLang({ param: "es", saved: "de", browser: ["fr-FR"] }), "es");
  assert.equal(pickLang({ param: "xx", saved: "de", browser: ["fr-FR"] }), "de");
  assert.equal(pickLang({ browser: ["ja-JP", "fr-CA", "en"] }), "fr");
  assert.equal(pickLang({ browser: ["pt-BR"] }), "pt");
  assert.equal(pickLang({ browser: ["NL_be"] }), "nl");
  assert.equal(pickLang({ browser: ["ja-JP", "zh"] }), "en");
  assert.equal(pickLang({}), "en");
  assert.equal(pickLang(), "en");
});

test("compteur au singulier et au pluriel", () => {
  assert.equal(countLabel("fr", 1), "1 caractère");
  assert.equal(countLabel("fr", 2), "2 caractères");
  assert.equal(countLabel("en", 1), "1 character");
  assert.equal(countLabel("en", 5), "5 characters");
  assert.equal(countLabel("de", 5), "5 Zeichen");
  assert.equal(countLabel("en", 1234), "1,234 characters");
});
