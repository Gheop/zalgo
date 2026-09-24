#!/usr/bin/env python3
"""Test de fumée : les fonctions de la page marchent, sans erreur console ni violation CSP.

    python3 tests/e2e.py web
"""

import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bench"))
import bench  # noqa: E402

MARK = r"/\p{M}/u"


def check(cond: bool, what: str, failures: list) -> None:
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        failures.append(what)


def main() -> None:
    web = Path(sys.argv[1] if len(sys.argv) > 1 else "web")
    name = bench.serve(web, 18090)
    failures = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel="chrome", headless=True)
            ctx = browser.new_context(locale="fr-FR", permissions=["clipboard-read", "clipboard-write"])
            page = ctx.new_page()
            errors = []
            page.on("console", lambda m: m.type in ("error", "warning") and errors.append(m.text))
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto("http://127.0.0.1:18090/", wait_until="load")

            page.fill("#src", "il vient")
            out = page.text_content("#out")
            check(out.startswith("i") and page.evaluate(f"(s) => {MARK}.test(s)", out), "le résultat est corrompu", failures)
            check(page.evaluate("(s) => s.normalize('NFD').replace(/\\p{M}/gu, '')", out) == "il vient", "le résultat garde les lettres", failures)

            page.fill("#level", "0")
            page.dispatch_event("#level", "input")
            check(page.text_content("#out") == "il vient", "niveau 0 = texte pur", failures)
            page.fill("#level", "60")
            page.dispatch_event("#level", "input")

            before = page.text_content("#out")
            page.click("#reroll")
            check(page.text_content("#out") != before, "relancer change le tirage", failures)

            page.click(".chip[data-part='above']")
            check(page.get_attribute(".chip[data-part='above']", "aria-pressed") == "false", "bascule d'une zone", failures)
            page.click(".chip[data-part='above']")

            page.click("#copy")
            clip = page.evaluate("navigator.clipboard.readText()")
            check(clip == page.text_content("#out") and clip != "", "copier met le résultat dans le presse-papiers", failures)
            check(page.text_content("#live") == "Copié dans le presse-papiers.", "annonce de copie", failures)

            page.fill("#src", "")
            page.keyboard.press("Control+Enter")
            check("Écris d'abord" in page.text_content("#live"), "copie à vide refusée proprement", failures)

            page.fill("#src", "Ċorr̃p̃tioṅ l'arrêtera")
            page.click("#purify")
            check(page.input_value("#src") == "Corrption l'arrêtera", "purifier retire le zalgo et garde les accents", failures)

            t1 = page.text_content("#title")
            time.sleep(0.6)
            check(page.text_content("#title") != t1, "le titre se recorrompt", failures)

            check(page.text_content("label[for=src]") == "ton texte" and page.get_attribute("html", "lang") == "fr",
                  "navigateur français : interface en français", failures)

            # Langue suivant le navigateur, l'URL et le sélecteur
            def ui(locale: str, query: str = "") -> tuple:
                c = browser.new_context(locale=locale)
                p = c.new_page()
                p.on("pageerror", lambda e: errors.append(str(e)))
                p.goto(f"http://127.0.0.1:18090/{query}", wait_until="load")
                return c, p

            for locale, label in (("en-US", "your text"), ("de-DE", "dein Text"), ("pt-BR", "seu texto"), ("ja-JP", "your text")):
                c, p = ui(locale)
                check(p.text_content("label[for=src]") == label, f"navigateur {locale} : « {label} »", failures)
                c.close()

            c, p = ui("fr-FR", "?lang=es")
            check(p.text_content("label[for=src]") == "tu texto" and p.text_content("#copy-label") == "copiar",
                  "?lang=es l'emporte sur le navigateur", failures)
            c.close()

            c, p = ui("fr-FR")
            p.select_option("#lang", "it")
            check(p.text_content("label[for=src]") == "il tuo testo", "le sélecteur change la langue", failures)
            p.fill("#src", "ciao")
            check(p.text_content("#count").endswith("caratteri"), "compteur traduit", failures)
            p.reload(wait_until="load")
            check(p.text_content("label[for=src]") == "il tuo testo", "le choix de langue est mémorisé", failures)
            c.close()

            check(not errors, f"aucune erreur console ({errors[:3]})", failures)
            browser.close()
    finally:
        bench.subprocess.run(["podman", "rm", "-f", name], capture_output=True)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
