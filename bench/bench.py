#!/usr/bin/env python3
"""Banc de mesure de zalgo.gheop.com : coût au repos, chargement, latence de frappe.

Sert chaque version avec la vraie image nginx-unprivileged et web/nginx.conf
(gzip et en-têtes identiques à la prod), puis alterne les passes A/B dans un
Chrome headless neuf à chaque fois.

    bench/bench.py --a web                     # une seule version
    bench/bench.py --a /tmp/base/web --b web   # comparaison alternée
"""

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

IMAGE = "docker.io/nginxinc/nginx-unprivileged:1.29-alpine"
TEXT = "il vient, et personne ne l'arrêtera avant la fin du monde"
IDLE_WARMUP_S = 2
IDLE_WINDOW_S = 10
KEYSTROKES = 60
# Composition sur le GPU matériel. Sans ces options, Chrome headless compose
# en logiciel (SwiftShader), ce qui gonfle le coût de chaque calque plein écran.
GPU_ARGS = ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"]

# Math.random déterministe : le zalgo produit est le même à chaque passe
SEEDED_RANDOM = """
(() => {
  let a = 0x2545f491;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
"""

LOAD_METRICS_JS = """
async () => {
  const lcp = await new Promise((resolve) => {
    let last = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) last = e.startTime; })
      .observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => resolve(last), 300);
  });
  const nav = performance.getEntriesByType("navigation")[0];
  const res = performance.getEntriesByType("resource");
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  await document.fonts.ready;
  return {
    // FCP et LCP ne sont pas remontés quand Chrome headless compose sur GPU
    fcp_ms: fcp ? fcp.startTime : null,
    lcp_ms: lcp || null,
    load_ms: nav.loadEventEnd,
    // Fin de réception de la dernière police : le titre et le résultat sont alors dans leur police finale
    fonts_ms: Math.max(0, ...res.filter((r) => r.name.endsWith(".woff2")).map((r) => r.responseEnd)),
    bytes: nav.transferSize + res.reduce((s, r) => s + r.transferSize, 0),
  };
}
"""

TYPING_JS = """
async (n) => {
  const input = document.getElementById("src");
  const level = document.getElementById("level");
  level.value = 100;
  level.dispatchEvent(new Event("input"));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  await nextFrame();
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    input.value += "abcdefghij"[i % 10];
    input.dispatchEvent(new Event("input"));
    await nextFrame();
    samples.push(performance.now() - t0);
  }
  samples.sort((x, y) => x - y);
  return {
    type_med_ms: samples[Math.floor(n / 2)],
    type_p95_ms: samples[Math.floor(n * 0.95)],
  };
}
"""


def serve(web_dir: Path, port: int) -> str:
    name = f"zalgo-bench-{port}"
    subprocess.run(["podman", "rm", "-f", name], capture_output=True)
    conf = Path(__file__).resolve().parent.parent / "web" / "nginx.conf"
    subprocess.run([
        "podman", "run", "-d", "--rm", "--name", name, "-p", f"127.0.0.1:{port}:8080",
        "-v", f"{web_dir.resolve()}:/usr/share/nginx/html:ro,z",
        "-v", f"{conf}:/etc/nginx/conf.d/default.conf:ro,z",
        IMAGE,
    ], check=True, capture_output=True)
    for _ in range(50):
        if subprocess.run(["curl", "-sf", f"http://127.0.0.1:{port}/healthz"], capture_output=True).returncode == 0:
            return name
        time.sleep(0.1)
    sys.exit(f"le conteneur {name} ne répond pas")


def total_cpu(cdp) -> dict:
    info = cdp.send("SystemInfo.getProcessInfo")["processInfo"]
    by_type = {}
    for p in info:
        t = p["type"].lower()
        by_type[t] = by_type.get(t, 0.0) + p["cpuTime"]
    return by_type


def one_pass(pw, url: str, render: str) -> dict:
    browser = pw.chromium.launch(channel="chrome", headless=True, args=GPU_ARGS if render == "gpu" else [])
    try:
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx.add_init_script(SEEDED_RANDOM)
        page = ctx.new_page()
        page.goto(url, wait_until="load")
        load = page.evaluate(LOAD_METRICS_JS)

        page.fill("#src", TEXT)
        page.evaluate("document.activeElement.blur()")
        time.sleep(IDLE_WARMUP_S)
        bcdp = browser.new_browser_cdp_session()
        pcdp = ctx.new_cdp_session(page)
        pcdp.send("Performance.enable")
        m0 = {m["name"]: m["value"] for m in pcdp.send("Performance.getMetrics")["metrics"]}
        c0 = total_cpu(bcdp)
        time.sleep(IDLE_WINDOW_S)
        c1 = total_cpu(bcdp)
        m1 = {m["name"]: m["value"] for m in pcdp.send("Performance.getMetrics")["metrics"]}

        typing = page.evaluate(TYPING_JS, KEYSTROKES)
        pct = lambda d: 100 * d / IDLE_WINDOW_S
        return {
            **load,
            "idle_cpu_pct": pct(sum(c1.values()) - sum(c0.values())),
            "idle_renderer_pct": pct(c1.get("renderer", 0) - c0.get("renderer", 0)),
            "idle_gpu_pct": pct(c1.get("gpu", 0) - c0.get("gpu", 0)),
            "idle_main_thread_pct": pct(m1["TaskDuration"] - m0["TaskDuration"]),
            **typing,
        }
    finally:
        browser.close()


def summarize(runs: list[dict]) -> dict:
    out = {}
    for key in runs[0]:
        vals = [r[key] for r in runs if r[key] is not None]
        if not vals:
            continue
        med = statistics.median(vals)
        sd = statistics.stdev(vals) if len(vals) > 1 else 0.0
        out[key] = {"median": round(med, 3), "stdev": round(sd, 3),
                    "cv_pct": round(100 * sd / med, 1) if med else 0.0}
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True, type=Path, help="dossier web de la version A")
    ap.add_argument("--b", type=Path, help="dossier web de la version B (alternée avec A)")
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--out", type=Path, help="fichier JSON de résultats")
    ap.add_argument("--render", choices=["gpu", "software"], default="gpu",
                    help="composition GPU matériel (défaut) ou logicielle")
    args = ap.parse_args()

    versions = {"A": (args.a, 18081)}
    if args.b:
        versions["B"] = (args.b, 18082)
    containers = [serve(d, port) for d, port in versions.values()]
    results = {k: [] for k in versions}
    try:
        with sync_playwright() as pw:
            for i in range(args.runs):
                # Alterner l'ordre compense la dérive thermique
                order = list(versions) if i % 2 == 0 else list(reversed(versions))
                for k in order:
                    r = one_pass(pw, f"http://127.0.0.1:{versions[k][1]}/", args.render)
                    results[k].append(r)
                    print(f"[{i + 1}/{args.runs}] {k} " + " ".join(f"{m}={v:.2f}" for m, v in r.items() if v is not None), flush=True)
    finally:
        for c in containers:
            subprocess.run(["podman", "rm", "-f", c], capture_output=True)

    report = {
        "date": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "commit": subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip(),
        "command": " ".join(sys.argv),
        "env": {"chrome": "google-chrome headless (channel=chrome)", "render": args.render, "cpus": os.cpu_count(),
                "idle_window_s": IDLE_WINDOW_S, "keystrokes": KEYSTROKES},
        "versions": {k: {"dir": str(versions[k][0]), "summary": summarize(v), "runs": v} for k, v in results.items()},
    }
    print(json.dumps({k: v["summary"] for k, v in report["versions"].items()}, indent=1))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
