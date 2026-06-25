/*
  Velvet Hollow: fast 2D exploration platformer prototype.

  Expansion notes:
  - Add terrain to WORLD.solids, WORLD.slopes, WORLD.hazards, or WORLD.doors.
  - Add enemies with makeEnemy() and collectible shards with makeShard().
  - Replace placeholder art by swapping drawPlayer(), drawEnemy(), drawBoss(),
    drawBackground(), and tile drawing helpers with sprite-sheet draws.
  - Keep sprite frames small and high-contrast for the pixel/RPG silhouette style.
*/

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const pressed = new Set();

const palette = {
  void: "#07070d",
  deep: "#11111d",
  plum: "#222032",
  moss: "#22392e",
  vine: "#4c755b",
  teal: "#6ee7d8",
  mist: "#c8f6ff",
  gold: "#ffd06a",
  rose: "#ff6f9f",
  danger: "#e94358",
  ghost: "#a69cff"
};

const sprites = {
  title: new Image(),
  idle: new Image(),
  dash: new Image(),
  jump: new Image(),
  walk: new Image(),
  hurt: new Image(),
  bossIdle: new Image(),
  bossHurt: new Image(),
  bossFireballPose: new Image(),
  bossFireball: new Image(),
  bossShockwavePose: new Image(),
  bossShockwaveLower: new Image(),
  bossShockwaveUpper: new Image(),
  platform: new Image(),
  platformTall: new Image(),
  mask: new Image(),
  enemyMove: new Image(),
  enemyHurt: new Image(),
  enemyChargeIndicator: new Image(),
  purpleDoor: new Image(),
  yellowDoor: new Image(),
  memory: new Image(),
  lantern: new Image(),
  lanternActive: new Image(),
  bgSky: new Image(),
  bgFar: new Image(),
  bgMid: new Image(),
  bgClose: new Image(),
  purpleDoorBox: new Image(),
  life: new Image(),
  lifeEmpty: new Image(),
  winScreen: new Image()
};

// Replace these files with same-sized sprites to update character art.
// Piskel sheets are arranged horizontally at 32x32 per frame.
sprites.title.src = "assets/title-screen.gif";
sprites.idle.src = "assets/idle.gif";
sprites.dash.src = "assets/dash.gif";
sprites.jump.src = "assets/jump.png";
sprites.walk.src = "assets/walk.png";
sprites.hurt.src = "assets/hurt.gif";
sprites.bossIdle.src = "assets/boss-idle.gif";
sprites.bossHurt.src = "assets/boss-hurt.gif";
sprites.bossFireballPose.src = "assets/boss-fireball-pose.gif";
sprites.bossFireball.src = "assets/boss-fireball.gif";
sprites.bossShockwavePose.src = "assets/boss-shockwave-pose.gif";
sprites.bossShockwaveLower.src = "assets/boss-shockwave-lower.gif";
sprites.bossShockwaveUpper.src = "assets/boss-shockwave-upper.gif";
sprites.platform.src = "assets/platform.gif";
sprites.platformTall.src = "assets/platform-tall.gif";
sprites.mask.src = "assets/mask.gif";
sprites.enemyMove.src = "assets/enemy-move.gif";
sprites.enemyHurt.src = "assets/enemy-hurt.gif";
sprites.enemyChargeIndicator.src = "assets/enemy-charge-indicator.gif";
sprites.purpleDoor.src = "assets/purple-door.gif";
sprites.yellowDoor.src = "assets/yellow-door.gif";
sprites.memory.src = "assets/memory.gif";
sprites.lantern.src = "assets/lantern.gif";
sprites.lanternActive.src = "assets/lantern-active.gif";
sprites.bgSky.src = "assets/bg-sky.gif";
sprites.bgFar.src = "assets/bg-far.gif";
sprites.bgMid.src = "assets/bg-mid.gif";
sprites.bgClose.src = "assets/bg-close.gif";
sprites.purpleDoorBox.src = "assets/purple-door-box.gif";
sprites.life.src = "assets/life.gif";
sprites.lifeEmpty.src = "assets/life-empty.gif";
sprites.winScreen.src = "assets/win-screen.gif";

const spriteMeta = {
  jump: { frameW: 32, frameH: 32, frames: 10, fps: 3 },
  walk: { frameW: 32, frameH: 32, frames: 4, fps: 3 }
};

const state = {
  screen: "menu",
  paused: false,
  quit: false,
  dialogue: "",
  dialogueTimer: 0,
  centerBoxTimer: 0,
  checkpoint: { x: 180, y: 1180 },
  memory: 0,
  totalMemory: 8,
  bossReward: false,
  screenFlash: 0,
  time: 0,
  won: false,
  gameOver: false
};
state.checkpoint.id = "start";

const camera = { x: 0, y: 0 };

const actions = [
  { id: "left", label: "Move Left" },
  { id: "right", label: "Move Right" },
  { id: "jump", label: "Jump" },
  { id: "dash", label: "Dash" },
  { id: "interact", label: "Interact" },
  { id: "down", label: "Down" },
  { id: "pause", label: "Pause" }
];

const controls = {
  left: ["a", "arrowleft"],
  right: ["d", "arrowright"],
  jump: ["w", "arrowup", " "],
  dash: ["shift", "j"],
  interact: ["e"],
  down: ["s", "arrowdown"],
  pause: ["escape", "p"]
};

const menu = {
  page: "main",
  selected: 0,
  remapping: null,
  message: "Click Start to enter the hollow."
};

const BOSS_FLOOR_Y = 890;

const player = {
  x: 180,
  y: 1180,
  w: 24,
  h: 36,
  vx: 0,
  vy: 0,
  facing: 1,
  hp: 5,
  maxHp: 5,
  grounded: false,
  wall: 0,
  coyote: 0,
  jumpBuffer: 0,
  dashCooldown: 0,
  dashTime: 0,
  hurtTime: 0,
  invuln: 0,
  respawnTimer: 0,
  state: "idle"
};

const WORLD = {
  width: 5200,
  height: 1680,
  solids: [
    rect(0, 1320, 900, 220), rect(950, 1260, 360, 48), rect(1400, 1190, 520, 56),
    rect(2020, 1240, 460, 54), rect(2580, 1160, 520, 58), rect(3200, 1240, 420, 54),
    rect(3680, 1330, 340, 110), rect(4180, BOSS_FLOOR_Y, 1020, 90),
    rect(640, 1110, 180, 36), rect(870, 980, 160, 34), rect(1130, 865, 220, 34),
    rect(1450, 760, 210, 34), rect(1750, 645, 320, 36), rect(2160, 770, 210, 34),
    rect(2460, 900, 240, 34), rect(2860, 850, 180, 34), rect(3140, 760, 240, 34),
    rect(3450, 650, 280, 36), rect(3880, 760, 260, 36), rect(120, 1470, 520, 40), rect(730, 1515, 210, 34),
    rect(1040, 1440, 250, 34), rect(1370, 1510, 280, 34), rect(1740, 1410, 300, 34),
    rect(2180, 1510, 330, 34), rect(2040, 540, 180, 32), rect(2350, 490, 190, 32),
    rect(2660, 435, 180, 32), rect(2960, 395, 190, 32), rect(3280, 455, 190, 32),
    rect(3600, 540, 200, 34), rect(3920, 670, 190, 34), rect(4140, 830, 180, 34)
  ],
  slopes: [],
  hazards: [],
  doors: [
    { ...rect(1910, 1115, 42, 126), type: "memory", need: 3, open: false, text: "Three bright tickets open the ticket gate." },
    { ...rect(5052, BOSS_FLOOR_Y - 130, 48, 130), type: "boss", need: 1, open: false, text: "The Mask is missing." }
  ],
  checkpoints: [
    { ...rect(165, 1250, 44, 70), id: "start" },
    { ...rect(1760, 573, 44, 70), id: "upper" },
    { ...rect(3890, 690, 44, 70), id: "boss" }
  ],
  signs: [],
  shards: [
    makeShard(715, 1060), makeShard(1215, 815), makeShard(1830, 590), makeShard(2620, 850),
    makeShard(3230, 705), makeShard(3950, 705), makeShard(1180, 1390), makeShard(2300, 1460)
  ],
  enemies: [
    makeEnemy(1000, 1216, 960, 1300), makeEnemy(2240, 1196, 2080, 2460),
    makeEnemy(1510, 710, 1450, 1640), makeEnemy(3950, 710, 3880, 4120),
    makeEnemy(1430, 1468, 1370, 1640), makeEnemy(3840, 1288, 3700, 4010)
  ]
};

const boss = {
  x: 4860,
  y: BOSS_FLOOR_Y - 90,
  w: 74,
  h: 90,
  arena: rect(4180, BOSS_FLOOR_Y - 360, 1000, 360),
  hp: 18,
  maxHp: 18,
  phase: 1,
  active: false,
  lockDelay: 0,
  defeated: false,
  attackMode: "idle",
  attackTimer: 1.2,
  nextAttack: "projectile",
  hurt: 0,
  vx: 0,
  projectiles: [],
  waves: [],
  key: { x: 4888, y: BOSS_FLOOR_Y - 32, w: 24, h: 24, active: false, got: false }
};

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function slope(x, y, w, h, dir) {
  return { x, y, w, h, dir };
}

function makeShard(x, y) {
  return { x, y, w: 18, h: 18, got: false, bob: Math.random() * 6.28 };
}

function makeEnemy(x, y, min, max) {
  return { x, y, w: 30, h: 26, vx: 55, min, max, hp: 2, hurt: 0, alive: true, mode: "patrol", timer: 0, chargeDir: 1 };
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function center(a) {
  return { x: a.x + a.w / 2, y: a.y + a.h / 2 };
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key)) e.preventDefault();
  if (state.screen === "menu") {
    handleMenuKey(k);
    return;
  }
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
  if (actionPressed("pause")) state.paused = !state.paused;
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

canvas.addEventListener("click", (e) => {
  const point = canvasPoint(e);
  if (state.screen === "menu") {
    handleMenuClick(point.x, point.y);
    return;
  }
  if (state.centerBoxTimer <= 0) return;
  const box = centerBoxBounds();
  if (point.x < box.x || point.x > box.x + box.w || point.y < box.y || point.y > box.y + box.h) {
    state.centerBoxTimer = 0;
  }
});

function canvasPoint(e) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (e.clientY - bounds.top) * (canvas.height / bounds.height)
  };
}

function key(...names) {
  return names.some((name) => keys.has(name));
}

function just(...names) {
  return names.some((name) => pressed.has(name));
}

function actionDown(action) {
  return controls[action].some((name) => keys.has(name));
}

function actionPressed(action) {
  return controls[action].some((name) => pressed.has(name));
}

function keyLabel(name) {
  return name === " " ? "Space" : name.length === 1 ? name.toUpperCase() : name.replace("arrow", "Arrow ");
}

function controlLabel(action) {
  return controls[action].map(keyLabel).join(" / ");
}

function handleMenuKey(k) {
  if (menu.remapping) {
    if (k === "escape") {
      menu.remapping = null;
      menu.message = "Remap canceled.";
      return;
    }
    controls[menu.remapping] = [k];
    menu.message = `${actions.find((a) => a.id === menu.remapping).label} set to ${keyLabel(k)}.`;
    menu.remapping = null;
    return;
  }

  if (k === "escape" && menu.page === "settings") {
    menu.page = "main";
    menu.selected = 1;
    menu.message = "Click Start to enter the hollow.";
    return;
  }

  const optionCount = menuOptionCount();
  if (k === "arrowup" || k === "w") menu.selected = (menu.selected + optionCount - 1) % optionCount;
  if (k === "arrowdown" || k === "s") menu.selected = (menu.selected + 1) % optionCount;
  if (k === "enter" || k === " ") {
    activateMenuSelection(menu.selected);
  }
}

function menuRowBounds(index) {
  return { x: 350, y: 405 + index * 42 - 27, w: 580, h: 34 };
}

function menuRows() {
  if (menu.page === "settings") {
    return ["Back"].concat(actions.map((action) => `${action.label}: ${controlLabel(action.id)}`));
  }
  return ["Start", "Settings", "Exit"];
}

function menuOptionCount() {
  return menuRows().length;
}

function activateMenuSelection(index) {
  menu.selected = index;
  if (menu.page === "main") {
    if (index === 0) startGame();
    else if (index === 1) {
      state.quit = false;
      menu.page = "settings";
      menu.selected = 0;
      menu.message = "Choose a control to remap.";
    } else if (index === 2) quitGame();
    return;
  }

  if (index === 0) {
    menu.page = "main";
    menu.selected = 1;
    menu.message = "Click Start to enter the hollow.";
  } else {
    const action = actions[index - 1];
    menu.remapping = action.id;
    menu.message = `Press a new key for ${action.label}. Esc cancels.`;
  }
}

function handleMenuClick(x, y) {
  if (menu.remapping) return;
  for (let i = 0; i < menuOptionCount(); i++) {
    const row = menuRowBounds(i);
    if (x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h) {
      activateMenuSelection(i);
      return;
    }
  }
}

function startGame() {
  state.screen = "game";
  state.quit = false;
  state.paused = false;
  keys.clear();
  pressed.clear();
  say("Find the tickets. The ticket gate listens.", 4);
}

function quitGame() {
  state.quit = true;
  menu.page = "main";
  menu.selected = 0;
  menu.message = "Game closed. Select Start to return.";
}

function physics(dt) {
  if (player.respawnTimer > 0) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) respawn();
    return;
  }

  const left = actionDown("left");
  const right = actionDown("right");
  const jump = actionPressed("jump");
  const dash = actionPressed("dash");
  const axis = (right ? 1 : 0) - (left ? 1 : 0);

  if (jump) player.jumpBuffer = 0.12;
  player.jumpBuffer -= dt;
  player.coyote -= dt;
  player.dashCooldown -= dt;
  player.invuln -= dt;
  player.hurtTime -= dt;

  if (player.dashTime <= 0) {
    const accel = player.grounded ? 2800 : 2100;
    const max = player.grounded ? 440 : 390;
    if (axis) {
      player.vx += axis * accel * dt;
      player.facing = axis;
    } else {
      player.vx *= Math.pow(player.grounded ? 0.0009 : 0.035, dt);
    }
    player.vx = clamp(player.vx, -max, max);
    player.vy += 1650 * dt;
  } else {
    player.dashTime -= dt;
    player.vy *= 0.94;
  }

  if (dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
    player.dashTime = 0.16;
    player.dashCooldown = 0.58;
    player.vx = player.facing * 760;
    player.vy = actionDown("jump") ? -220 : actionDown("down") ? 220 : 0;
    player.state = "dash";
  }

  if (player.jumpBuffer > 0) {
    if (player.grounded || player.coyote > 0) {
      player.vy = -610;
      player.grounded = false;
      player.jumpBuffer = 0;
    } else if (player.wall) {
      player.vx = -player.wall * 470;
      player.vy = -560;
      player.facing = -player.wall;
      player.jumpBuffer = 0;
      player.dashCooldown = Math.min(player.dashCooldown, 0.08);
    }
  }

  moveX(player, player.vx * dt);
  moveY(player, player.vy * dt);
  applySlopes(player);

  const speed = Math.abs(player.vx);
  player.state = player.hurtTime > 0 ? "hurt" : player.dashTime > 0 ? "dash" : !player.grounded ? "jump" : speed > 40 ? "run" : "idle";

  interactWorld();
}

function moveX(body, amount) {
  body.x += amount;
  body.wall = 0;
  for (const s of solidList()) {
    if (hit(body, s)) {
      if (amount > 0) {
        body.x = s.x - body.w;
        body.wall = 1;
      } else if (amount < 0) {
        body.x = s.x + s.w;
        body.wall = -1;
      }
      body.vx = 0;
    }
  }
  body.x = clamp(body.x, 0, WORLD.width - body.w);
}

function moveY(body, amount) {
  body.y += amount;
  body.grounded = false;
  for (const s of solidList()) {
    if (hit(body, s)) {
      if (amount > 0) {
        body.y = s.y - body.h;
        body.grounded = true;
        body.coyote = 0.08;
      } else if (amount < 0) {
        body.y = s.y + s.h;
      }
      body.vy = 0;
    }
  }
}

function solidList() {
  const doors = WORLD.doors.filter((d) => !d.open);
  return WORLD.solids.concat(doors, bossLockList());
}

function bossLockList() {
  if (!boss.active || boss.lockDelay > 0 || boss.defeated || player.respawnTimer > 0) return [];
  return [
    rect(boss.arena.x - 24, boss.arena.y, 34, boss.arena.h + 90),
    rect(boss.arena.x + boss.arena.w - 10, boss.arena.y, 34, boss.arena.h + 90)
  ];
}

function applySlopes(body) {
  const footX = body.x + body.w / 2;
  const footY = body.y + body.h;
  for (const sl of WORLD.slopes) {
    if (footX < sl.x || footX > sl.x + sl.w || footY < sl.y || footY > sl.y + sl.h + 18) continue;
    const t = (footX - sl.x) / sl.w;
    const surface = sl.dir < 0 ? sl.y + sl.h * t : sl.y + sl.h * (1 - t);
    if (footY >= surface - 10 && body.vy >= 0) {
      body.y = surface - body.h;
      body.vy = 0;
      body.grounded = true;
      body.coyote = 0.08;
    }
  }
}

function interactWorld() {
  for (const h of WORLD.hazards) {
    if (hit(player, h)) damagePlayer(1, -player.facing * 260, -430);
  }

  for (const c of WORLD.checkpoints) {
    if (hit(player, c)) {
      state.checkpoint = { x: c.x + 8, y: c.y - player.h, id: c.id };
    }
  }

  for (const d of WORLD.doors) {
    if (d.open) continue;
    const canOpen = d.type === "memory" ? state.memory >= d.need : state.bossReward;
    if (hit(player, { x: d.x - 12, y: d.y, w: d.w + 24, h: d.h }) && (actionPressed("interact") || actionPressed("down"))) {
      if (canOpen) {
        d.open = true;
        if (d.type === "memory") state.centerBoxTimer = 60;
        if (d.type === "boss") state.won = true;
        if (d.type === "boss") say("The Mask opens the way.", 3.4);
      } else {
        say(d.text, 3.4);
      }
    }
  }

  for (const shard of WORLD.shards) {
    if (!shard.got && hit(player, shard)) {
      shard.got = true;
      state.memory++;
      state.screenFlash = 0.25;
      say([
        "A Ticket for the Striped Tent!",
        "A Ticket to go on a ride!",
        "A Ticket for the games!",
        "A Ticket for the Gift Shop!"
      ][state.memory % 4], 2.6);
    }
  }

  if (boss.key.active && !boss.key.got && hit(player, { x: boss.key.x - 12, y: boss.key.y - 18, w: boss.key.w + 24, h: boss.key.h + 30 }) && (actionPressed("interact") || actionPressed("down"))) {
    boss.key.got = true;
    boss.key.active = false;
    state.bossReward = true;
    state.screenFlash = 0.28;
    say("You take The Mask. It hums like a tiny trapped spotlight.", 3.8);
  }

  if (player.y > WORLD.height + 180) damagePlayer(99, 0, 0);
}

function updateEnemies(dt) {
  for (const e of WORLD.enemies) {
    if (!e.alive) continue;
    e.hurt -= dt;
    e.timer -= dt;

    const dx = center(player).x - center(e).x;
    const dy = Math.abs(center(player).y - center(e).y);
    const canSeePlayer = Math.abs(dx) < 260 && dy < 80 && e.mode === "patrol";

    if (canSeePlayer) {
      e.mode = "windup";
      e.timer = 0.38;
      e.chargeDir = Math.sign(dx) || Math.sign(e.vx) || 1;
      e.vx = 0;
    }

    if (e.mode === "windup") {
      e.vx = 0;
      if (e.timer <= 0) {
        e.mode = "charge";
        e.timer = 0.34;
        e.vx = e.chargeDir * 380;
      }
    } else if (e.mode === "charge") {
      e.x += e.vx * dt;
      if (e.x < e.min || e.x + e.w > e.max) {
        e.x = clamp(e.x, e.min, e.max - e.w);
        e.timer = 0;
      }
      if (e.timer <= 0) {
        e.mode = "recover";
        e.timer = 0.55;
        e.vx = -e.chargeDir * 36;
      }
    } else if (e.mode === "recover") {
      e.x += e.vx * dt;
      if (e.timer <= 0) {
        e.mode = "patrol";
        e.vx = e.chargeDir * -55;
      }
    } else {
      e.x += e.vx * dt;
      if (e.x < e.min || e.x + e.w > e.max) e.vx *= -1;
    }

    if (hit(player, e)) {
      const dashHit = player.dashTime > 0;
      if (dashHit || player.vy > 240 && player.y + player.h < e.y + 18) {
        e.hp--;
        e.hurt = 0.18;
        if (dashHit) player.invuln = Math.max(player.invuln, 0.65);
        player.vy = -340;
        e.mode = "recover";
        e.timer = 0.45;
        e.vx = Math.sign(center(e).x - center(player).x) * 120;
        if (e.hp <= 0) e.alive = false;
      } else {
        damagePlayer(1, Math.sign(center(player).x - center(e).x) * 320, -320);
      }
    }
  }
}

function updateBoss(dt) {
  if (boss.defeated) return;
  if (player.respawnTimer > 0) {
    resetBossEncounterOnDeath();
    return;
  }
  const enteringArena = hit(player, boss.arena);
  if (enteringArena && !boss.active) {
    boss.active = true;
    boss.lockDelay = 1;
  }
  if (!boss.active) return;

  boss.lockDelay = Math.max(0, boss.lockDelay - dt);
  boss.hurt -= dt;
  boss.phase = boss.hp <= 8 ? 2 : 1;
  boss.x += Math.sin(state.time * (boss.phase === 2 ? 2.2 : 1.25)) * (boss.phase === 2 ? 1.8 : 1.1);

  for (const p of boss.projectiles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 560 * dt;
    if (hit(player, p)) {
      p.life = 0;
      damagePlayer(1, Math.sign(player.x - boss.x) * 340, -360);
      if (player.respawnTimer > 0) return;
    }
  }
  boss.projectiles = boss.projectiles.filter((p) => p.life > 0 && p.y < BOSS_FLOOR_Y + 180);

  for (const w of boss.waves) {
    w.life -= dt;
    w.warn -= dt;
    if (w.warn <= 0) w.x += w.vx * dt;
    if (w.warn <= 0 && hit(player, w)) {
      w.life = 0;
      damagePlayer(1, Math.sign(w.vx) * 360, -360);
      if (player.respawnTimer > 0) return;
    }
  }
  boss.waves = boss.waves.filter((w) => w.life > 0 && w.x > boss.arena.x - 40 && w.x < boss.arena.x + boss.arena.w + 40);

  updateBossAttackState(dt);

  if (hit(player, boss)) {
    const dashHit = player.dashTime > 0;
    if (dashHit || player.vy > 250 && player.y + player.h < boss.y + 20) {
      boss.hp--;
      boss.hurt = 0.2;
      if (dashHit) player.invuln = Math.max(player.invuln, 0.65);
      player.vy = -460;
      player.vx = -player.facing * 260;
      state.screenFlash = 0.12;
      if (boss.hp <= 0) {
        boss.defeated = true;
        boss.projectiles = [];
        boss.waves = [];
        boss.key.active = true;
        boss.key.x = boss.x + boss.w / 2 - boss.key.w / 2;
        boss.key.y = BOSS_FLOOR_Y - 32;
        state.screenFlash = 0.8;
        say("The ringmaster breaks. The Mask falls to the floor.", 5);
      }
    } else {
      damagePlayer(1, Math.sign(player.x - boss.x) * 380, -390);
      if (player.respawnTimer > 0) return;
    }
  }
}

function updateBossAttackState(dt) {
  boss.attackTimer -= dt;
  if (boss.attackMode === "idle" && boss.attackTimer <= 0) {
    boss.attackMode = boss.nextAttack === "projectile" ? "projectileWindup" : "waveWindup";
    boss.attackTimer = boss.phase === 2 ? 0.45 : 0.62;
    return;
  }

  if (boss.attackMode === "projectileWindup" && boss.attackTimer <= 0) {
    startBossProjectileAttack();
    boss.attackMode = "projectile";
    return;
  }

  if (boss.attackMode === "waveWindup" && boss.attackTimer <= 0) {
    startBossWaveAttack();
    boss.attackMode = "wave";
    return;
  }

  if (boss.attackMode === "projectile" && boss.projectiles.length === 0) {
    boss.attackMode = "idle";
    boss.nextAttack = "wave";
    boss.attackTimer = boss.phase === 2 ? 0.6 : 0.9;
  }

  if (boss.attackMode === "wave" && boss.waves.length === 0) {
    boss.attackMode = "idle";
    boss.nextAttack = "projectile";
    boss.attackTimer = boss.phase === 2 ? 0.7 : 1.05;
  }
}

function startBossProjectileAttack() {
  const toward = Math.sign(center(player).x - center(boss).x) || -1;
  boss.projectiles.push({ x: boss.x + boss.w / 2, y: boss.y + 28, w: 16, h: 16, vx: toward * (boss.phase === 2 ? 330 : 245), vy: boss.phase === 2 ? -160 : -80, life: 3.5 });
  if (boss.phase === 2) {
    boss.projectiles.push({ x: boss.x + boss.w / 2, y: boss.y + 48, w: 14, h: 14, vx: toward * 205, vy: -330, life: 3.2 });
  }
}

function startBossWaveAttack() {
  const floorY = BOSS_FLOOR_Y - 34;
  boss.waves.push({ x: boss.x + boss.w / 2 - 14, y: floorY, w: 28, h: 20, vx: -330, life: 1.45, warn: 0.22, kind: "lower" });
  boss.waves.push({ x: boss.x + boss.w / 2 - 14, y: floorY, w: 28, h: 20, vx: 330, life: 1.45, warn: 0.22, kind: "lower" });
  if (boss.phase === 2) {
    boss.waves.push({ x: boss.x + boss.w / 2 - 14, y: floorY - 94, w: 28, h: 20, vx: -270, life: 1.55, warn: 0.22, kind: "upper" });
    boss.waves.push({ x: boss.x + boss.w / 2 - 14, y: floorY - 94, w: 28, h: 20, vx: 270, life: 1.55, warn: 0.22, kind: "upper" });
  }
}

function damagePlayer(amount, kx, ky) {
  if (player.invuln > 0 || player.respawnTimer > 0) return;
  player.hp -= amount;
  player.invuln = 1.1;
  player.hurtTime = 0.32;
  player.vx = kx;
  player.vy = ky;
  state.screenFlash = 0.18;
  if (player.hp <= 0) {
    player.respawnTimer = 0.8;
    resetBossEncounterOnDeath();
  }
}

function resetBossEncounterOnDeath() {
  if (boss.defeated) return;
  boss.active = false;
  boss.lockDelay = 0;
  boss.attackMode = "idle";
  boss.attackTimer = 1.2;
  boss.nextAttack = "projectile";
  boss.projectiles = [];
  boss.waves = [];
}

function respawn() {
  player.x = state.checkpoint.x;
  player.y = state.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.hp = player.maxHp;
  player.invuln = 1.6;
  player.respawnTimer = 0;
  say("You wake by a lamp that refuses to go out.", 2.7);
}

function say(text, seconds) {
  state.dialogue = text;
  state.dialogueTimer = seconds;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function update(dt) {
  state.time += dt;
  if (state.screen === "menu") return;
  state.screenFlash = Math.max(0, state.screenFlash - dt);
  state.dialogueTimer = Math.max(0, state.dialogueTimer - dt);
  state.centerBoxTimer = Math.max(0, state.centerBoxTimer - dt);
  if (state.paused) return;
  if (state.won) return;
  physics(dt);
  updateEnemies(dt);
  updateBoss(dt);
  camera.x += (player.x + player.w / 2 - W / 2 - camera.x) * (1 - Math.pow(0.001, dt));
  camera.y += (player.y + player.h / 2 - H / 2 - camera.y) * (1 - Math.pow(0.003, dt));
  camera.x = clamp(camera.x, 0, WORLD.width - W);
  camera.y = clamp(camera.y, 0, WORLD.height - H);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (state.screen === "menu") {
    drawStartScreen();
    pressed.clear();
    return;
  }
  drawBackground();
  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  drawWorld();
  drawEntities();
  ctx.restore();
  drawHud();
  if (state.centerBoxTimer > 0) drawCenterBox();
  if (state.won) drawWinScreen();
  if (state.paused) drawPause();
  pressed.clear();
}

function drawBackground() {
  ctx.fillStyle = palette.void;
  ctx.fillRect(0, 0, W, H);
  drawVerticalStretchParallaxLayer(sprites.bgSky, { speed: 0.025, tileW: 192 });
  drawImageParallaxLayer(sprites.bgFar, { y: H - 520, speed: 0.08, tileW: 256, tileH: 480 });
  drawImageParallaxLayer(sprites.bgMid, { y: H - 390, speed: 0.2, tileW: 256, tileH: 440 });
  drawImageParallaxLayer(sprites.bgClose, { y: H - 250, speed: 0.42, tileW: 256, tileH: 380 });
}

function drawVerticalStretchParallaxLayer(image, layer) {
  if (!image.complete || image.naturalWidth <= 0) return;
  const ox = -((camera.x * layer.speed) % layer.tileW);
  for (let x = ox - layer.tileW; x < W + layer.tileW; x += layer.tileW) {
    ctx.drawImage(image, x, 0, layer.tileW, H);
  }
}

function drawProceduralParallaxLayer(layer) {
  const ox = -((camera.x * layer.speed) % layer.tileW);
  const yShift = -camera.y * layer.speed * 0.16;
  ctx.fillStyle = layer.color;
  for (let i = -1; i < Math.ceil(W / layer.tileW) + 2; i++) {
    const x = ox + i * layer.tileW;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x, layer.y + yShift);
    ctx.bezierCurveTo(
      x + layer.tileW * 0.22, layer.y - layer.amp + yShift + Math.sin(i + layer.phase) * 16,
      x + layer.tileW * 0.38, layer.y - layer.amp + yShift,
      x + layer.tileW * 0.5, layer.y + yShift
    );
    ctx.bezierCurveTo(
      x + layer.tileW * 0.68, layer.y + layer.amp * 0.58 + yShift,
      x + layer.tileW * 0.82, layer.y - layer.amp * 0.35 + yShift,
      x + layer.tileW, layer.y + yShift
    );
    ctx.lineTo(x + layer.tileW, H);
    ctx.closePath();
    ctx.fill();
  }
}

function drawImageParallaxLayer(image, layer) {
  if (!image.complete || image.naturalWidth <= 0) return;
  const ox = -((camera.x * layer.speed) % layer.tileW);
  const y = layer.y - camera.y * layer.speed * 0.1;
  for (let i = -1; i < Math.ceil(W / layer.tileW) + 2; i++) {
    ctx.drawImage(image, ox + i * layer.tileW, y, layer.tileW, layer.tileH);
  }
}

function drawDistantCircus() {
  const ox = -((camera.x * 0.18) % 900);
  ctx.strokeStyle = "rgba(255, 111, 159, 0.16)";
  ctx.lineWidth = 3;
  for (let i = -1; i < 5; i++) {
    const x = ox + i * 900 + 170;
    ctx.beginPath();
    ctx.arc(x, 270 - camera.y * 0.03, 95, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 208, 106, 0.06)";
    ctx.fillRect(x - 110, 270 - camera.y * 0.03, 220, 8);
    for (let s = 0; s < 6; s++) {
      ctx.strokeStyle = s % 2 ? "rgba(110, 231, 216, 0.12)" : "rgba(255, 111, 159, 0.13)";
      ctx.beginPath();
      ctx.moveTo(x, 176 - camera.y * 0.03);
      ctx.lineTo(x - 100 + s * 40, 278 - camera.y * 0.03);
      ctx.stroke();
    }
  }
}

function drawWorld() {
  for (const s of WORLD.solids) drawPlatform(s);
  for (const sl of WORLD.slopes) drawSlope(sl);
  for (const h of WORLD.hazards) drawHazard(h);
  for (const d of WORLD.doors) drawDoor(d);
  for (const lock of bossLockList()) drawBossLock(lock);
  for (const c of WORLD.checkpoints) drawCheckpoint(c);
  for (const shard of WORLD.shards) if (!shard.got) drawShard(shard);
  drawVines();
}

function drawPlatform(r) {
  const platformSprite = r.h >= 64 ? sprites.platformTall : sprites.platform;
  if (platformSprite.complete && platformSprite.naturalWidth > 0) {
    const tileW = platformSprite.naturalWidth;
    for (let x = 0; x < r.w; x += tileW) {
      const drawW = Math.min(tileW, r.w - x);
      ctx.drawImage(platformSprite, 0, 0, drawW, platformSprite.naturalHeight, r.x + x, r.y, drawW, r.h);
    }
    return;
  }

  ctx.fillStyle = "#151823";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = "#25372d";
  ctx.fillRect(r.x, r.y, r.w, 10);
  ctx.fillStyle = "rgba(200,246,255,0.11)";
  for (let x = r.x + 8; x < r.x + r.w; x += 38) ctx.fillRect(x, r.y + 3, 16, 2);
}

function drawSlope(sl) {
  ctx.fillStyle = "#151823";
  ctx.beginPath();
  if (sl.dir < 0) {
    ctx.moveTo(sl.x, sl.y);
    ctx.lineTo(sl.x + sl.w, sl.y + sl.h);
    ctx.lineTo(sl.x, sl.y + sl.h);
  } else {
    ctx.moveTo(sl.x, sl.y + sl.h);
    ctx.lineTo(sl.x + sl.w, sl.y);
    ctx.lineTo(sl.x + sl.w, sl.y + sl.h);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4c755b";
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawHazard(h) {
  ctx.fillStyle = "#220b14";
  ctx.fillRect(h.x, h.y, h.w, h.h);
  for (let x = h.x; x < h.x + h.w; x += 22) {
    ctx.fillStyle = x % 44 ? palette.rose : palette.danger;
    ctx.beginPath();
    ctx.moveTo(x, h.y + h.h);
    ctx.lineTo(x + 11, h.y + 2);
    ctx.lineTo(x + 22, h.y + h.h);
    ctx.fill();
  }
}

function drawDoor(d) {
  if (d.open) return;
  if (d.type === "memory" && sprites.purpleDoor.complete && sprites.purpleDoor.naturalWidth > 0) {
    ctx.drawImage(sprites.purpleDoor, d.x - 5, d.y, d.w + 10, d.h);
    return;
  }
  if (d.type === "boss" && sprites.yellowDoor.complete && sprites.yellowDoor.naturalWidth > 0) {
    ctx.drawImage(sprites.yellowDoor, d.x - 5, d.y, d.w + 10, d.h);
    return;
  }
  ctx.fillStyle = d.type === "memory" ? "#302143" : "#39261b";
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = d.type === "memory" ? palette.ghost : palette.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(d.x + 5, d.y + 6, d.w - 10, d.h - 12);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(d.x + d.w - 15, d.y + d.h / 2, 5, 5);
}

function drawBossLock(lock) {
  ctx.fillStyle = "rgba(7, 7, 13, 0.86)";
  ctx.fillRect(lock.x, lock.y, lock.w, lock.h);
  ctx.strokeStyle = palette.rose;
  ctx.lineWidth = 3;
  ctx.strokeRect(lock.x + 5, lock.y + 5, lock.w - 10, lock.h - 10);
  ctx.fillStyle = palette.gold;
  for (let y = lock.y + 18; y < lock.y + lock.h - 14; y += 30) {
    ctx.fillRect(lock.x + 10, y, lock.w - 20, 4);
  }
}

function drawCheckpoint(c) {
  const active = c.id === state.checkpoint.id;
  if (active) {
    const glow = Math.sin(state.time * 4 + c.x) * 0.2 + 0.68;
    ctx.fillStyle = palette.gold;
    ctx.globalAlpha = Math.min(1, glow);
    ctx.beginPath();
    ctx.arc(c.x + 22, c.y - 70, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const lanternSprite = active ? sprites.lanternActive : sprites.lantern;
  if (lanternSprite.complete && lanternSprite.naturalWidth > 0) {
    ctx.drawImage(lanternSprite, c.x + 5, c.y - 74, 34, 144);
    return;
  }
  ctx.fillStyle = "#13131f";
  ctx.fillRect(c.x + 17, c.y + 26, 9, 44);
}

function drawSign(sign) {
  ctx.fillStyle = "#2b1d2f";
  ctx.fillRect(sign.x + 8, sign.y + 14, 30, 20);
  ctx.fillStyle = "#151823";
  ctx.fillRect(sign.x + 20, sign.y + 34, 5, 34);
}

function drawShard(shard) {
  const y = shard.y + Math.sin(state.time * 4 + shard.bob) * 6;
  ctx.save();
  ctx.translate(shard.x + 9, y + 9);
  ctx.rotate(state.time * 1.8);
  if (sprites.memory.complete && sprites.memory.naturalWidth > 0) {
    ctx.drawImage(sprites.memory, -18, -10, 36, 20);
    ctx.restore();
    return;
  }
  ctx.fillStyle = palette.teal;
  ctx.fillRect(-4, -10, 8, 20);
  ctx.fillRect(-10, -4, 20, 8);
  ctx.strokeStyle = "#e8ffff";
  ctx.strokeRect(-5, -11, 10, 22);
  ctx.restore();
}

function drawVines() {
  ctx.strokeStyle = "rgba(76,117,91,0.58)";
  ctx.lineWidth = 3;
  for (let x = 120; x < WORLD.width; x += 230) {
    const top = 100 + Math.sin(x) * 70;
    ctx.beginPath();
    ctx.moveTo(x, top);
    for (let y = top; y < top + 220; y += 30) ctx.lineTo(x + Math.sin(y * 0.04 + x) * 18, y);
    ctx.stroke();
  }
}

function drawEntities() {
  for (const e of WORLD.enemies) if (e.alive) drawEnemy(e);
  if (!boss.defeated) drawBoss();
  for (const p of boss.projectiles) drawProjectile(p);
  for (const w of boss.waves) drawWave(w);
  if (boss.key.active && !boss.key.got) drawKey(boss.key);
  drawPlayer();
}

function drawPlayer() {
  const blink = player.invuln > 0 && Math.floor(state.time * 22) % 2 === 0;
  if (blink) return;

  if (player.state === "jump" && drawPlayerSheet(sprites.jump, spriteMeta.jump)) {
    return;
  }

  if (player.state === "run" && drawPlayerSheet(sprites.walk, spriteMeta.walk)) {
    return;
  }

  const stateSprite = player.state === "hurt" ? sprites.hurt : player.state === "idle" ? sprites.idle : player.state === "dash" ? sprites.dash : null;
  if (stateSprite && stateSprite.complete && stateSprite.naturalWidth > 0) {
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h);
    ctx.scale(player.facing, 1);
    ctx.drawImage(stateSprite, -24, -48, 48, 48);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.scale(player.facing, 1);
  const squash = player.state === "run" ? Math.sin(state.time * 22) * 2 : 0;
  ctx.fillStyle = player.state === "hurt" ? palette.rose : "#1a1021";
  ctx.fillRect(-10, -14 + squash, 20, 26 - squash);
  ctx.fillStyle = palette.mist;
  ctx.fillRect(3, -18, 7, 5);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(-5, -7, 4, 4);
  ctx.fillRect(4, -7, 4, 4);
  ctx.fillStyle = palette.teal;
  if (player.state === "dash") ctx.fillRect(-26, -2, 18, 4);
  ctx.fillRect(-7, 12, 5, 9);
  ctx.fillRect(4, 12, 5, 9);
  ctx.restore();
}

function drawPlayerSheet(image, meta) {
  if (!image.complete || image.naturalWidth <= 0) return false;
  const frame = Math.floor(state.time * meta.fps) % meta.frames;
  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h);
  ctx.scale(player.facing, 1);
  ctx.drawImage(image, frame * meta.frameW, 0, meta.frameW, meta.frameH, -24, -48, 48, 48);
  ctx.restore();
  return true;
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  if (e.mode === "windup") drawEnemyChargeIndicator(e);
  ctx.scale(e.chargeDir || Math.sign(e.vx) || 1, 1);
  if (e.hurt > 0 && sprites.enemyHurt.complete && sprites.enemyHurt.naturalWidth > 0) {
    ctx.drawImage(sprites.enemyHurt, -22, -22, 44, 44);
    ctx.restore();
    return;
  }
  if (sprites.enemyMove.complete && sprites.enemyMove.naturalWidth > 0) {
    const spinSpeed = e.mode === "charge" ? 18 : e.mode === "windup" ? 7 : 11;
    ctx.rotate(state.time * spinSpeed * (e.chargeDir || Math.sign(e.vx) || 1));
    ctx.drawImage(sprites.enemyMove, -22, -22, 44, 44);
    if (e.hurt > 0) {
      ctx.fillStyle = "rgba(255, 111, 159, 0.34)";
      ctx.fillRect(-22, -22, 44, 44);
    }
    ctx.restore();
    return;
  }
  if (e.mode === "windup") {
    ctx.fillStyle = "rgba(255, 208, 106, 0.4)";
    ctx.fillRect(14, -4, 38, 8);
  }
  ctx.fillStyle = e.hurt > 0 ? palette.rose : e.mode === "charge" ? "#513048" : "#2d1733";
  ctx.fillRect(e.mode === "windup" ? -18 : -15, e.mode === "windup" ? -8 : -10, e.mode === "windup" ? 27 : 30, e.mode === "charge" ? 18 : 20);
  ctx.fillStyle = "#5d345d";
  ctx.fillRect(-8, -18, 16, 10);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(3, -4, 4, 4);
  ctx.fillStyle = palette.vine;
  ctx.fillRect(-12, 8, 5, 8);
  ctx.fillRect(7, 8, 5, 8);
  ctx.restore();
}

function drawEnemyChargeIndicator(e) {
  const dir = e.chargeDir || 1;
  const blink = 0.72 + Math.sin(state.time * 24) * 0.18;
  ctx.save();
  ctx.translate(dir < 0 ? -62 : 62, -2);
  ctx.globalAlpha = blink;
  if (sprites.enemyChargeIndicator.complete && sprites.enemyChargeIndicator.naturalWidth > 0) {
    if (dir > 0) ctx.scale(-1, 1);
    ctx.drawImage(sprites.enemyChargeIndicator, -30, -10, 60, 20);
  } else {
    ctx.fillStyle = "rgba(255, 208, 106, 0.55)";
    ctx.fillRect(-30, -4, 60, 8);
  }
  ctx.restore();
}

function drawBoss() {
  ctx.save();
  ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2);
  const projectilePose = boss.attackMode === "projectileWindup" || boss.attackMode === "projectile";
  const wavePose = boss.attackMode === "waveWindup" || boss.attackMode === "wave" || boss.waves.length > 0;
  if (boss.hurt > 0 && sprites.bossHurt.complete && sprites.bossHurt.naturalWidth > 0) {
    const bob = Math.sin(state.time * 2.5) * 3;
    ctx.drawImage(sprites.bossHurt, -64, -86 + bob, 128, 128);
    ctx.restore();
    return;
  }
  if (projectilePose && sprites.bossFireballPose.complete && sprites.bossFireballPose.naturalWidth > 0) {
    const bob = Math.sin(state.time * 3) * 2;
    ctx.drawImage(sprites.bossFireballPose, -64, -86 + bob, 128, 128);
    ctx.restore();
    return;
  }
  if (wavePose && sprites.bossShockwavePose.complete && sprites.bossShockwavePose.naturalWidth > 0) {
    const bob = Math.sin(state.time * 3) * 2;
    ctx.drawImage(sprites.bossShockwavePose, -64, -86 + bob, 128, 128);
    ctx.restore();
    return;
  }
  if (!projectilePose && !wavePose && sprites.bossIdle.complete && sprites.bossIdle.naturalWidth > 0) {
    const bob = Math.sin(state.time * 2.5) * 3;
    ctx.drawImage(sprites.bossIdle, -64, -86 + bob, 128, 128);
    if (boss.hurt > 0) {
      ctx.fillStyle = "rgba(255, 111, 159, 0.28)";
      ctx.fillRect(-64, -86 + bob, 128, 128);
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = boss.hurt > 0 ? palette.rose : projectilePose ? "#342150" : wavePose ? "#1f3e38" : "#26132a";
  ctx.fillRect(projectilePose ? -26 : -34, wavePose ? -22 : -30, projectilePose ? 52 : 68, wavePose ? 84 : 76);
  ctx.fillStyle = boss.phase === 2 ? palette.danger : projectilePose ? palette.ghost : wavePose ? palette.teal : palette.gold;
  ctx.fillRect(-40, projectilePose ? -54 : -45, 80, projectilePose ? 24 : 16);
  ctx.fillStyle = "#090910";
  ctx.fillRect(-22, -16, 12, 8);
  ctx.fillRect(10, -16, 12, 8);
  ctx.strokeStyle = projectilePose ? palette.gold : wavePose ? palette.rose : palette.teal;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (projectilePose) {
    ctx.moveTo(-30, 8);
    ctx.lineTo(30, 8);
    ctx.moveTo(0, -28);
    ctx.lineTo(0, 38);
  } else if (wavePose) {
    ctx.arc(0, 8, 38, Math.PI * 0.08, Math.PI * 0.92);
    ctx.moveTo(-42, 40);
    ctx.lineTo(42, 40);
  } else {
    ctx.arc(0, 2, 32, 0.2, Math.PI - 0.2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawProjectile(p) {
  if (sprites.bossFireball.complete && sprites.bossFireball.naturalWidth > 0) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.scale(Math.sign(p.vx) || 1, 1);
    ctx.drawImage(sprites.bossFireball, -24, -24, 48, 48);
    ctx.restore();
    return;
  }
  ctx.fillStyle = palette.rose;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
}

function drawWave(w) {
  if (w.kind === "lower" && sprites.bossShockwaveLower.complete && sprites.bossShockwaveLower.naturalWidth > 0) {
    ctx.save();
    ctx.translate(w.x + w.w / 2, w.y + w.h / 2);
    ctx.scale(-(Math.sign(w.vx) || 1), 1);
    ctx.globalAlpha = w.warn > 0 ? 0.45 : 1;
    ctx.drawImage(sprites.bossShockwaveLower, -29, -24, 58, 48);
    ctx.restore();
    return;
  }
  if (w.kind === "upper" && sprites.bossShockwaveUpper.complete && sprites.bossShockwaveUpper.naturalWidth > 0) {
    ctx.save();
    ctx.translate(w.x + w.w / 2, w.y + w.h / 2);
    ctx.scale(-(Math.sign(w.vx) || 1), 1);
    ctx.globalAlpha = w.warn > 0 ? 0.45 : 1;
    ctx.drawImage(sprites.bossShockwaveUpper, -29, -24, 58, 48);
    ctx.restore();
    return;
  }
  ctx.fillStyle = w.warn > 0 ? "rgba(255, 208, 106, 0.34)" : palette.rose;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = w.warn > 0 ? "rgba(255, 111, 159, 0.22)" : palette.gold;
  ctx.fillRect(w.x + 5, w.y - 10, w.w - 10, 10);
}

function drawKey(k) {
  const bob = Math.sin(state.time * 5) * 4;
  const pulse = 0.24 + Math.sin(state.time * 4) * 0.08;
  ctx.save();
  ctx.translate(k.x + k.w / 2, k.y + k.h / 2 + bob);
  ctx.fillStyle = `rgba(255, 222, 70, ${pulse})`;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 208, 106, 0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  if (sprites.mask.complete && sprites.mask.naturalWidth > 0) {
    ctx.drawImage(sprites.mask, -28, -28, 56, 56);
  } else {
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0.15, Math.PI * 1.85);
    ctx.moveTo(-12, -7);
    ctx.lineTo(-4, 2);
    ctx.moveTo(12, -7);
    ctx.lineTo(4, 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "rgba(7,7,13,0.58)";
  ctx.fillRect(22, 20, 354, 76);
  for (let i = 0; i < player.maxHp; i++) {
    const x = 42 + i * 34;
    if (i < player.hp) {
      if (sprites.life.complete && sprites.life.naturalWidth > 0) {
        ctx.drawImage(sprites.life, x - 2, 40, 26, 26);
      } else {
        ctx.fillStyle = palette.rose;
        ctx.fillRect(x, 42, 22, 22);
      }
    } else if (sprites.lifeEmpty.complete && sprites.lifeEmpty.naturalWidth > 0) {
      ctx.drawImage(sprites.lifeEmpty, x - 2, 40, 26, 26);
    } else {
      ctx.fillStyle = "#332735";
      ctx.fillRect(x, 42, 22, 22);
    }
  }
  ctx.fillStyle = palette.mist;
  ctx.font = "18px monospace";
  ctx.fillText(`Tickets ${state.memory}/${state.totalMemory}`, 220, 58);
  ctx.fillStyle = palette.gold;
  ctx.fillText(state.bossReward ? "The Mask" : "No Mask", 220, 82);

  if (boss.active && !boss.defeated) {
    ctx.fillStyle = "rgba(7,7,13,0.72)";
    ctx.fillRect(W / 2 - 190, 28, 380, 28);
    ctx.fillStyle = "#392036";
    ctx.fillRect(W / 2 - 178, 38, 356, 8);
    ctx.fillStyle = boss.phase === 2 ? palette.danger : palette.rose;
    ctx.fillRect(W / 2 - 178, 38, 356 * (boss.hp / boss.maxHp), 8);
  }

  if (state.dialogueTimer > 0) {
    drawTextBox(state.dialogue);
  }

  if (state.screenFlash > 0) {
    ctx.fillStyle = `rgba(255, 240, 210, ${state.screenFlash * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawTextBox(text) {
  ctx.fillStyle = "rgba(5,5,12,0.82)";
  ctx.fillRect(260, H - 142, 760, 92);
  ctx.strokeStyle = "rgba(200,246,255,0.38)";
  ctx.strokeRect(270, H - 132, 740, 72);
  ctx.fillStyle = palette.mist;
  ctx.font = "20px monospace";
  wrapText(text, 300, H - 100, 690, 26);
}

function drawCenterBox() {
  const box = centerBoxBounds();
  ctx.save();
  if (sprites.purpleDoorBox.complete && sprites.purpleDoorBox.naturalWidth > 0) {
    ctx.drawImage(sprites.purpleDoorBox, box.x, box.y, box.w, box.h);
  } else {
    ctx.fillStyle = "rgba(0, 0, 0, 0.94)";
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}

function centerBoxBounds() {
  return { x: W / 2 - 180, y: H / 2 - 340, w: 360, h: 680 };
}

function drawWinScreen() {
  if (sprites.winScreen.complete && sprites.winScreen.naturalWidth > 0) {
    ctx.drawImage(sprites.winScreen, 0, 0, W, H);
  } else {
    ctx.fillStyle = "rgba(2, 2, 7, 0.88)";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`Tickets ${state.memory}/${state.totalMemory}`, W - 28, H - 28);
  ctx.textAlign = "left";
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

function drawPause() {
  ctx.fillStyle = "rgba(2,2,7,0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.gold;
  ctx.font = "44px monospace";
  ctx.fillText("VELVET HOLLOW", 448, 252);
  ctx.fillStyle = palette.mist;
  ctx.font = "22px monospace";
  ctx.fillText("Paused", 596, 306);
  ctx.fillText("Run, jump, wall jump, dash. Press E or Down near locked doors.", 314, 360);
  ctx.fillText("Collect tickets. Find lamps. Break the ringmaster mask.", 350, 398);
}

function drawStartScreen() {
  ctx.fillStyle = palette.void;
  ctx.fillRect(0, 0, W, H);

  if (sprites.title.complete && sprites.title.naturalWidth > 0) {
    ctx.drawImage(sprites.title, 0, 0, W, H);
  } else {
    drawBackground();
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "rgba(5, 5, 12, 0.28)";
  ctx.fillRect(0, 0, W, H);

  const rows = menuRows();
  for (let i = 0; i < rows.length; i++) {
    const row = menuRowBounds(i);
    const textY = row.y + 23;
    const selected = i === menu.selected;
    ctx.fillStyle = selected ? "rgba(255, 208, 106, 0.24)" : "rgba(7, 7, 13, 0.56)";
    ctx.fillRect(row.x, row.y, row.w, row.h);
    ctx.strokeStyle = selected ? palette.gold : "rgba(200, 246, 255, 0.18)";
    ctx.strokeRect(row.x, row.y, row.w, row.h);
    ctx.fillStyle = selected ? palette.gold : palette.mist;
    ctx.font = menu.page === "main" ? "24px monospace" : i === 0 ? "22px monospace" : "19px monospace";
    ctx.fillText(`${selected ? "> " : "  "}${rows[i]}`, 380, textY);
  }

  if (menu.remapping) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillRect(270, 578, 740, 58);
    ctx.strokeStyle = palette.gold;
    ctx.strokeRect(280, 588, 720, 38);
    ctx.fillStyle = palette.gold;
    ctx.font = "20px monospace";
    ctx.fillText("Press any key to assign it. Esc cancels.", 410, 613);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

say("Find the tickets. The ticket gate listens.", 4);
requestAnimationFrame(loop);
