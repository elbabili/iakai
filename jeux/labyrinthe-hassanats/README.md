# Le Labyrinthe des Hassanats

Jeu web inspiré d'un dessin de Maryam, en mode **Pac-Man** : traverse un labyrinthe sur grille en collectant les hassanats (bonnes actions), évite les démons, et utilise les anges pour les purifier. Selon ta performance, tu finis au Paradis ou en Enfer.

## Lancer le jeu

Ouvre [index.html](index.html) dans un navigateur moderne. Aucune installation, aucun build, aucune dépendance.

## 4 phases du jeu

1. **Choix du personnage** — joueuse ou joueur (le choix est conservé entre les parties)
2. **Tutoriel** — 1 écran avec 5 règles illustrées
3. **Labyrinthe** — collecte au moins 80 % des hassanats pour ouvrir le portail
4. **Fin** — Paradis (Jannah) si ≥ 85 % collecté, sinon Enfer (Jahannam) avec porte du repentir ouverte

## Contrôles

- **Flèches** ou **ZQSD** — change de direction (déplacement continu, style Pac-Man)
- Le buffering est activé : si tu presses une direction bloquée, elle s'applique dès qu'elle devient possible

## Mécaniques

- **Hassanats** (points dorés) : ramassage = +7 à +70 (valeur aléatoire affichée en pop-up doré, référence au hadith)
- **Anges** (×3, gros sprites dorés pulsants avec halo et rayons) : 6 secondes de **Protection totale** :
  - halo doré pulsant autour du personnage
  - les démons se transforment en êtres dorés (filter `feColorMatrix`), tremblent, ralentissent de 30 % et **fuient** le joueur
  - au contact d'un démon purifié → **explosion de 12 particules dorées**, +50 hassanats, le démon réapparaît au centre 5 s plus tard
  - transition douce en fin de protection (halo qui s'estompe + petit puff doré sur chaque démon)
- **Démons** (×3) : déplacement aléatoire, avec 40 % de préférence pour la direction qui rapproche du joueur. Au contact hors protection → −20 hassanats et recul d'une cellule. **Pas de vies, pas de game over instantané.**
- **Portail** : verrouillé (gris pointillé) tant que < 80 % collecté ; doré et animé une fois ouvert
- **Meilleur score** mémorisé via `localStorage`

## Réglage de la difficulté

Tout est centralisé dans l'objet `CONFIG` en tête de [game.js](game.js) :

- `cellSize`, `msPerCell`, `demonMsPerCellNormal`, `demonMsPerCellSlow` — taille et vitesses
- `protectionMs`, `demonRespawnMs`, `hassanatPenalty` — règles de jeu
- `unlockRatio` (0.80) et `paradiseRatio` (0.85) — seuils d'ouverture du portail et de victoire
- `numDemons` (3), `dissipateBonus` (50) — nombre d'ennemis et bonus de purification
- `angelSize` — taille des anges (1.5 × cellSize par défaut, pour qu'ils soient impossibles à manquer)

Le **tracé du labyrinthe** est dans `MAZE_LAYOUT` ([game.js](game.js)) — un tableau de chaînes de 17 caractères :
- `#` mur
- `.` couloir + hassanat
- `*` ange
- `S` spawn démon
- `E` portail de sortie
- ` ` couloir vide

Modifier ce tableau redessine entièrement le labyrinthe — aucun code à toucher.

## Fichiers

- [index.html](index.html) — structure + 4 sprites SVG en `<symbol>` partagés + filter de purification + gradients
- [style.css](style.css) — apparence complète (cahier d'écolier, animations CSS pour anges/halos/particules/flammes)
- [game.js](game.js) — logique (4 phases, IA des démons en mode chase et flee, particules)
- [sprites-preview.html](sprites-preview.html) — galerie des 4 sprites validés (référence, non utilisée par le jeu)
- `maryam.jpeg` — le dessin original

Stack : HTML5 + CSS3 + JS vanilla. SVG inline, Web Audio API pour les bips. Polices Caveat + Patrick Hand via Google Fonts (fallback `Comic Sans MS` / `Patrick Hand` si hors ligne).
