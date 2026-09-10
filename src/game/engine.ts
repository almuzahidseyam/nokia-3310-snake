export type Dir = 'up' | 'down' | 'left' | 'right';
export type Vec = { x: number; y: number };

export const COLS = 20;
export const ROWS = 20;

// Nokia LCD palette
export const LCD_BG = '#9bbc0f';
export const LCD_BG_LIGHT = '#a7c93a';
export const LCD_GRID = 'rgba(15,56,15,0.06)';
export const LCD_DARK = '#0f380f';
export const LCD_MID = '#306230';
export const LCD_FOOD = '#0f380f';

const DIRS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string;
}

interface FloatText { x: number; y: number; text: string; life: number; }

export interface EngineCallbacks {
  onScore: (score: number, combo: number) => void;
  onGameOver: (score: number) => void;
}

export class SnakeEngine {
  snake: Vec[] = [];
  prevSnake: Vec[] = [];
  dir: Dir = 'right';
  queue: Dir[] = [];
  food: Vec = { x: 10, y: 10 };
  bonus: { pos: Vec; ttl: number; max: number } | null = null;
  score = 0;
  combo = 0;
  lastEatTime = 0;
  running = false;
  paused = false;
  dead = false;
  tickMs = 150;
  acc = 0;
  lastTs = 0;
  particles: Particle[] = [];
  floats: FloatText[] = [];
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  flash = 0;
  foodPulse = 0;
  eatenSinceBonus = 0;
  deathT = 0;
  cb: EngineCallbacks;
  raf = 0;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cell = 20;
  audio: AudioContext | null = null;
  muted = false;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.reset();
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() { cancelAnimationFrame(this.raf); }

  resize() {
    const size = Math.min(this.canvas.parentElement?.clientWidth ?? 400, this.canvas.parentElement?.clientHeight ?? 400);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cell = size / COLS;
  }

  reset() {
    const cy = Math.floor(ROWS / 2);
    this.snake = [{ x: 5, y: cy }, { x: 4, y: cy }, { x: 3, y: cy }];
    this.prevSnake = this.snake.map(s => ({ ...s }));
    this.dir = 'right';
    this.queue = [];
    this.score = 0;
    this.combo = 0;
    this.tickMs = 150;
    this.acc = 0;
    this.dead = false;
    this.paused = false;
    this.bonus = null;
    this.eatenSinceBonus = 0;
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this.flash = 0;
    this.deathT = 0;
    this.spawnFood();
  }

  start() {
    this.reset();
    this.running = true;
    this.lastTs = performance.now();
    this.ensureAudio();
  }

  ensureAudio() {
    if (!this.audio) {
      try { this.audio = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* no audio */ }
    }
    if (this.audio?.state === 'suspended') this.audio.resume();
  }

  beep(freq: number, dur = 0.06, type: OscillatorType = 'square', vol = 0.06) {
    if (!this.audio || this.muted) return;
    const o = this.audio.createOscillator();
    const g = this.audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.audio.currentTime + dur);
    o.connect(g).connect(this.audio.destination);
    o.start();
    o.stop(this.audio.currentTime + dur);
  }

  setDir(d: Dir) {
    if (!this.running || this.dead) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d === last || d === OPPOSITE[last]) return;
    if (this.queue.length < 2) this.queue.push(d);
  }

  togglePause() {
    if (!this.running || this.dead) return;
    this.paused = !this.paused;
    this.beep(this.paused ? 330 : 440, 0.05);
  }

  spawnFood() {
    const free: Vec[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!this.snake.some(s => s.x === x && s.y === y) && !(this.bonus && this.bonus.pos.x === x && this.bonus.pos.y === y)) free.push({ x, y });
    }
    this.food = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
  }

  spawnBonus() {
    const free: Vec[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!this.snake.some(s => s.x === x && s.y === y) && !(this.food.x === x && this.food.y === y)) free.push({ x, y });
    }
    const pos = free[Math.floor(Math.random() * free.length)];
    if (pos) this.bonus = { pos, ttl: 40, max: 40 };
  }

  burst(cx: number, cy: number, n: number, color: string, speed = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.5 + Math.random()) * speed * this.cell * 0.25;
      this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, maxLife: 0.4 + Math.random() * 0.4, size: this.cell * (0.15 + Math.random() * 0.25), color });
    }
  }

  step() {
    if (this.queue.length) this.dir = this.queue.shift()!;
    const v = DIRS[this.dir];
    const head = this.snake[0];
    const nh = { x: head.x + v.x, y: head.y + v.y };

    this.prevSnake = this.snake.map(s => ({ ...s }));

    const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS;
    const willGrow = nh.x === this.food.x && nh.y === this.food.y;
    const body = willGrow ? this.snake : this.snake.slice(0, -1);
    const hitSelf = body.some(s => s.x === nh.x && s.y === nh.y);

    if (hitWall || hitSelf) { this.die(); return; }

    this.snake.unshift(nh);
    const now = performance.now();

    if (willGrow) {
      this.combo = now - this.lastEatTime < 2500 ? this.combo + 1 : 1;
      this.lastEatTime = now;
      const pts = 10 * Math.min(this.combo, 5);
      this.score += pts;
      this.eatenSinceBonus++;
      this.tickMs = Math.max(65, 150 - this.snake.length * 2.2);
      const px = (nh.x + 0.5) * this.cell, py = (nh.y + 0.5) * this.cell;
      this.burst(px, py, 14, LCD_DARK, 1);
      this.floats.push({ x: px, y: py, text: `+${pts}${this.combo > 1 ? ` x${this.combo}` : ''}`, life: 1 });
      this.shake = Math.min(6, 2 + this.combo);
      this.flash = 0.35;
      this.beep(520 + this.combo * 60, 0.07);
      setTimeout(() => this.beep(780 + this.combo * 60, 0.08), 60);
      this.spawnFood();
      if (this.eatenSinceBonus >= 5 && !this.bonus) { this.eatenSinceBonus = 0; this.spawnBonus(); }
      this.cb.onScore(this.score, this.combo);
    } else {
      this.snake.pop();
    }

    if (this.bonus) {
      if (nh.x === this.bonus.pos.x && nh.y === this.bonus.pos.y) {
        const pts = 50 + Math.round((this.bonus.ttl / this.bonus.max) * 50);
        this.score += pts;
        const px = (nh.x + 0.5) * this.cell, py = (nh.y + 0.5) * this.cell;
        this.burst(px, py, 40, LCD_DARK, 1.8);
        this.floats.push({ x: px, y: py, text: `BONUS +${pts}`, life: 1.4 });
        this.shake = 10;
        this.flash = 0.6;
        [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => this.beep(f, 0.1), i * 50));
        this.bonus = null;
        this.cb.onScore(this.score, this.combo);
      } else {
        this.bonus.ttl--;
        if (this.bonus.ttl <= 0) this.bonus = null;
      }
    }
  }

  die() {
    this.dead = true;
    this.shake = 14;
    this.flash = 0.8;
    this.deathT = 0;
    const h = this.snake[0];
    this.burst((h.x + 0.5) * this.cell, (h.y + 0.5) * this.cell, 30, LCD_DARK, 2);
    [300, 250, 200, 120].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sawtooth', 0.08), i * 90));
    if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
    setTimeout(() => { this.running = false; this.cb.onGameOver(this.score); }, 900);
  }

  loop(ts: number) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0);
    this.lastTs = ts;
    this.foodPulse += dt;

    if (this.running && !this.paused && !this.dead) {
      this.acc += dt * 1000;
      while (this.acc >= this.tickMs) { this.acc -= this.tickMs; this.step(); if (this.dead) break; }
    }
    if (this.dead) this.deathT += dt;

    // FX updates
    for (const p of this.particles) { p.x += p.vx * dt * 6; p.y += p.vy * dt * 6; p.vy += this.cell * 0.4 * dt; p.life -= dt / p.maxLife; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floats) { f.y -= this.cell * 1.5 * dt; f.life -= dt; }
    this.floats = this.floats.filter(f => f.life > 0);
    if (this.shake > 0) { this.shake *= Math.pow(0.02, dt); if (this.shake < 0.1) this.shake = 0; }
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
    this.flash = Math.max(0, this.flash - dt * 2);

    this.draw();
  }

  roundRect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  draw() {
    const c = this.ctx, cell = this.cell, W = cell * COLS, H = cell * ROWS;
    c.save();
    c.translate(this.shakeX, this.shakeY);

    // Background
    c.fillStyle = LCD_BG;
    c.fillRect(-20, -20, W + 40, H + 40);
    // Grid pixels
    c.fillStyle = LCD_GRID;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      c.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }

    const t = this.paused ? 0 : Math.min(1, this.acc / this.tickMs);
    const lerp = (a: number, b: number) => a + (b - a) * t;

    // Food (pulsing)
    const pulse = 1 + Math.sin(this.foodPulse * 8) * 0.12;
    const fs = cell * 0.7 * pulse;
    c.fillStyle = LCD_FOOD;
    this.roundRect((this.food.x + 0.5) * cell - fs / 2, (this.food.y + 0.5) * cell - fs / 2, fs, fs, fs * 0.25);
    c.fill();
    // apple stem
    c.fillRect((this.food.x + 0.5) * cell - cell * 0.06, (this.food.y + 0.5) * cell - fs / 2 - cell * 0.15, cell * 0.12, cell * 0.18);

    // Bonus
    if (this.bonus) {
      const b = this.bonus;
      const blink = b.ttl < 10 && Math.floor(this.foodPulse * 10) % 2 === 0;
      if (!blink) {
        const cx = (b.pos.x + 0.5) * cell, cy = (b.pos.y + 0.5) * cell;
        const r = cell * 0.42;
        const rot = this.foodPulse * 3;
        c.save();
        c.translate(cx, cy);
        c.rotate(rot);
        c.fillStyle = LCD_DARK;
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const rr = i % 2 ? r * 0.45 : r;
          const a = (i / 8) * Math.PI * 2;
          c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
        c.fill();
        c.restore();
        // ttl ring
        c.strokeStyle = LCD_MID;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, cell * 0.55, -Math.PI / 2, -Math.PI / 2 + (b.ttl / b.max) * Math.PI * 2);
        c.stroke();
      }
    }

    // Snake — smooth interpolated segments
    const n = this.snake.length;
    const deadFade = this.dead ? Math.max(0, 1 - this.deathT * 1.2) : 1;
    const blinkOff = this.dead && Math.floor(this.deathT * 12) % 2 === 1;
    if (!blinkOff) {
      c.globalAlpha = deadFade;
      for (let i = n - 1; i >= 0; i--) {
        const cur = this.snake[i];
        const prev = this.prevSnake[i] ?? this.prevSnake[this.prevSnake.length - 1] ?? cur;
        let px = prev.x, py = prev.y;
        // Don't lerp across large jumps
        if (Math.abs(cur.x - px) > 1 || Math.abs(cur.y - py) > 1) { px = cur.x; py = cur.y; }
        const x = lerp(px, cur.x) * cell, y = lerp(py, cur.y) * cell;
        const shrink = i === 0 ? 0.06 : 0.12 + (i / n) * 0.1;
        const s = cell * (1 - shrink * 2);
        c.fillStyle = i === 0 ? LCD_DARK : (i % 2 === 0 ? LCD_DARK : LCD_MID);
        this.roundRect(x + cell * shrink, y + cell * shrink, s, s, i === 0 ? cell * 0.3 : cell * 0.2);
        c.fill();
        if (i === 0) {
          // eyes
          c.fillStyle = LCD_BG;
          const v = DIRS[this.dir];
          const ex = x + cell / 2 + v.x * cell * 0.18, ey = y + cell / 2 + v.y * cell * 0.18;
          const ox = v.y * cell * 0.18, oy = v.x * cell * 0.18;
          const er = cell * 0.09;
          c.beginPath(); c.arc(ex + ox, ey + oy, er, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(ex - ox, ey - oy, er, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
    }

    // Particles
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    c.globalAlpha = 1;

    // Float texts
    c.font = `bold ${Math.round(cell * 0.7)}px "Press Start 2P", monospace`;
    c.textAlign = 'center';
    for (const f of this.floats) {
      c.globalAlpha = Math.min(1, f.life);
      c.fillStyle = LCD_DARK;
      c.fillText(f.text, Math.min(W - cell * 2, Math.max(cell * 2, f.x)), f.y);
    }
    c.globalAlpha = 1;

    // Flash overlay
    if (this.flash > 0) {
      c.fillStyle = `rgba(15,56,15,${this.flash * 0.25})`;
      c.fillRect(-20, -20, W + 40, H + 40);
    }
    c.restore();
  }
}
