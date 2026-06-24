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
  idle: new Image(),
  dash: new Image(),
  jump: new Image(),
  walk: new Image(),
  hurt: new Image(),
  bossIdle: new Image(),
  bossHurt: new Image(),
  bossFireball: new Image(),
  bossShockwavePose: new Image(),
  bossShockwaveLower: new Image(),
  bossShockwaveUpper: new Image()
};

// Replace these files with same-sized sprites to update character art.
// Piskel sheets are arranged horizontally at 32x32 per frame.
sprites.idle.src = "assets/idle.gif";
sprites.dash.src = "assets/dash.gif";
sprites.jump.src = "assets/jump.png";
sprites.walk.src = "assets/walk.png";
sprites.hurt.src = "assets/hurt.gif";
sprites.bossIdle.src = "assets/boss-idle.gif";
sprites.bossHurt.src = "assets/boss-hurt.gif";
sprites.bossFireball.src = "assets/boss-fireball.gif";
sprites.bossShockwavePose.src = "assets/boss-shockwave-pose.gif";
sprites.bossShockwaveLower.src = "assets/boss-shockwave-lower.gif";
sprites.bossShockwaveUpper.src = "assets/boss-shockwave-upper.gif";

const spriteMeta = {
  jump: { frameW: 32, frameH: 32, frames: 10, fps: 3 },
  walk: { frameW: 32, frameH: 32, frames: 4, fps: 3 }
};

const state = {
  paused: false,
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

const camera = { x: 0, y: 0 };

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
    rect(3680, 1330, 1520, 210), rect(5130, 1040, 70, 500),
    rect(640, 1110, 180, 36), rect(870, 980, 160, 34), rect(1130, 865, 220, 34),
    rect(1450, 760, 210, 34), rect(1750, 645, 320, 36), rect(2160, 770, 210, 34),
    rect(2460, 900, 240, 34), rect(2860, 850, 180, 34), rect(3140, 760, 240, 34),
    rect(3450, 650, 280, 36), rect(3880, 760, 260, 36), rect(4260, 900, 240, 34),
    rect(4560, 1030, 220, 34), rect(120, 1470, 520, 40), rect(730, 1515, 210, 34),
    rect(1040, 1440, 250, 34), rect(1370, 1510, 280, 34), rect(1740, 1410, 300, 34),
    rect(2180, 1510, 330, 34)
  ],
  slopes: [
    slope(1260, 1260, 180, 70, -1), slope(1920, 1240, 120, 50, 1),
    slope(2480, 1240, 140, 80, -1), slope(3060, 1240, 140, 80, 1),
    slope(3620, 1330, 80, 90, -1)
  ],
  hazards: [
    rect(1320, 1354, 380, 34), rect(2520, 1320, 360, 34), rect(4100, 1510, 390, 34),
    rect(770, 1560, 200, 34), rect(1660, 1548, 220, 34), rect(3060, 1292, 120, 28)
  ],
  doors: [
    { ...rect(1910, 1115, 42, 126), type: "memory", need: 3, open: false, text: "Three bright memories open the ticket gate." },
    { ...rect(5052, 1200, 48, 130), type: "boss", need: 1, open: false, text: "The ringmaster's brass key is missing." }
  ],
  checkpoints: [rect(165, 1250, 44, 70), rect(1760, 573, 44, 70), rect(3770, 1258, 44, 70)],
  signs: [
    { ...rect(260, 1248, 44, 70), text: "The carnival slept underground when the rain learned its name." },
    { ...rect(1160, 795, 44, 70), text: "Hold jump against a wall, then leap away. The old tents remember momentum." },
    { ...rect(3295, 690, 44, 70), text: "A locked gate below counts what you carry, not what you lost." },
    { ...rect(4800, 1140, 44, 70), text: "Past this door: the last-lit ring. Leave a checkpoint in your heart." }
  ],
  shards: [
    makeShard(715, 1060), makeShard(1215, 815), makeShard(1830, 590), makeShard(2620, 850),
    makeShard(3230, 705), makeShard(3950, 705), makeShard(1180, 1390), makeShard(2300, 1460)
  ],
  enemies: [
    makeEnemy(1000, 1216, 960, 1300), makeEnemy(2240, 1196, 2080, 2460),
    makeEnemy(1510, 710, 1450, 1640), makeEnemy(3950, 710, 3880, 4120),
    makeEnemy(1430, 1468, 1370, 1640), makeEnemy(3840, 1288, 3700, 4300)
  ]
};

const boss = {
  x: 4860,
  y: 1240,
  w: 74,
  h: 90,
  arena: rect(4180, 870, 1000, 360),
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
  key: { x: 4888, y: 1160, w: 24, h: 24, active: false, got: false }
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
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key)) e.preventDefault();
  if (k === "escape" || k === "p") state.paused = !state.paused;
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

canvas.addEventListener("click", (e) => {
  if (state.centerBoxTimer <= 0) return;
  const bounds = canvas.getBoundingClientRect();
  const x = (e.clientX - bounds.left) * (canvas.width / bounds.width);
  const y = (e.clientY - bounds.top) * (canvas.height / bounds.height);
  const box = centerBoxBounds();
  if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) {
    state.centerBoxTimer = 0;
  }
});

function key(...names) {
  return names.some((name) => keys.has(name));
}

function just(...names) {
  return names.some((name) => pressed.has(name));
}

function physics(dt) {
  if (player.respawnTimer > 0) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) respawn();
    return;
  }

  const left = key("a", "arrowleft");
  const right = key("d", "arrowright");
  const jump = just("w", "arrowup", " ");
  const dash = just("shift", "j");
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
    player.vy = key("w", "arrowup") ? -220 : key("s", "arrowdown") ? 220 : 0;
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
    rect(boss.arena.x - 24, 660, 34, 670),
    rect(boss.arena.x + boss.arena.w - 10, 660, 34, 670)
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
      state.checkpoint = { x: c.x + 8, y: c.y - player.h };
    }
  }

  for (const sign of WORLD.signs) {
    if (hit(player, sign) && just("e", "arrowdown", "s")) say(sign.text, 4.5);
  }

  for (const d of WORLD.doors) {
    if (d.open) continue;
    const canOpen = d.type === "memory" ? state.memory >= d.need : state.bossReward;
    if (hit(player, { x: d.x - 12, y: d.y, w: d.w + 24, h: d.h }) && just("e", "arrowdown", "s")) {
      if (canOpen) {
        d.open = true;
        if (d.type === "memory") state.centerBoxTimer = 60;
        if (d.type === "boss") state.won = true;
        say(d.type === "memory" ? "The ticket gate folds itself into mothlight." : "The brass lock sighs open.", 3.4);
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
      say(["A warm laugh, cut short.", "Rain on striped canvas.", "A hand letting go.", "A song under the roots."][state.memory % 4], 2.6);
    }
  }

  if (boss.key.active && !boss.key.got && hit(player, { x: boss.key.x - 12, y: boss.key.y - 18, w: boss.key.w + 24, h: boss.key.h + 30 }) && just("e", "arrowdown", "s")) {
    boss.key.got = true;
    boss.key.active = false;
    state.bossReward = true;
    state.screenFlash = 0.28;
    say("You take the brass key. It hums like a tiny trapped spotlight.", 3.8);
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
      if (player.dashTime > 0 || player.vy > 240 && player.y + player.h < e.y + 18) {
        e.hp--;
        e.hurt = 0.18;
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
  boss.projectiles = boss.projectiles.filter((p) => p.life > 0 && p.y < 1320);

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
    if (player.dashTime > 0 || player.vy > 250 && player.y + player.h < boss.y + 20) {
      boss.hp--;
      boss.hurt = 0.2;
      player.vy = -460;
      player.vx = -player.facing * 260;
      state.screenFlash = 0.12;
      if (boss.hp <= 0) {
        boss.defeated = true;
        boss.projectiles = [];
        boss.waves = [];
        boss.key.active = true;
        boss.key.x = boss.x + boss.w / 2 - boss.key.w / 2;
        boss.key.y = 1298;
        state.screenFlash = 0.8;
        say("The ringmaster's mask breaks. A brass key falls to the floor.", 5);
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
  const floorY = 1310;
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
  const layers = [
    { color: "#171726", y: 230, amp: 70, speed: 0.12 },
    { color: "#1d2530", y: 320, amp: 90, speed: 0.22 },
    { color: "#19291f", y: 420, amp: 120, speed: 0.35 }
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = -60; x <= W + 80; x += 80) {
      const wx = x + camera.x * layer.speed;
      const y = layer.y + Math.sin(wx * 0.004) * layer.amp + Math.sin(wx * 0.011) * 25 - camera.y * layer.speed * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
  drawDistantCircus();
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
  for (const sign of WORLD.signs) drawSign(sign);
  for (const shard of WORLD.shards) if (!shard.got) drawShard(shard);
  drawVines();
}

function drawPlatform(r) {
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
  ctx.fillStyle = "#13131f";
  ctx.fillRect(c.x + 17, c.y + 26, 9, 44);
  ctx.fillStyle = palette.gold;
  const glow = Math.sin(state.time * 4 + c.x) * 0.2 + 0.6;
  ctx.globalAlpha = glow;
  ctx.beginPath();
  ctx.arc(c.x + 22, c.y + 18, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
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
  ctx.scale(e.chargeDir || Math.sign(e.vx) || 1, 1);
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
  if (wavePose && sprites.bossShockwavePose.complete && sprites.bossShockwavePose.naturalWidth > 0) {
    const bob = Math.sin(state.time * 3) * 2;
    ctx.drawImage(sprites.bossShockwavePose, -64, -86 + bob, 128, 128);
    if (boss.attackMode === "waveWindup") {
      ctx.fillStyle = "rgba(110, 231, 216, 0.35)";
      ctx.fillRect(-54, 48, 108, 8);
    }
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
  if (boss.attackMode.endsWith("Windup")) {
    ctx.fillStyle = projectilePose ? "rgba(255, 208, 106, 0.45)" : "rgba(110, 231, 216, 0.42)";
    ctx.fillRect(-48, 50, 96, 8);
  }
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
  ctx.save();
  ctx.translate(k.x + k.w / 2, k.y + k.h / 2 + bob);
  ctx.fillStyle = "rgba(255, 208, 106, 0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(-7, -2, 8, 0, Math.PI * 2);
  ctx.moveTo(1, -2);
  ctx.lineTo(18, -2);
  ctx.moveTo(10, -2);
  ctx.lineTo(10, 6);
  ctx.moveTo(16, -2);
  ctx.lineTo(16, 4);
  ctx.stroke();
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "rgba(7,7,13,0.58)";
  ctx.fillRect(22, 20, 354, 76);
  for (let i = 0; i < player.maxHp; i++) {
    ctx.fillStyle = i < player.hp ? palette.rose : "#332735";
    ctx.fillRect(42 + i * 34, 42, 22, 22);
  }
  ctx.fillStyle = palette.mist;
  ctx.font = "18px monospace";
  ctx.fillText(`Memory ${state.memory}/${state.totalMemory}`, 220, 58);
  ctx.fillStyle = palette.gold;
  ctx.fillText(state.bossReward ? "Brass Key" : "No Key", 220, 82);

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
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.94)";
  ctx.fillRect(-box.h / 2, -box.w / 2, box.h, box.w);
  ctx.restore();
}

function centerBoxBounds() {
  return { x: W / 2 - 180, y: H / 2 - 340, w: 360, h: 680 };
}

function drawWinScreen() {
  ctx.fillStyle = "rgba(2, 2, 7, 0.88)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.gold;
  ctx.font = "44px monospace";
  ctx.fillText("YOU FOUND THE WAY OUT", 330, 300);
  ctx.fillStyle = palette.mist;
  ctx.font = "22px monospace";
  ctx.fillText("Placeholder ending screen. Replace this later with your final scene.", 282, 356);
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
  ctx.fillText("Run, jump, wall jump, dash. Press E or Down near signs and locked gates.", 260, 360);
  ctx.fillText("Collect memories. Find lamps. Break the ringmaster mask.", 350, 398);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

say("Find the memory shards. The ticket gate listens.", 4);
requestAnimationFrame(loop);
