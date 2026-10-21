'use strict';

/* ==========================================================================
   LE LABYRINTHE DES HASSANATS — version Pac-Man (4 phases)
   HTML/CSS/JS vanilla, zéro dépendance.

   Phases :
     select   -> choix du personnage (joueuse / joueur)
     intro    -> tutoriel (1 écran, 5 règles avec sprites)
     maze     -> labyrinthe Pac-Man (collecter ≥ 80 % pour ouvrir le portail)
     paradise -> Jannah si ≥ 85 % collecté à la sortie
     hell     -> Jahannam si < 85 % à la sortie (ton doux, rejouable)

   Le tracé du labyrinthe est dans MAZE_LAYOUT (un tableau de chaînes).
   Toutes les valeurs ajustables sont dans CONFIG.
   ========================================================================== */


/* ==========================================================================
   Détection tactile (active swipe + D-pad + tutoriel mobile)
   ========================================================================== */
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (IS_TOUCH) document.documentElement.classList.add('is-touch');


/* ==========================================================================
   CONFIG
   ========================================================================== */
const CONFIG = {
  cellSize: 36,
  spriteSize: 30,
  angelSize: 54,                // 1.5 × la cellule — anges très visibles
  hassanatRadius: 4,
  msPerCell: 150,               // vitesse joueur
  demonMsPerCellNormal: 180,    // démons normaux
  demonMsPerCellSlow: 260,      // démons effrayés (≈ 30 % plus lent)
  protectionMs: 6000,
  protectionFadeMs: 500,        // fondu à la fin de la protection
  demonRespawnMs: 5000,
  hassanatPenalty: 20,
  hitCooldownMs: 700,
  unlockRatio: 0.80,            // seuil d'ouverture du portail
  paradiseRatio: 0.85,          // seuil pour le Paradis
  numDemons: 3,
  particleCount: 12,
  dissipateBonus: 50,
};

/* ----------------------------------------------------------------
   Tracé du labyrinthe.
     # = mur               . = couloir + hassanat
     * = ange (power-up)   S = spawn démon (couloir vide)
     E = portail sortie    ' ' = couloir vide
   17 colonnes × 15 lignes, symétrique gauche/droite.
   3 anges placés dans des zones stratégiques (proches du spawn démon).
   ---------------------------------------------------------------- */
const MAZE_LAYOUT = [
  '#################',
  '#...............#',
  '#.###.#####.###.#',
  '#.......*.......#',
  '#.#.###.#.###.#.#',
  '#.#.....#.....#.#',
  '#.#.###.#.###.#.#',
  '#*....#.S.#....*#',
  '#.#.###.#.###.#.#',
  '#.#.....#.....#.#',
  '#.#.###.#.###.#.#',
  '#...............#',
  '#.###.#####.###.#',
  '#...............#',
  '########E########',
];

const MAZE_COLS = MAZE_LAYOUT[0].length;
const MAZE_ROWS = MAZE_LAYOUT.length;
const PLAYER_START = { x: 8, y: 1 };

const DIRS = [
  { x:  1, y:  0, name: 'right' },
  { x: -1, y:  0, name: 'left'  },
  { x:  0, y: -1, name: 'up'    },
  { x:  0, y:  1, name: 'down'  },
];

const SVG_NS = 'http://www.w3.org/2000/svg';


/* ==========================================================================
   ÉTAT global
   ========================================================================== */
const state = {
  phase: 'select',
  character: 'player-girl',
  bestScore: parseInt(localStorage.getItem('hassanats-best') || '0', 10) || 0,
  maze: null,
};


/* ==========================================================================
   Utilitaires
   ========================================================================== */
const rand     = (a, b) => Math.random() * (b - a) + a;
const randInt  = (a, b) => Math.floor(rand(a, b + 1));
const clamp    = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp     = (a, b, t) => a + (b - a) * t;


/* ==========================================================================
   Audio (Web Audio API, bips synthétiques uniquement)
   ========================================================================== */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function bip(freq, duration = 0.1, type = 'sine', volume = 0.07) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
const sfx = {
  pickup()    { bip(900, 0.06, 'triangle', 0.05); },
  bigPickup() { bip(900, 0.07, 'triangle', 0.07); setTimeout(() => bip(1300, 0.09, 'triangle', 0.06), 60); },
  angel()     { [700, 1000, 1300, 1700, 2000].forEach((f, i) => setTimeout(() => bip(f, 0.13, 'sine', 0.08), i * 70)); },
  dissipate() { [400, 800, 1200, 1600].forEach((f, i) => setTimeout(() => bip(f, 0.1, 'triangle', 0.08), i * 50)); },
  hit()       { bip(180, 0.12, 'square', 0.1); bip(140, 0.18, 'sawtooth', 0.06); },
  unlock()    { [600, 800, 1000, 1300, 1600].forEach((f, i) => setTimeout(() => bip(f, 0.15, 'sine', 0.08), i * 80)); },
  victory()   { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => bip(f, 0.22, 'triangle', 0.09), i * 130)); },
  defeat()    { [420, 310, 210].forEach((f, i) => setTimeout(() => bip(f, 0.3, 'sawtooth', 0.09), i * 180)); },
};


/* ==========================================================================
   PHASE 1 : Choix du personnage
   ========================================================================== */
function showSelect() {
  state.phase = 'select';
  state.maze = null;

  document.getElementById('game').innerHTML = `
    <div class="screen select-screen">
      <h1 class="hand-title"><span class="underline">Choisis ton personnage</span></h1>
      <p class="subtitle">Le héros qui va traverser le labyrinthe</p>
      <div class="character-grid">
        <button class="character-card" data-char="player-girl" aria-label="Choisir la joueuse">
          <svg class="character-preview" viewBox="0 0 100 100"><use href="#player-girl"/></svg>
          <div class="char-name">Joueuse</div>
        </button>
        <button class="character-card" data-char="player-boy" aria-label="Choisir le joueur">
          <svg class="character-preview" viewBox="0 0 100 100"><use href="#player-boy"/></svg>
          <div class="char-name">Joueur</div>
        </button>
      </div>
      ${state.bestScore > 0 ? `<p class="footer-note">Meilleur score : ${state.bestScore} hassanats</p>` : ''}
    </div>
  `;
  document.querySelectorAll('.character-card').forEach(card => {
    card.addEventListener('click', () => {
      ensureAudio();
      state.character = card.dataset.char;
      bip(1000, 0.1, 'triangle', 0.07);
      showIntro();
    });
  });
}


/* ==========================================================================
   PHASE 2 : Tutoriel — 5 règles avec mini-illustrations
   ========================================================================== */
function showIntro() {
  state.phase = 'intro';

  const dotIcon = `
    <svg viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="6" fill="#e8b837" stroke="#b38820" stroke-width="1.2"/>
      <circle cx="11" cy="11" r="2" fill="#fdfdf8" opacity="0.9"/>
      <circle cx="27" cy="13" r="1.5" fill="#fdfdf8" opacity="0.7"/>
      <circle cx="9"  cy="27" r="1.2" fill="#fdfdf8" opacity="0.7"/>
    </svg>
  `;

  const directionRule = IS_TOUCH
    ? `<li>
            <span class="rule-icon"><svg viewBox="0 0 100 100"><use href="#${state.character}"/></svg></span>
            <span>Glisse ton doigt pour changer de direction (ou utilise les flèches en bas)</span>
          </li>`
    : `<li>
            <span class="rule-icon"><svg viewBox="0 0 100 100"><use href="#${state.character}"/></svg></span>
            <span class="rule-keys">
              <span class="key">←</span><span class="key">↑</span><span class="key">↓</span><span class="key">→</span>
              <span style="margin:0 0.3rem">ou</span>
              <span class="key">Z</span><span class="key">Q</span><span class="key">S</span><span class="key">D</span>
            </span>
            <span style="margin-left:0.5rem">— change de direction</span>
          </li>`;

  document.getElementById('game').innerHTML = `
    <div class="screen intro-screen">
      <h1 class="hand-title">Comment jouer</h1>
      <div class="intro-card">
        <ul class="rules">
          ${directionRule}
          <li>
            <span class="rule-icon">${dotIcon}</span>
            <span>Points dorés = <em>hassanats</em> à collecter</span>
          </li>
          <li>
            <span class="rule-icon"><svg viewBox="0 0 100 100"><use href="#sin-demon"/></svg></span>
            <span>Démons rouges = <em>péchés</em> (tu perds des hassanats au contact)</span>
          </li>
          <li>
            <span class="rule-icon"><svg viewBox="0 0 100 100"><use href="#good-light"/></svg></span>
            <span><em>Anges</em> = 6 secondes de super-pouvoir : touche les démons pour les purifier&nbsp;!</span>
          </li>
          <li>
            <span class="rule-icon"><svg viewBox="0 0 32 32"><use href="#door-icon"/></svg></span>
            <span>Collecte <em>80 %</em> des hassanats pour ouvrir la sortie</span>
          </li>
        </ul>
        <div style="text-align:center">
          <button class="big-btn" id="start-btn">Commencer</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('start-btn').addEventListener('click', () => {
    ensureAudio();
    startMaze();
  });
}


/* ==========================================================================
   PHASE 3 : Labyrinthe Pac-Man
   ========================================================================== */
function startMaze() {
  state.phase = 'maze';

  // Parser le layout en grille + repérer les positions remarquables
  const grid = [];
  let totalHassanats = 0;
  let demonSpawn = { x: 8, y: 7 };
  let exitCell = { x: 8, y: 14 };

  for (let y = 0; y < MAZE_ROWS; y++) {
    const row = [];
    for (let x = 0; x < MAZE_COLS; x++) {
      const c = MAZE_LAYOUT[y][x];
      const cell = { wall: false, hassanat: false, angel: false, exit: false };
      switch (c) {
        case '#': cell.wall = true; break;
        case '.': cell.hassanat = true; totalHassanats++; break;
        case '*': cell.angel = true; break;
        case 'S': demonSpawn = { x, y }; break;
        case 'E': cell.exit = true; exitCell = { x, y }; break;
      }
      row.push(cell);
    }
    grid.push(row);
  }

  const now = performance.now();

  // Démons positionnés autour du spawn
  const offsets = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }];
  const demons = [];
  for (let i = 0; i < CONFIG.numDemons; i++) {
    const o = offsets[i % offsets.length];
    let cx = demonSpawn.x + o.x, cy = demonSpawn.y + o.y;
    if (grid[cy][cx].wall) { cx = demonSpawn.x; cy = demonSpawn.y; }
    demons.push({
      cell: { x: cx, y: cy },
      prevCell: { x: cx, y: cy },
      moveStartTime: now,
      moveDuration: CONFIG.demonMsPerCellNormal,
      dir: { x: 0, y: 0 },
      facing: 'right',
      state: 'active',
      respawnAt: 0,
    });
  }

  state.maze = {
    grid,
    totalHassanats,
    demonSpawn,
    exitCell,
    player: {
      cell: { ...PLAYER_START },
      prevCell: { ...PLAYER_START },
      moveStartTime: now,
      moveDuration: CONFIG.msPerCell,
      dir: { x: 0, y: 0 },
      nextDir: null,
      facing: 'right',
    },
    demons,
    scoreHassanat: 0,
    collected: 0,
    protectionEnd: 0,
    protectionStart: 0,
    wasProtected: false,
    exitUnlocked: false,
    exited: false,
    keys: {},
    toasts: [],
    lastHitTime: -9999,
  };

  renderMazeScreen();
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup',   onKeyUp);
  if (IS_TOUCH) {
    setupTouchControls();
    mountDPad();
  }
  requestAnimationFrame(mazeLoop);
}

function teardownMaze() {
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup',   onKeyUp);
  teardownTouchControls();
  unmountDPad();
}


/* ----------------------------------------------------------------
   Entrées clavier
   ---------------------------------------------------------------- */
function onKeyDown(e) {
  if (state.phase !== 'maze' || !state.maze) return;
  const k = e.key.toLowerCase();
  let d = null;
  if      (k === 'arrowleft'  || k === 'q' || k === 'a') d = { x: -1, y:  0 };
  else if (k === 'arrowright' || k === 'd')              d = { x:  1, y:  0 };
  else if (k === 'arrowup'    || k === 'z' || k === 'w') d = { x:  0, y: -1 };
  else if (k === 'arrowdown'  || k === 's')              d = { x:  0, y:  1 };
  if (!d) return;
  e.preventDefault();
  state.maze.keys[k] = true;
  setPlayerInputDir(d);
}
function onKeyUp(e) {
  if (!state.maze) return;
  state.maze.keys[e.key.toLowerCase()] = false;
}

function setPlayerInputDir(d) {
  const p = state.maze.player;
  // Reverse immédiat : on inverse cell ↔ prevCell et on inverse le temps écoulé
  if (p.dir.x === -d.x && p.dir.y === -d.y && (p.dir.x !== 0 || p.dir.y !== 0)) {
    const now = performance.now();
    const dur = p.moveDuration || CONFIG.msPerCell;
    const elapsed = clamp(now - p.moveStartTime, 0, dur);
    const remaining = dur - elapsed;
    const tmp = p.prevCell;
    p.prevCell = p.cell;
    p.cell = tmp;
    p.dir = d;
    p.nextDir = null;
    p.moveStartTime = now - remaining;
    updateFacing(p, d);
    return;
  }
  p.nextDir = d;
}

function updateFacing(char, d) {
  if (d.x > 0) char.facing = 'right';
  else if (d.x < 0) char.facing = 'left';
}


/* ----------------------------------------------------------------
   Boucle de jeu
   ---------------------------------------------------------------- */
function mazeLoop(now) {
  if (state.phase !== 'maze') return;
  const m = state.maze;

  const isProtected = m.protectionEnd > now;

  // Détection du basculement de protection (effet de fin)
  if (m.wasProtected && !isProtected) {
    onProtectionEnd(now);
  }
  m.wasProtected = isProtected;

  // Mouvement joueur
  m.player.moveDuration = CONFIG.msPerCell;
  stepCharacterIfDue(m.player, now, CONFIG.msPerCell, null);

  // Mouvement des démons (vitesse + IA dépendent de la protection)
  const demonMs = isProtected ? CONFIG.demonMsPerCellSlow : CONFIG.demonMsPerCellNormal;
  for (const demon of m.demons) {
    handleDemonRespawn(demon, now);
    if (demon.state === 'active') {
      stepCharacterIfDue(demon, now, demonMs, isProtected ? pickDemonFlee : pickDemonChase);
    }
  }

  checkPickups(now);
  checkDemonCollisions(now);
  checkExit(now);

  renderCharacters(now, isProtected);
  renderToasts(now);
  updateProtectionHud(now);

  requestAnimationFrame(mazeLoop);
}


/* ----------------------------------------------------------------
   Système de mouvement (cellule → cellule, interpolé)
   ---------------------------------------------------------------- */
function stepCharacterIfDue(char, now, msPerCell, pickFn) {
  const stationary = (char.dir.x === 0 && char.dir.y === 0);
  const dur = char.moveDuration || msPerCell;
  const elapsed = now - char.moveStartTime;

  if (stationary) {
    const desired = pickFn ? pickFn(char) : (char.nextDir || { x: 0, y: 0 });
    if ((desired.x !== 0 || desired.y !== 0) && canMove(char.cell, desired)) {
      startMove(char, desired, msPerCell, now);
      if (!pickFn) char.nextDir = null;
    }
    return;
  }

  if (elapsed < dur) return;

  const desired = pickFn ? pickFn(char) : (char.nextDir || char.dir);

  if ((desired.x !== 0 || desired.y !== 0) && canMove(char.cell, desired)) {
    startMove(char, desired, msPerCell, now);
    if (!pickFn) char.nextDir = null;
  } else if ((char.dir.x !== 0 || char.dir.y !== 0) && canMove(char.cell, char.dir)) {
    startMove(char, char.dir, msPerCell, now);
  } else {
    char.dir = { x: 0, y: 0 };
    char.prevCell = { ...char.cell };
    char.moveStartTime = now;
  }
}

function startMove(char, dir, msPerCell, now) {
  char.dir = dir;
  char.prevCell = { ...char.cell };
  char.cell = { x: char.cell.x + dir.x, y: char.cell.y + dir.y };
  char.moveStartTime = now;
  char.moveDuration = msPerCell;
  updateFacing(char, dir);
}

function canMove(cell, d) {
  const nx = cell.x + d.x;
  const ny = cell.y + d.y;
  if (ny < 0 || ny >= MAZE_ROWS || nx < 0 || nx >= MAZE_COLS) return false;
  return !state.maze.grid[ny][nx].wall;
}

function getPixelPos(char, now) {
  const cs = CONFIG.cellSize;
  const dur = char.moveDuration || CONFIG.msPerCell;
  const elapsed = clamp(now - char.moveStartTime, 0, dur);
  const t = elapsed / dur;
  const x = lerp(char.prevCell.x, char.cell.x, t) * cs + cs / 2;
  const y = lerp(char.prevCell.y, char.cell.y, t) * cs + cs / 2;
  return { x, y };
}


/* ----------------------------------------------------------------
   IA des démons : chase léger en mode normal, flee sous protection
   ---------------------------------------------------------------- */
function pickDemonChase(demon) {
  const validDirs = validDemonDirs(demon);
  if (validDirs.length === 0) return reverseOrStop(demon);
  if (validDirs.length === 1) return validDirs[0];

  if (Math.random() < 0.4) {
    return closestDirTo(demon, validDirs, state.maze.player.cell);
  }
  return validDirs[randInt(0, validDirs.length - 1)];
}

function pickDemonFlee(demon) {
  const validDirs = validDemonDirs(demon);
  if (validDirs.length === 0) return reverseOrStop(demon);
  if (validDirs.length === 1) return validDirs[0];
  return farthestDirFrom(demon, validDirs, state.maze.player.cell);
}

function validDemonDirs(demon) {
  const isReverse = d => (demon.dir.x !== 0 || demon.dir.y !== 0)
                      && d.x === -demon.dir.x && d.y === -demon.dir.y;
  return DIRS.filter(d => canMove(demon.cell, d) && !isReverse(d));
}
function reverseOrStop(demon) {
  if (demon.dir.x !== 0 || demon.dir.y !== 0) return { x: -demon.dir.x, y: -demon.dir.y };
  return { x: 0, y: 0 };
}
function closestDirTo(demon, dirs, target) {
  let best = dirs[0], bestDist = Infinity;
  for (const d of dirs) {
    const tx = demon.cell.x + d.x, ty = demon.cell.y + d.y;
    const dist = Math.abs(tx - target.x) + Math.abs(ty - target.y);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}
function farthestDirFrom(demon, dirs, target) {
  let best = dirs[0], bestDist = -Infinity;
  for (const d of dirs) {
    const tx = demon.cell.x + d.x, ty = demon.cell.y + d.y;
    const dist = Math.abs(tx - target.x) + Math.abs(ty - target.y);
    if (dist > bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

function handleDemonRespawn(demon, now) {
  if (demon.state === 'dissipated' && now >= demon.respawnAt) {
    demon.state = 'active';
    demon.cell = { ...state.maze.demonSpawn };
    demon.prevCell = { ...state.maze.demonSpawn };
    demon.dir = { x: 0, y: 0 };
    demon.moveStartTime = now;
    demon.moveDuration = CONFIG.demonMsPerCellNormal;
    // Petit flash de réapparition
    spawnRespawnFlash(demon.cell.x, demon.cell.y);
  }
}


/* ----------------------------------------------------------------
   Ramassages : hassanats, anges, sortie
   ---------------------------------------------------------------- */
function checkPickups(now) {
  const m = state.maze;
  const { x: cx, y: cy } = m.player.cell;
  const c = m.grid[cy][cx];

  if (c.hassanat) {
    c.hassanat = false;
    const value = randInt(1, 10) * 7;  // 7..70 — référence au hadith
    m.scoreHassanat += value;
    m.collected += 1;
    sfx.bigPickup();
    spawnToast(cx, cy, `×${value}`, '#e8b837');
    removeItemEl(`hassanat-${cx}-${cy}`);
    if (!m.exitUnlocked && m.collected >= Math.ceil(m.totalHassanats * CONFIG.unlockRatio)) {
      m.exitUnlocked = true;
      sfx.unlock();
      spawnToast(m.exitCell.x, m.exitCell.y, 'PORTAIL OUVERT', '#e8b837');
    }
    updateHud();
  } else if (c.angel) {
    c.angel = false;
    activateProtection(now);
    spawnToast(cx, cy, 'PROTECTION !', '#e8b837');
    removeItemEl(`angel-${cx}-${cy}`);
    sfx.angel();
    spawnAngelBurst(cx, cy);
  }
}

function activateProtection(now) {
  const m = state.maze;
  m.protectionEnd = now + CONFIG.protectionMs;
  m.protectionStart = now;
}

function removeItemEl(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function checkDemonCollisions(now) {
  const m = state.maze;
  const isProtected = m.protectionEnd > now;
  const playerPos = getPixelPos(m.player, now);

  for (const demon of m.demons) {
    if (demon.state !== 'active') continue;
    const demonPos = getPixelPos(demon, now);
    const dist = Math.hypot(playerPos.x - demonPos.x, playerPos.y - demonPos.y);
    if (dist < CONFIG.cellSize * 0.65) {
      if (isProtected) {
        purifyDemon(demon, now);
      } else if (now - m.lastHitTime > CONFIG.hitCooldownMs) {
        handleDemonHit(now, demon);
      }
    }
  }
}

function purifyDemon(demon, now) {
  demon.state = 'dissipated';
  demon.respawnAt = now + CONFIG.demonRespawnMs;
  state.maze.scoreHassanat += CONFIG.dissipateBonus;
  spawnExplosion(demon.cell.x, demon.cell.y);
  sfx.dissipate();
  spawnToast(demon.cell.x, demon.cell.y, `+${CONFIG.dissipateBonus}`, '#e8b837');
  updateHud();
}

function handleDemonHit(now, demon) {
  const m = state.maze;
  m.lastHitTime = now;
  const before = m.scoreHassanat;
  m.scoreHassanat = Math.max(0, m.scoreHassanat - CONFIG.hassanatPenalty);
  const lost = before - m.scoreHassanat;
  // Recul du joueur d'une cellule
  const tmp = m.player.prevCell;
  m.player.prevCell = m.player.cell;
  m.player.cell = tmp;
  m.player.dir = { x: 0, y: 0 };
  m.player.nextDir = null;
  m.player.moveStartTime = now;
  spawnToast(m.player.prevCell.x, m.player.prevCell.y, `−${lost || CONFIG.hassanatPenalty}`, '#d63838');
  sfx.hit();
  if (navigator.vibrate) navigator.vibrate(50);
  updateHud();
}

function checkExit(now) {
  const m = state.maze;
  if (m.exited || !m.exitUnlocked) return;
  if (m.player.cell.x === m.exitCell.x && m.player.cell.y === m.exitCell.y) {
    m.exited = true;
    teardownMaze();
    setTimeout(() => endMaze(), 600);
  }
}

function endMaze() {
  const m = state.maze;
  const pct = m.collected / m.totalHassanats;
  // Mémoriser le meilleur score
  if (m.scoreHassanat > state.bestScore) {
    state.bestScore = m.scoreHassanat;
    try { localStorage.setItem('hassanats-best', String(m.scoreHassanat)); } catch (e) {}
  }
  if (pct >= CONFIG.paradiseRatio) showParadise();
  else showHell();
}


/* ----------------------------------------------------------------
   Toasts
   ---------------------------------------------------------------- */
function spawnToast(cellX, cellY, text, color) {
  const cs = CONFIG.cellSize;
  state.maze.toasts.push({
    x: cellX * cs + cs / 2,
    y: cellY * cs + cs / 2,
    text, color,
    t: performance.now(),
  });
}

function renderToasts(now) {
  const layer = document.getElementById('toast-layer');
  if (!layer) return;
  const life = 900;
  state.maze.toasts = state.maze.toasts.filter(t => now - t.t < life);
  layer.innerHTML = state.maze.toasts.map(t => {
    const p = (now - t.t) / life;
    const y = t.y - p * 28;
    return `<text x="${t.x.toFixed(1)}" y="${y.toFixed(1)}" class="toast-text" fill="${t.color}" opacity="${(1 - p).toFixed(2)}">${t.text}</text>`;
  }).join('');
}


/* ----------------------------------------------------------------
   Particules dorées (explosion + flash retour démon + fin de protection)
   ---------------------------------------------------------------- */
function spawnExplosion(cellX, cellY) {
  const cs = CONFIG.cellSize;
  const cx = cellX * cs + cs / 2;
  const cy = cellY * cs + cs / 2;
  const n = CONFIG.particleCount;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = 28 + Math.random() * 22;
    spawnParticle(cx, cy, Math.cos(a) * dist, Math.sin(a) * dist - 8, 4);
  }
}
function spawnAngelBurst(cellX, cellY) {
  const cs = CONFIG.cellSize;
  const cx = cellX * cs + cs / 2;
  const cy = cellY * cs + cs / 2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const dist = 36 + Math.random() * 18;
    spawnParticle(cx, cy, Math.cos(a) * dist, Math.sin(a) * dist - 6, 3.5);
  }
}
function spawnRespawnFlash(cellX, cellY) {
  const cs = CONFIG.cellSize;
  const cx = cellX * cs + cs / 2;
  const cy = cellY * cs + cs / 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spawnParticle(cx, cy, Math.cos(a) * 18, Math.sin(a) * 18, 2.5);
  }
}
function spawnParticle(cx, cy, dx, dy, r) {
  const layer = document.getElementById('particles-layer');
  if (!layer) return;
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', cx.toFixed(1));
  c.setAttribute('cy', cy.toFixed(1));
  c.setAttribute('r', r);
  c.setAttribute('class', 'particle');
  c.style.setProperty('--dx', dx.toFixed(1) + 'px');
  c.style.setProperty('--dy', dy.toFixed(1) + 'px');
  layer.appendChild(c);
  setTimeout(() => c.remove(), 800);
}

/* Fin de la protection : petit puff doré sur chaque démon actif */
function onProtectionEnd(now) {
  for (const demon of state.maze.demons) {
    if (demon.state !== 'active') continue;
    const dp = getPixelPos(demon, now);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      spawnParticle(dp.x, dp.y, Math.cos(a) * 16, Math.sin(a) * 16, 2.5);
    }
  }
}


/* ==========================================================================
   RENDU — labyrinthe
   ========================================================================== */
function renderMazeScreen() {
  const cs = CONFIG.cellSize;
  const w = MAZE_COLS * cs;
  const h = MAZE_ROWS * cs;
  const m = state.maze;

  // Murs (statiques)
  let wallsSvg = '';
  let dotsSvg = '';
  let angelsSvg = '';
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < MAZE_COLS; x++) {
      const cell = m.grid[y][x];
      if (cell.wall) {
        wallsSvg += `<rect x="${x * cs + 1}" y="${y * cs + 1}" width="${cs - 2}" height="${cs - 2}" rx="5" class="wall-cell"/>`;
      } else if (cell.hassanat) {
        dotsSvg += `<circle id="hassanat-${x}-${y}" cx="${x * cs + cs / 2}" cy="${y * cs + cs / 2}" r="${CONFIG.hassanatRadius}" class="hassanat-dot"/>`;
      } else if (cell.angel) {
        angelsSvg += renderAngel(x, y);
      }
    }
  }

  document.getElementById('game').innerHTML = `
    <div class="screen maze-screen">
      <div class="hud">
        <div class="hud-item hud-green">Hassanats : <span id="hud-hassanat">0</span></div>
        <div class="hud-item hud-progress" id="hud-progress">0 / ${m.totalHassanats}</div>
        <div class="hud-item hud-protect" id="hud-protect">
          Protection
          <div class="hud-protect-bar"><div class="hud-protect-bar-fill" id="hud-protect-fill"></div></div>
        </div>
        <button class="maze-back-btn" id="back-btn" title="Changer de personnage">↶ perso</button>
      </div>
      <svg class="maze-svg" viewBox="0 0 ${w} ${h}" xmlns="${SVG_NS}" aria-label="Labyrinthe">
        <rect x="0" y="0" width="${w}" height="${h}" class="maze-area-bg"/>
        <g filter="url(#hand-drawn)" id="walls-layer">${wallsSvg}</g>
        <g id="dots-layer">${dotsSvg}</g>
        <g id="angels-layer">${angelsSvg}</g>
        <g id="exit-layer"></g>
        <g id="characters-layer"></g>
        <g id="particles-layer"></g>
        <g id="toast-layer"></g>
      </svg>
    </div>
  `;
  document.getElementById('back-btn').addEventListener('click', () => {
    teardownMaze();
    showSelect();
  });

  renderExit();
  setupCharacterElements();
  updateHud();
}

function renderAngel(x, y) {
  const cs = CONFIG.cellSize;
  const cx = x * cs + cs / 2;
  const cy = y * cs + cs / 2;
  const sz = CONFIG.angelSize;
  const half = sz / 2;
  // 8 rayons de lumière
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = i * 45 * Math.PI / 180;
    const r1 = half * 0.95;
    const r2 = half * 1.35;
    const x1 = Math.cos(a) * r1;
    const y1 = Math.sin(a) * r1;
    const x2 = Math.cos(a) * r2;
    const y2 = Math.sin(a) * r2;
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="angel-ray"/>`;
  }
  return `
    <g id="angel-${x}-${y}" class="angel-spot" transform="translate(${cx}, ${cy})">
      <circle class="angel-glow" cx="0" cy="0" r="${(half * 1.3).toFixed(0)}"/>
      <g class="angel-rays">${rays}</g>
      <g class="angel-sprite">
        <use href="#good-light" x="${-half}" y="${-half}" width="${sz}" height="${sz}"/>
      </g>
    </g>
  `;
}

function renderExit() {
  const m = state.maze;
  const cs = CONFIG.cellSize;
  const ex = m.exitCell;
  const layer = document.getElementById('exit-layer');
  if (!layer) return;
  const cls = m.exitUnlocked ? 'exit-portal-open' : 'exit-portal-locked';
  const labelTxt = m.exitUnlocked ? 'sortie' : 'verrouillé';
  layer.innerHTML = `
    <rect x="${ex.x * cs + 3}" y="${ex.y * cs + 3}" width="${cs - 6}" height="${cs - 6}" rx="5" class="${cls}"/>
    <text x="${ex.x * cs + cs / 2}" y="${ex.y * cs + cs / 2 + 4}" text-anchor="middle" class="exit-label">${labelTxt}</text>
  `;
}


/* ----------------------------------------------------------------
   Persistance des éléments DOM des personnages (pour les transitions CSS)
   ---------------------------------------------------------------- */
function setupCharacterElements() {
  const layer = document.getElementById('characters-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const sz = CONFIG.spriteSize;
  const half = sz / 2;

  // Halo joueur (derrière le sprite)
  const haloG = document.createElementNS(SVG_NS, 'g');
  haloG.id = 'player-halo';
  haloG.classList.add('player-halo-container');
  const haloC = document.createElementNS(SVG_NS, 'circle');
  haloC.setAttribute('cx', '0');
  haloC.setAttribute('cy', '0');
  haloC.setAttribute('r', String(sz * 0.95));
  haloC.classList.add('player-halo-circle');
  haloG.appendChild(haloC);
  layer.appendChild(haloG);

  // Joueur
  const playerG = document.createElementNS(SVG_NS, 'g');
  playerG.id = 'player-el';
  playerG.classList.add('player-character');
  playerG.innerHTML = `<use href="#${state.character}" x="${-half}" y="${-half}" width="${sz}" height="${sz}"/>`;
  layer.appendChild(playerG);

  // Démons : double couche (normal + purifié) pour transition fluide
  for (let i = 0; i < state.maze.demons.length; i++) {
    const dG = document.createElementNS(SVG_NS, 'g');
    dG.id = `demon-${i}`;
    dG.classList.add('demon-character');
    dG.innerHTML = `
      <g class="demon-normal">
        <use href="#sin-demon" x="${-half}" y="${-half}" width="${sz}" height="${sz}"/>
      </g>
      <g class="demon-purified" filter="url(#purify-filter)">
        <use href="#sin-demon" x="${-half}" y="${-half}" width="${sz}" height="${sz}"/>
      </g>
    `;
    layer.appendChild(dG);
  }
}

function renderCharacters(now, isProtected) {
  const m = state.maze;

  // Joueur
  const pp = getPixelPos(m.player, now);
  const playerEl = document.getElementById('player-el');
  if (playerEl) {
    const flip = m.player.facing === 'left' ? -1 : 1;
    playerEl.setAttribute('transform', `translate(${pp.x.toFixed(1)}, ${pp.y.toFixed(1)}) scale(${flip}, 1)`);
  }

  // Halo joueur
  const halo = document.getElementById('player-halo');
  if (halo) {
    halo.setAttribute('transform', `translate(${pp.x.toFixed(1)}, ${pp.y.toFixed(1)})`);
    if (isProtected) {
      halo.classList.add('shown');
      // Démarre le fondu de fin dans les dernières 500 ms
      const remaining = m.protectionEnd - now;
      if (remaining < CONFIG.protectionFadeMs) halo.classList.add('fading');
      else halo.classList.remove('fading');
    } else {
      halo.classList.remove('shown', 'fading');
    }
  }

  // Démons
  for (let i = 0; i < m.demons.length; i++) {
    const demon = m.demons[i];
    const el = document.getElementById(`demon-${i}`);
    if (!el) continue;
    if (demon.state !== 'active') {
      el.style.display = 'none';
      continue;
    }
    el.style.display = '';
    const dp = getPixelPos(demon, now);
    const flip = demon.facing === 'left' ? -1 : 1;
    el.setAttribute('transform', `translate(${dp.x.toFixed(1)}, ${dp.y.toFixed(1)}) scale(${flip}, 1)`);
    if (isProtected) el.classList.add('purified');
    else             el.classList.remove('purified');
  }

  // Re-rendre la sortie si l'état change
  const portal = document.querySelector('.exit-portal-locked, .exit-portal-open');
  if (portal) {
    const expected = m.exitUnlocked ? 'exit-portal-open' : 'exit-portal-locked';
    if (!portal.classList.contains(expected)) renderExit();
  }
}

function updateHud() {
  const m = state.maze;
  if (!m) return;
  const h = document.getElementById('hud-hassanat');
  const pr = document.getElementById('hud-progress');
  if (h) h.textContent = m.scoreHassanat;
  if (pr) {
    const pct = Math.min(100, Math.round((m.collected / m.totalHassanats) * 100));
    pr.textContent = `${m.collected} / ${m.totalHassanats}  (${pct} %)`;
    pr.style.color = m.exitUnlocked ? 'var(--gold)' : 'var(--ink)';
  }
}

function updateProtectionHud(now) {
  const el = document.getElementById('hud-protect');
  const fill = document.getElementById('hud-protect-fill');
  if (!el) return;
  const m = state.maze;
  const remaining = m.protectionEnd - now;
  if (remaining > 0) {
    el.classList.add('shown');
    if (fill) fill.style.width = `${(remaining / CONFIG.protectionMs) * 100}%`;
  } else {
    el.classList.remove('shown');
  }
}


/* ==========================================================================
   PHASE 4 : Paradis / Enfer
   ========================================================================== */
function showParadise() {
  state.phase = 'paradise';
  sfx.victory();
  const m = state.maze;
  const pct = Math.round((m.collected / m.totalHassanats) * 100);

  document.getElementById('game').innerHTML = `
    <div class="screen paradise-screen">
      <div class="paradise-sky"></div>
      <svg class="paradise-scene" viewBox="0 0 900 700" xmlns="${SVG_NS}"
           aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <g filter="url(#hand-drawn)">
          <circle cx="760" cy="130" r="50" class="paradise-sun"/>
          ${sunRays(760, 130, 62)}
          <path d="M 280 180 Q 290 170 300 180 M 300 180 Q 310 170 320 180" class="paradise-bird" fill="none"/>
          <path d="M 480 145 Q 490 137 500 145 M 500 145 Q 510 137 520 145" class="paradise-bird" fill="none"/>
          <path d="M 0 500 Q 150 420 310 470 Q 460 510 610 440 Q 760 390 900 450 L 900 700 L 0 700 Z" class="paradise-hill1"/>
          <path d="M 0 590 Q 200 530 400 570 Q 600 615 900 555 L 900 700 L 0 700 Z" class="paradise-hill2"/>
          <path d="M 80 680 Q 230 620 380 650 Q 540 685 680 630 Q 810 600 900 640" class="paradise-river" fill="none"/>
          ${tree(170, 495)} ${tree(395, 475)} ${tree(630, 460)} ${tree(800, 510)}
        </g>
      </svg>
      <div class="end-card">
        <svg class="winner-sprite" viewBox="0 0 100 100"><use href="#${state.character}"/></svg>
        <h1 class="hand-title">Jannah</h1>
        <p class="poem">Tu as traversé,<br/>ton cœur est léger.<br/>Les rivières chantent pour toi.</p>
        <p class="end-stats">${m.scoreHassanat} hassanats — ${pct} % collecté<br/>Meilleur score : ${state.bestScore}</p>
        <div class="end-buttons">
          <button class="big-btn" id="restart-btn">Recommencer</button>
          <button class="big-btn btn-secondary" id="select-btn">Changer de perso</button>
        </div>
        <p class="iakai-support">Ce jeu t'a plu ? Il est gratuit et le restera.
          <a href="https://www.paypal.com/donate/?hosted_button_id=5Z2GCGQ97V3FN" target="_blank" rel="noopener noreferrer">Soutenir IAKAI</a></p>
      </div>
    </div>
  `;
  document.getElementById('restart-btn').addEventListener('click', startMaze);
  document.getElementById('select-btn').addEventListener('click', showSelect);
}

function showHell() {
  state.phase = 'hell';
  sfx.defeat();
  const m = state.maze;
  const pct = Math.round((m.collected / m.totalHassanats) * 100);

  const flames = [];
  for (let i = 0; i < 14; i++) {
    const w = 35 + Math.random() * 40;
    const h = 70 + Math.random() * 90;
    const left = Math.random() * 100;
    const delay = (Math.random() * 2).toFixed(2);
    flames.push(`<div class="flame" style="left:${left.toFixed(1)}%; width:${w.toFixed(0)}px; height:${h.toFixed(0)}px; animation-delay:${delay}s"></div>`);
  }

  document.getElementById('game').innerHTML = `
    <div class="screen hell-screen">
      <div class="hell-flames">${flames.join('')}</div>
      <div class="hell-card">
        <h1 class="hand-title">Tu es tombé...</h1>
        <p class="poem">Mais la porte du repentir<br/>reste toujours ouverte.<br/>Recommence.</p>
        <p class="end-stats">${m.scoreHassanat} hassanats — ${pct} % collecté</p>
        <div class="end-buttons">
          <button class="big-btn hell-btn" id="restart-btn">Recommencer</button>
          <button class="big-btn btn-secondary" id="select-btn">Changer de perso</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('restart-btn').addEventListener('click', startMaze);
  document.getElementById('select-btn').addEventListener('click', showSelect);
}

function tree(x, y) {
  return `
    <g transform="translate(${x}, ${y})">
      <line x1="0" y1="0" x2="0" y2="45" class="tree-trunk"/>
      <circle cx="0"   cy="-10" r="28" class="tree-crown"/>
      <circle cx="-18" cy="-5"  r="18" class="tree-crown"/>
      <circle cx="18"  cy="-5"  r="18" class="tree-crown"/>
    </g>
  `;
}
function sunRays(cx, cy, r) {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * Math.PI / 180;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    const x2 = cx + Math.cos(a) * (r + 22);
    const y2 = cy + Math.sin(a) * (r + 22);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="sun-ray"/>`;
  }
  return out;
}


/* ==========================================================================
   Contrôles tactiles : swipe sur la zone de jeu + D-pad virtuel
   Tous deux appellent setPlayerInputDir() — la même fonction que le clavier.
   ========================================================================== */
const SWIPE_MIN_PX = 30;
const SWIPE_MAX_MS = 600;
let touchStartX = 0, touchStartY = 0, touchStartT = 0;

function onTouchStart(e) {
  if (state.phase !== 'maze' || !e.touches || e.touches.length !== 1) return;
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartT = performance.now();
  e.preventDefault();
}
function onTouchEnd(e) {
  if (state.phase !== 'maze') return;
  const t = (e.changedTouches && e.changedTouches[0]);
  if (!t) return;
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const dt = performance.now() - touchStartT;
  if (dt > SWIPE_MAX_MS) return;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) < SWIPE_MIN_PX) return;
  const dir = (adx > ady)
    ? { x: dx > 0 ?  1 : -1, y: 0 }
    : { x: 0, y: dy > 0 ?  1 : -1 };
  setPlayerInputDir(dir);
}
function setupTouchControls() {
  const svg = document.querySelector('.maze-svg');
  if (!svg) return;
  svg.addEventListener('touchstart', onTouchStart, { passive: false });
  svg.addEventListener('touchend',   onTouchEnd,   { passive: false });
}
function teardownTouchControls() {
  const svg = document.querySelector('.maze-svg');
  if (!svg) return;
  svg.removeEventListener('touchstart', onTouchStart);
  svg.removeEventListener('touchend',   onTouchEnd);
}

const DPAD_PATHS = {
  up:    'M 24 36 L 24 14 M 14 22 L 24 12 L 34 22',
  down:  'M 24 12 L 24 34 M 14 26 L 24 36 L 34 26',
  left:  'M 36 24 L 14 24 M 22 14 L 12 24 L 22 34',
  right: 'M 12 24 L 34 24 M 26 14 L 36 24 L 26 34',
};
const DPAD_DIRS = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
};

function dpadArrowSvg(d) {
  return `<svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
    <g filter="url(#hand-drawn)" stroke="#1a4d8f" stroke-width="3.5" fill="none"
       stroke-linecap="round" stroke-linejoin="round">
      <path d="${DPAD_PATHS[d]}"/>
    </g>
  </svg>`;
}

function mountDPad() {
  if (document.getElementById('dpad')) return;
  const dpad = document.createElement('div');
  dpad.id = 'dpad';
  dpad.className = 'dpad';
  dpad.setAttribute('aria-label', 'Commandes du jeu');
  dpad.innerHTML = `
    <button class="dpad-btn dpad-up"    data-dir="up"    aria-label="Haut">${dpadArrowSvg('up')}</button>
    <button class="dpad-btn dpad-left"  data-dir="left"  aria-label="Gauche">${dpadArrowSvg('left')}</button>
    <button class="dpad-btn dpad-right" data-dir="right" aria-label="Droite">${dpadArrowSvg('right')}</button>
    <button class="dpad-btn dpad-down"  data-dir="down"  aria-label="Bas">${dpadArrowSvg('down')}</button>
  `;
  document.body.appendChild(dpad);
  dpad.querySelectorAll('.dpad-btn').forEach(btn => {
    const fire = (e) => {
      e.preventDefault();
      const d = DPAD_DIRS[btn.dataset.dir];
      if (d) setPlayerInputDir(d);
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown',  fire);
  });
}
function unmountDPad() {
  const el = document.getElementById('dpad');
  if (el) el.remove();
}


/* ==========================================================================
   Démarrage
   ========================================================================== */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showSelect);
} else {
  showSelect();
}
