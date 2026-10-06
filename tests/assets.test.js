import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const web = new URL("../web/", import.meta.url);
const read = (path) => readFileSync(new URL(path, web), "utf8");

test("chaque police citée par le CSS et le HTML existe", () => {
  const refs = [...`${read("style.css")}\n${read("index.html")}`.matchAll(/fonts\/[\w.-]+\.woff2/g)].map((m) => m[0]);
  assert.ok(refs.length >= 4);
  for (const ref of refs) assert.ok(existsSync(new URL(ref, web)), `${ref} introuvable`);
});

test("le nom de chaque police contient l'empreinte de son contenu", () => {
  // Cache immutable d'un an côté nginx : modifier une police sans la renommer
  // la rendrait invisible aux visiteurs qui l'ont déjà
  for (const name of readdirSync(new URL("fonts/", web))) {
    const hash = createHash("sha256").update(readFileSync(new URL(`fonts/${name}`, web))).digest("hex").slice(0, 8);
    assert.match(name, new RegExp(`\\.${hash}\\.woff2$`), `${name} : renommer en *.${hash}.woff2`);
  }
});
