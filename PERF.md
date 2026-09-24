# Performance de zalgo.gheop.com

Page statique d'environ 68 Ko, sans backend. La cible retenue : le **coût au repos** (CPU consommé par Chrome quand la page reste ouverte avec un texte saisi), avec deux garde-fous, le **chargement** (octets, temps de chargement) et la **latence de frappe** (touche → frame suivante, 60 frappes à 100 % de corruption). Le détail de chaque essai est dans `bench/JOURNAL.md`.

## Bilan

Mesure finale : version en production (v1.0.1) contre l'état final (v1.1.0), A/B alterné, 10 passes chacune, GPU matériel, médianes. La machine était chargée pendant ce run (cv 20 à 60 %), mais 8 passes finales sur 10 sont sous le minimum de la production, au repos comme en frappe.

| Métrique | Production | Final | Δ |
|---|---|---|---|
| CPU total au repos (% d'un cœur) | 39,2 % | 14,7 % | **−62 %** |
| · renderer | 17,5 % | 5,3 % | −70 % |
| · processus GPU | 20,1 % | 8,1 % | −60 % |
| Latence de frappe, médiane | 166 ms | 113 ms | −32 % |
| Octets transférés | 67 236 | 68 272 | +1,5 % |
| Temps de chargement | 504 ms | 506 ms | bruit |

L'état final affiche en plus la lueur et l'écho, jusque-là invisibles (voir plus bas) : il dessine davantage et coûte pourtant moins.

Le chargement ne bouge pas : +1 036 octets, dont 509 pour le découpage en module qui sert aux tests (mesuré neutre).

## Ce qui a payé

1. **Ambiances pilotées par l'horloge du titre** (itération 1b, −45 % en composition logicielle, −35 % sur GPU matériel). La lueur, le grain et la dérive de l'écho étaient 3 animations CSS infinies : Chrome recomposait toute la page 60 fois par seconde pour des écarts invisibles d'une image à l'autre. Ils suivent maintenant le tick du titre (~8/s), en écrivant `transform` et `opacity` directement sur des calques dédiés.
2. **Halo du titre peint une seule fois** (itération 4, −43 % sur GPU matériel). Le `text-shadow` flou de 38 px du titre était repeint à chaque tirage ; il vit maintenant sur un `::before` statique, sur son propre calque. Rendu identique à l'œil (écart moyen 1,2/255).

En cours de route, un bug est apparu : la lueur et l'écho étaient peints sous le fond de `body` et n'avaient jamais été visibles. Le correctif (validé à part, hors optimisation) rend la page plus chargée visuellement et coûte un peu à la frappe, puisque l'écho flou est maintenant réellement peint.

## Ce qui n'a pas payé

- **Variables CSS sur `body` pour piloter les ambiances** (itération 1) : le GPU baissait de 88 %, mais le renderer montait de 565 %. Une variable héritée invalide le style et la peinture de toute la page à chaque tick. Écrire `transform`/`opacity` sur l'élément lui-même règle le problème.
- **Flou de l'écho par `text-shadow`** au lieu de `filter: blur` (itération 2) : −50 % de GPU au repos, mais la latence de frappe doublait (+97 %), car l'ombre floue d'un texte géant est repeinte sur le thread principal à chaque frappe.
- **Écho rendu à 1/4 puis agrandi ×4** (itération 3) : aucun effet. Chrome rastérise le calque agrandi à pleine résolution.
- **Les ablations en composition logicielle** ont désigné le flou de l'écho et le `backdrop-filter` comme coûteux. Sur GPU matériel, ils ne coûtent presque rien : le proxy logiciel (SwiftShader, défaut de Chrome headless) exagère le prix de chaque calque plein écran et saturait un cœur (136 ms par frame), ce qui écrêtait la métrique.

## Plafond atteint

Sur GPU matériel, une page figée coûte ~4 % de CPU (plancher de Chrome headless). L'état final est à ~6 points au-dessus. Ce reste vient du tick du titre : ~8 tirages par seconde, chacun recalcule le texte, sa mise en page, sa peinture et une frame. Pour aller plus loin, il faudrait ralentir la corruption du titre ou la suspendre quand la fenêtre n'a pas le focus, ce qui change le comportement visible et se discute. Le chargement est dominé par les 2 polices (56 Ko sur 68), déjà réduites aux glyphes utiles et jugées optimales par patu.

## Reproduire

```sh
# Instantané d'une version à comparer
mkdir -p bench/results/snap && git archive <commit> web | tar -x -C bench/results/snap

# A/B alterné, 10 passes, GPU matériel, cœurs dédiés
taskset -c 12-21 python3 bench/bench.py --a bench/results/snap/web --b web --runs 10 --out bench/results/ab.json
python3 bench/compare.py bench/results/ab.json

# Même chose en composition logicielle (comme les itérations 1 à 3)
taskset -c 12-21 python3 bench/bench.py --a web --render software --runs 10
```

Le banc sert chaque version avec la vraie image `nginx-unprivileged` et `web/nginx.conf` (podman), et remplace `Math.random` par un générateur à graine fixe pour que le zalgo produit soit identique d'une passe à l'autre. Ne comparer que des versions mesurées dans la même session, en alternance : sur GPU matériel, les valeurs absolues varient beaucoup avec la charge de la machine.

## Surveiller

- En CI, seulement les tests (`npm test`, `tests/e2e.py`) : un runner partagé est trop bruité pour un seuil de performance fiable.
- Avant de toucher aux animations, aux filtres ou au titre, lancer un A/B `--render gpu` contre le commit précédent. Seuil d'alerte : +20 % de CPU au repos en médiane, au-delà du bruit observé (cv ~20 % sur GPU matériel).
- Règle à garder : aucune animation CSS infinie, et aucun `filter`/`text-shadow` flou sur un élément qui change à chaque tick.
