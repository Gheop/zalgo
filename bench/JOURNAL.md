# Journal d'optimisation

Métrique principale : CPU total de Chrome au repos (tous processus, % d'un cœur, fenêtre de 10 s, page ouverte avec un texte saisi). Garde-fous : chargement (FCP, octets) et latence de frappe (touche → frame suivante, 60 frappes à 100 % de corruption). Chrome headless compose en logiciel : le coût « GPU » y est du CPU, sur une vraie machine il part sur le GPU et la batterie.

Mesures A/B alternées, 10 passes par version, médianes. Harnais : `bench/bench.py`, épinglé sur `taskset -c 12-21` à partir de l'itération 3 (test A/A épinglé : Δ 0,0 % au repos, cv 1-2 % en composition logicielle).

Les itérations 1 à 3 ont été mesurées en composition logicielle (SwiftShader, défaut de Chrome headless). À l'itération 3, une trace a montré que le processus GPU saturait un cœur (926 ms/s dans `DrawFrame`, 136 ms par frame) : la métrique était écrêtée et le proxy exagérait le coût des calques plein écran. À partir de l'itération 4, le banc compose sur le GPU matériel (`--render gpu`, Intel Arc), plus fidèle à un vrai visiteur mais plus bruité (cv ~20 %).

| # | Hypothèse | Fichiers | Résultat | Δ CPU repos | Δ garde-fous | Verdict |
|---|-----------|----------|----------|-------------|--------------|---------|
| 1 | Les 3 animations CSS infinies (breathe, grain, drift) forcent 60 recompositions/s ; les piloter depuis l'horloge du titre (~8/s) via des variables CSS sur `body` | style.css, app.js | GPU −88 % mais renderer +565 % : les variables héritées invalident style et peinture de toute la page à chaque tick, le grain et l'écho flou sont re-rastérisés | −24 % (cv 22 %) | frappe p95 +7 % | Reverti |
| 1b | Même idée, mais `transform`/`opacity` écrits directement sur des calques dédiés (`will-change`), lueur déplacée de `body::before` vers un `div` | index.html, style.css, app.js | GPU 93,6 → 47,9 %, renderer 11,8 → 9,5 % | **−45 %** (105,5 → 57,7 %) | frappe −4 % (bruit), +294 o, FCP +22 % mais cv 33 % : non concluant | Retenu |
| — | Bug trouvé en cours de route : `.glow` et `.echo` (z-index négatifs) étaient peints sous le fond de `body`, donc invisibles depuis la v1.0.0 | style.css | Correctif fonctionnel validé par l'utilisateur, hors optimisation. Nouvelle référence : ce correctif | — | la frappe passe de 56 à 165 ms (logiciel) car l'écho flou est maintenant peint | Correctif |
| 2 | Le `filter: blur(3px)` de l'écho est recalculé à chaque frame ; le remplacer par `color: transparent` + `text-shadow: 0 0 6px` (peint une fois dans le calque) | style.css | Rendu identique (écart moyen < 0,5/255), GPU −50 %, mais l'ombre floue se repeint sur le thread principal à chaque frappe | −43 % (cv 36 %, machine chargée) | frappe médiane **+97 %** | Reverti |
| 3 | Rendre l'écho à 1/4 de taille puis `scale(4)` : le flou porterait sur 16× moins de pixels | style.css, app.js | Chrome rastérise le calque agrandi à pleine résolution, aucun effet | −0,1 % (bruit) | — | Reverti |
| 1b' | Contrôle de l'itération 1b sur GPU matériel (v1.0.1 → itération 1b) | — | Le gain tient hors proxy logiciel | −35 % (28,5 → 18,4 %) | frappe −50 % (bruit fort) | Confirmé |
| 4 | Sur GPU matériel, le décor ne coûte presque rien ; le halo `text-shadow` 38 px du titre est repeint à chaque tick (−44 % en ablation). Le déplacer sur un `::before` statique sur son propre calque | style.css | Rendu identique (écart moyen 1,2/255) ; renderer 9,3 → 3,4 % | **−43 %** (17,8 → 10,2 %) | frappe −8 % (bruit), +147 o | Retenu |
| — | Découpage de la logique pure dans `web/zalgo.js` (module ES) pour les tests unitaires | index.html, app.js, zalgo.js | Pas une optimisation : contrôle de non-régression | −2,6 % (bruit) | +509 o, chargement et frappe dans le bruit | Neutre |
| Final | Production v1.0.1 contre état final v1.1.0, GPU matériel | — | 8 passes finales sur 10 sous le minimum de la production | **−62 %** (39,2 → 14,7 %) | frappe −32 %, +1 036 o | — |

## Passe 2 (v1.2.0)

Baseline `bench/baseline.json` : A/A sur la v1.2.0, GPU matériel, épinglé. CPU au repos 7,0 % (cv 3 à 5 %, Δ A/A 1,4 %), panneau visible à 128 ms (`ready_ms`, ajouté au banc), frappe 30 ms en médiane (Δ A/A jusqu'à 13 %). Toutes les pistes ont été mesurées par ablation avant d'écrire du code : aucune n'a franchi le seuil, rien n'a été commité côté page.

| # | Hypothèse | Fichiers | Résultat | Δ métrique | Δ garde-fous | Verdict |
|---|-----------|----------|----------|-----------|--------------|---------|
| 5 | Le chargement perd du temps dans une mise en page forcée par `autogrow()` (62 ms sur 71 ms d'exécution des modules) | — | Trace : une seule mise en page complète, sans doublon ; elle est avancée, pas dupliquée | — | — | Abandonné |
| 6 | Les polices web retardent le premier affichage | — | Ablation à chaud : sans Cormorant −4 %, sans Noto −2 %, les deux −4 % : bruit. Le −35 % du premier essai venait d'un remplacement de la police monospace | — | — | Abandonné |
| 7 | La pile `--mono` déclenche des recherches de polices absentes | — | Faux : JetBrains Mono est installée sur la machine de mesure. `monospace` à la place : −23 à −25 % ; ligatures ou `calt` coupés : −2 %. Le coût est le chargement de la police elle-même ; la seule parade change le rendu pour les visiteurs qui l'ont | ready −25 % (machine avec JetBrains Mono) | changement visuel | Non retenu |
| 8 | Repos : un calque coûte plus que les autres | — | Plancher 1,0 %, page 7,2 % ; ambiances seules 5,4 %, sans titre ni ambiances 1,6 %. Retirer un calque : au plus −0,6 point. Coût fixe par frame × ~8 ticks/s | — | — | Plateau |
| 9 | Frappe : l'écho (Cormorant + marques en Noto) fragmente la mise en forme du texte | — | Écho retiré : −9 % du thread principal (0,8 ms/frappe) ; écho en Noto : +16 % | — | — | Abandonné |
| 10 | `autogrow()` double la mise en page du champ à chaque frappe | — | −5 % du thread principal, alors que la référence varie de 8,7 à 9,9 ms entre runs | bruit | — | Abandonné |
