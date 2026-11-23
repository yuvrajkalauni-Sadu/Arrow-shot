import { SoundEngine } from './audio';
import {
  Afterimage,
  Drifter,
  FloatingText,
  GameState,
  HudSnapshot,
  Lancer,
  Particle,
  PulseNode,
  Shard,
  ShieldOrb,
  Star,
} from './types';

const BEST_SCORE_KEY = 'comet_dash_best_score';
const MAX_PARTICLES = 180;
const MAX_TEXTS = 32;
const MAX_AFTERIMAGES = 24;
const MAX_SHARDS = 16;
const MAX_DRIFTERS = 18;
const MAX_LANCERS = 8;
const MAX_PULSES = 6;
const MAX_SHIELD_ORBS = 2;

export class CometEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sound: SoundEngine;
  private onStateChange: (state: GameState) => void;
  private onHudUpdate: (hud: HudSnapshot) => void;

  private width = 1280;
  private height = 720;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private resizeObserver: ResizeObserver | null = null;

  private gameState: GameState = 'TITLE_MENU';

  // Input state
  private heldKeys = new Set<string>();
  private dashBufferTimer = 0;
  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;

  // Player state
  private player = {
    x: 640,
    y: 360,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 13,
    scaleX: 1,
    scaleY: 1,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    invulnTimer: 0,
    hitFlashTimer: 0,
    shields: 3,
    maxShields: 3,
    trail: [] as { x: number; y: number }[],
  };

  // Run stats & difficulty
  private score = 0;
  private bestScore = 0;
  private combo = 1;
  private comboTimer = 0;
  private readonly comboMaxDuration = 3.2;
  private wave = 1;
  private elapsedRunTime = 0;
  private shardsCollected = 0;
  private grazes = 0;
  private waveBannerText: string | null = null;
  private waveBannerTimer = 0;

  // Spawn timers
  private shardSpawnTimer = 0.6;
  private drifterSpawnTimer = 1.2;
  private lancerSpawnTimer = 5.0;
  private pulseSpawnTimer = 8.0;
  private shieldOrbSpawnTimer = 16.0;

  // Juice & Camera
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private shakeX = 0;
  private shakeY = 0;
  private screenFlashAlpha = 0;
  private screenFlashColor = '#FFFFFF';
  private afterimageSpawnTimer = 0;

  // HUD throttle
  private hudSyncTimer = 0;
  private lastHudSignature = '';

  // World background & pools
  private stars: Star[] = [];
  private shards: Shard[] = [];
  private shieldOrbs: ShieldOrb[] = [];
  private drifters: Drifter[] = [];
  private lancers: Lancer[] = [];
  private pulses: PulseNode[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private afterimages: Afterimage[] = [];

  // Title autopilot timer
  private ambientTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    sound: SoundEngine,
    onStateChange: (state: GameState) => void,
    onHudUpdate: (hud: HudSnapshot) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.sound = sound;
    this.onStateChange = onStateChange;
    this.onHudUpdate = onHudUpdate;

    try {
      const saved = localStorage.getItem(BEST_SCORE_KEY);
      if (saved) this.bestScore = parseInt(saved, 10) || 0;
    } catch {
      this.bestScore = 0;
    }

    this.initPools();
    this.handleResize();
    this.initStars();
    this.seedTitleWorld();
    this.bindEvents();
    this.emitHud(true);
  }

  private initPools(): void {
    this.shards = Array.from({ length: MAX_SHARDS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 12,
      angle: 0,
      bobPhase: 0,
      life: 0,
      maxLife: 12,
      value: 25,
    }));

    this.shieldOrbs = Array.from({ length: MAX_SHIELD_ORBS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 13,
      phase: 0,
      life: 0,
    }));

    this.drifters = Array.from({ length: MAX_DRIFTERS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 16,
      angle: 0,
      spin: 1,
      grazed: false,
      hitFlash: 0,
    }));

    this.lancers = Array.from({ length: MAX_LANCERS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 14,
      angle: 0,
      phase: 'ENTERING',
      phaseTimer: 0,
      aimDirX: 1,
      aimDirY: 0,
      grazed: false,
    }));

    this.pulses = Array.from({ length: MAX_PULSES }, () => ({
      active: false,
      x: 0,
      y: 0,
      phase: 'CHARGING',
      timer: 0,
      chargeDuration: 1.15,
      currentRadius: 0,
      maxRadius: 190,
      ringWidth: 10,
      grazed: false,
    }));

    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      life: 0,
      maxLife: 0.5,
      color: '#F59E0B',
      drag: 0.94,
      shape: 'circle',
      angle: 0,
    }));

    this.floatingTexts = Array.from({ length: MAX_TEXTS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -42,
      text: '',
      color: '#F8FAFC',
      life: 0,
      maxLife: 0.85,
      scale: 1,
    }));

    this.afterimages = Array.from({ length: MAX_AFTERIMAGES }, () => ({
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      alpha: 0,
      scaleX: 1,
      scaleY: 1,
    }));
  }

  private initStars(): void {
    this.stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      z: 0.2 + Math.random() * 0.8,
      size: 0.8 + Math.random() * 1.9,
      alpha: 0.25 + Math.random() * 0.65,
      twinklePhase: Math.random() * Math.PI * 2,
    }));
  }

  private seedTitleWorld(): void {
    this.clearPools();
    this.player.x = this.width * 0.68;
    this.player.y = this.height * 0.48;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.angle = -0.35;
    this.player.trail = [];
    for (let i = 0; i < 6; i++) {
      this.spawnShard(
        this.width * (0.45 + Math.random() * 0.48),
        this.height * (0.15 + Math.random() * 0.7)
      );
    }
  }

  private clearPools(): void {
    this.shards.forEach((s) => (s.active = false));
    this.shieldOrbs.forEach((o) => (o.active = false));
    this.drifters.forEach((d) => (d.active = false));
    this.lancers.forEach((l) => (l.active = false));
    this.pulses.forEach((p) => (p.active = false));
    this.particles.forEach((p) => (p.active = false));
    this.floatingTexts.forEach((t) => (t.active = false));
    this.afterimages.forEach((a) => (a.active = false));
  }

  private handleResize = (): void => {
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const newW = Math.max(320, Math.floor(rect.width));
    const newH = Math.max(240, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = newW;
    this.height = newH;
    this.canvas.width = Math.floor(newW * this.dpr);
    this.canvas.height = Math.floor(newH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Keep player inside bounds after resize
    this.player.x = Math.max(24, Math.min(this.width - 24, this.player.x));
    this.player.y = Math.max(24, Math.min(this.height - 24, this.player.y));

    if (this.stars.length === 0) {
      this.initStars();
    } else {
      for (const s of this.stars) {
        if (s.x > this.width) s.x = Math.random() * this.width;
        if (s.y > this.height) s.y = Math.random() * this.height;
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'Space'
    ) {
      if (this.gameState === 'PLAYING') {
        e.preventDefault();
      }
    }

    this.heldKeys.add(e.code);

    if ((e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      if (this.gameState === 'PLAYING') {
        this.sound.unlock();
        this.dashBufferTimer = 0.14;
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onBlur = (): void => {
    this.heldKeys.clear();
    this.pointerActive = false;
    if (this.gameState === 'PLAYING') {
      this.pauseGame();
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.gameState !== 'PLAYING') return;
    this.sound.unlock();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointerX = x;
    this.pointerY = y;

    if (e.pointerType === 'touch') {
      this.pointerActive = true;
    } else {
      // Desktop click triggers dash toward cursor
      const dx = x - this.player.x;
      const dy = y - this.player.y;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        this.player.dashDirX = dx / len;
        this.player.dashDirY = dy / len;
      }
      this.dashBufferTimer = 0.14;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive || this.gameState !== 'PLAYING') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
  };

  private onPointerUp = (): void => {
    this.pointerActive = false;
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);

    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.canvas.parentElement);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this.handleResize);
    }
  }

  public start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public startGame(): void {
    this.sound.unlock();
    this.sound.playUiClick();
    this.clearPools();
    this.heldKeys.clear();

    this.player.x = this.width * 0.5;
    this.player.y = this.height * 0.55;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.angle = -Math.PI / 2;
    this.player.scaleX = 1;
    this.player.scaleY = 1;
    this.player.dashTimer = 0;
    this.player.dashCooldown = 0;
    this.player.invulnTimer = 0.8;
    this.player.hitFlashTimer = 0;
    this.player.shields = 3;
    this.player.trail = [];

    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.wave = 1;
    this.elapsedRunTime = 0;
    this.shardsCollected = 0;
    this.grazes = 0;
    this.waveBannerText = 'Sector 1';
    this.waveBannerTimer = 2.0;

    this.shardSpawnTimer = 0.2;
    this.drifterSpawnTimer = 1.0;
    this.lancerSpawnTimer = 4.5;
    this.pulseSpawnTimer = 7.5;
    this.shieldOrbSpawnTimer = 18.0;

    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.screenFlashAlpha = 0;
    this.dashBufferTimer = 0;

    // Seed initial shards so action begins immediately
    for (let i = 0; i < 4; i++) {
      this.spawnShard();
    }

    this.setGameState('PLAYING');
    this.emitHud(true);
  }

  public pauseGame(): void {
    if (this.gameState !== 'PLAYING') return;
    this.heldKeys.clear();
    this.pointerActive = false;
    this.sound.playUiClick();
    this.setGameState('PAUSED');
  }

  public resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    this.sound.unlock();
    this.sound.playUiClick();
    this.lastTime = performance.now();
    this.setGameState('PLAYING');
  }

  public quitToTitle(): void {
    this.sound.playUiClick();
    this.heldKeys.clear();
    this.pointerActive = false;
    this.seedTitleWorld();
    this.setGameState('TITLE_MENU');
    this.emitHud(true);
  }

  public triggerTouchDash(): void {
    if (this.gameState !== 'PLAYING') return;
    this.sound.unlock();
    this.dashBufferTimer = 0.14;
  }

  private setGameState(next: GameState): void {
    this.gameState = next;
    this.onStateChange(next);
  }

  private emitHud(force = false): void {
    const comboRatio = this.combo > 1 ? Math.max(0, Math.min(1, this.comboTimer / this.comboMaxDuration)) : 0;
    const dashCharge = Math.max(0, Math.min(1, 1 - this.player.dashCooldown / 0.85));
    const roundedScore = Math.floor(this.score);
    const sig = `${roundedScore}|${this.bestScore}|${this.combo}|${Math.round(comboRatio * 20)}|${this.wave}|${this.player.shields}|${Math.round(dashCharge * 20)}|${this.waveBannerText ?? ''}`;

    if (!force && sig === this.lastHudSignature) return;
    this.lastHudSignature = sig;

    this.onHudUpdate({
      score: roundedScore,
      bestScore: this.bestScore,
      combo: this.combo,
      comboTimerRatio: comboRatio,
      wave: this.wave,
      shields: this.player.shields,
      maxShields: this.player.maxShields,
      dashCharge,
      shardsCollected: this.shardsCollected,
      grazes: this.grazes,
      waveBannerText: this.waveBannerText,
    });
  }

  // ==================== UPDATE LOOP ====================

  private update(dt: number): void {
    this.ambientTime += dt;

    // Camera shake & flash always decay smoothly even during hitstop
    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= Math.pow(0.0005, dt);
      const angle = Math.random() * Math.PI * 2;
      this.shakeX = Math.cos(angle) * this.shakeIntensity;
      this.shakeY = Math.sin(angle) * this.shakeIntensity;
    } else {
      this.shakeIntensity = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }

    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 3.8);
    }

    if (this.gameState === 'PAUSED') {
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.gameState === 'TITLE_MENU') {
      this.updateTitleAutopilot(dt);
      this.updateStars(dt, 28);
      this.updateShards(dt, false);
      this.updateParticles(dt);
      return;
    }

    if (this.gameState === 'GAME_OVER') {
      this.updateStars(dt, 14);
      this.updateParticles(dt);
      this.updateFloatingTexts(dt);
      this.updateAfterimages(dt);
      return;
    }

    // Active PLAYING simulation
    this.elapsedRunTime += dt;
    this.score += dt * (8 + this.wave * 2);

    // Wave progression every 16 seconds
    const targetWave = 1 + Math.floor(this.elapsedRunTime / 16);
    if (targetWave > this.wave) {
      this.wave = targetWave;
      this.waveBannerText = `Sector ${this.wave}`;
      this.waveBannerTimer = 2.2;
      this.sound.playWaveUp();
      this.spawnBurst(this.player.x, this.player.y, '#38BDF8', 16, 180);
    }

    if (this.waveBannerTimer > 0) {
      this.waveBannerTimer -= dt;
      if (this.waveBannerTimer <= 0) {
        this.waveBannerText = null;
      }
    }

    // Combo decay
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }

    this.updateStars(dt, 42 + this.wave * 6);
    this.updatePlayer(dt);
    this.updateSpawners(dt);
    this.updateShards(dt, true);
    this.updateShieldOrbs(dt);
    this.updateDrifters(dt);
    this.updateLancers(dt);
    this.updatePulses(dt);
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateAfterimages(dt);

    if (this.score > this.bestScore) {
      this.bestScore = Math.floor(this.score);
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.05) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updateTitleAutopilot(dt: number): void {
    // Graceful figure-8 / orbital sweep on the right side of the canvas
    const centerX = this.width * 0.7;
    const centerY = this.height * 0.5;
    const radiusX = Math.min(200, this.width * 0.18);
    const radiusY = Math.min(130, this.height * 0.22);

    const targetX = centerX + Math.cos(this.ambientTime * 0.75) * radiusX;
    const targetY = centerY + Math.sin(this.ambientTime * 1.5) * radiusY;

    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;
    this.player.vx = dx * 3.5;
    this.player.vy = dy * 3.5;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    if (Math.hypot(this.player.vx, this.player.vy) > 5) {
      const targetAngle = Math.atan2(this.player.vy, this.player.vx);
      this.player.angle = this.lerpAngle(this.player.angle, targetAngle, dt * 10);
    }

    this.recordTrail();

    // Gentle thruster particle
    if (Math.random() < 0.35) {
      const backX = this.player.x - Math.cos(this.player.angle) * 14;
      const backY = this.player.y - Math.sin(this.player.angle) * 14;
      this.spawnParticle(backX, backY, -this.player.vx * 0.25, -this.player.vy * 0.25, '#38BDF8', 2.4, 0.35, 'circle');
    }

    this.shardSpawnTimer -= dt;
    if (this.shardSpawnTimer <= 0) {
      this.shardSpawnTimer = 2.0;
      this.spawnShard(
        this.width * (0.42 + Math.random() * 0.52),
        this.height * (0.12 + Math.random() * 0.76)
      );
    }
  }

  private updateStars(dt: number, baseSpeed: number): void {
    for (const s of this.stars) {
      s.y += baseSpeed * s.z * dt;
      s.twinklePhase += dt * (1.5 + s.z * 2);
      if (s.y > this.height + 4) {
        s.y = -4;
        s.x = Math.random() * this.width;
      }
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;

    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (this.dashBufferTimer > 0) this.dashBufferTimer = Math.max(0, this.dashBufferTimer - dt);

    // Elastic recovery of squash-and-stretch
    p.scaleX += (1 - p.scaleX) * Math.min(1, dt * 14);
    p.scaleY += (1 - p.scaleY) * Math.min(1, dt * 14);

    // Movement input vector
    let inputX = 0;
    let inputY = 0;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) inputX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) inputX += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) inputY -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) inputY += 1;

    if (inputX === 0 && inputY === 0 && this.pointerActive) {
      const dx = this.pointerX - p.x;
      const dy = this.pointerY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        inputX = dx / dist;
        inputY = dy / dist;
      }
    }

    const inputLen = Math.hypot(inputX, inputY);
    if (inputLen > 0) {
      inputX /= inputLen;
      inputY /= inputLen;
      p.dashDirX = inputX;
      p.dashDirY = inputY;
    }

    // Trigger buffered Dash if ready
    if (this.dashBufferTimer > 0 && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      this.dashBufferTimer = 0;
      p.dashTimer = 0.18;
      p.dashCooldown = 0.85;
      p.invulnTimer = Math.max(p.invulnTimer, 0.22);
      p.scaleX = 1.45;
      p.scaleY = 0.68;

      if (inputLen > 0) {
        p.dashDirX = inputX;
        p.dashDirY = inputY;
      } else if (Math.hypot(p.vx, p.vy) > 20) {
        const vLen = Math.hypot(p.vx, p.vy);
        p.dashDirX = p.vx / vLen;
        p.dashDirY = p.vy / vLen;
      } else {
        p.dashDirX = Math.cos(p.angle);
        p.dashDirY = Math.sin(p.angle);
      }

      p.vx = p.dashDirX * 860;
      p.vy = p.dashDirY * 860;
      p.angle = Math.atan2(p.dashDirY, p.dashDirX);

      this.sound.playDash();
      this.shakeIntensity = Math.max(this.shakeIntensity, 4.5);
      this.spawnBurst(p.x, p.y, '#38BDF8', 12, 220);
      this.emitHud(true);
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      this.afterimageSpawnTimer -= dt;
      if (this.afterimageSpawnTimer <= 0) {
        this.afterimageSpawnTimer = 0.028;
        this.spawnAfterimage(p.x, p.y, p.angle, p.scaleX, p.scaleY);
      }
    } else {
      const moveSpeed = 350;
      const accel = 16;
      const friction = 10;

      if (inputLen > 0) {
        p.vx += (inputX * moveSpeed - p.vx) * Math.min(1, accel * dt);
        p.vy += (inputY * moveSpeed - p.vy) * Math.min(1, accel * dt);
      } else {
        p.vx += (0 - p.vx) * Math.min(1, friction * dt);
        p.vy += (0 - p.vy) * Math.min(1, friction * dt);
      }

      if (Math.hypot(p.vx, p.vy) > 25) {
        const targetAngle = Math.atan2(p.vy, p.vx);
        p.angle = this.lerpAngle(p.angle, targetAngle, dt * 15);
      }

      // Subtle thruster spark when moving
      if (inputLen > 0 && Math.random() < 0.45) {
        const backX = p.x - Math.cos(p.angle) * 14;
        const backY = p.y - Math.sin(p.angle) * 14;
        this.spawnParticle(
          backX + (Math.random() - 0.5) * 4,
          backY + (Math.random() - 0.5) * 4,
          -Math.cos(p.angle) * 90 + (Math.random() - 0.5) * 35,
          -Math.sin(p.angle) * 90 + (Math.random() - 0.5) * 35,
          '#38BDF8',
          2.2,
          0.26,
          'circle'
        );
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Arena clamping with soft bounce
    const margin = 20;
    if (p.x < margin) {
      p.x = margin;
      p.vx = Math.abs(p.vx) * 0.35;
    } else if (p.x > this.width - margin) {
      p.x = this.width - margin;
      p.vx = -Math.abs(p.vx) * 0.35;
    }
    if (p.y < margin) {
      p.y = margin;
      p.vy = Math.abs(p.vy) * 0.35;
    } else if (p.y > this.height - margin) {
      p.y = this.height - margin;
      p.vy = -Math.abs(p.vy) * 0.35;
    }

    this.recordTrail();
  }

  private recordTrail(): void {
    this.player.trail.push({ x: this.player.x, y: this.player.y });
    if (this.player.trail.length > 16) {
      this.player.trail.shift();
    }
  }

  private updateSpawners(dt: number): void {
    // Solar shards
    this.shardSpawnTimer -= dt;
    if (this.shardSpawnTimer <= 0) {
      this.shardSpawnTimer = Math.max(0.85, 1.8 - this.wave * 0.08);
      this.spawnShard();
    }

    // Drifter mines
    this.drifterSpawnTimer -= dt;
    if (this.drifterSpawnTimer <= 0) {
      this.drifterSpawnTimer = Math.max(0.55, 1.7 - this.wave * 0.11);
      this.spawnDrifter();
    }

    // Lancer comets (Wave 2+)
    if (this.wave >= 2) {
      this.lancerSpawnTimer -= dt;
      if (this.lancerSpawnTimer <= 0) {
        this.lancerSpawnTimer = Math.max(2.2, 5.2 - this.wave * 0.35);
        this.spawnLancer();
      }
    }

    // Pulse nodes (Wave 3+)
    if (this.wave >= 3) {
      this.pulseSpawnTimer -= dt;
      if (this.pulseSpawnTimer <= 0) {
        this.pulseSpawnTimer = Math.max(3.6, 7.2 - this.wave * 0.35);
        this.spawnPulseNode();
      }
    }

    // Shield restoration orbs (when below max shields)
    if (this.player.shields < this.player.maxShields) {
      this.shieldOrbSpawnTimer -= dt;
      if (this.shieldOrbSpawnTimer <= 0) {
        this.shieldOrbSpawnTimer = 16.0;
        this.spawnShieldOrb();
      }
    }
  }

  private spawnShard(customX?: number, customY?: number): void {
    const slot = this.shards.find((s) => !s.active);
    if (!slot) return;

    const pad = 64;
    slot.active = true;
    slot.x = customX ?? pad + Math.random() * Math.max(40, this.width - pad * 2);
    slot.y = customY ?? pad + Math.random() * Math.max(40, this.height - pad * 2);
    slot.vx = (Math.random() - 0.5) * 26;
    slot.vy = (Math.random() - 0.5) * 26;
    slot.radius = 12;
    slot.angle = Math.random() * Math.PI * 2;
    slot.bobPhase = Math.random() * Math.PI * 2;
    slot.life = 13;
    slot.maxLife = 13;
    slot.value = 50;
  }

  private spawnShieldOrb(): void {
    const slot = this.shieldOrbs.find((o) => !o.active);
    if (!slot) return;
    const pad = 80;
    slot.active = true;
    slot.x = pad + Math.random() * Math.max(40, this.width - pad * 2);
    slot.y = pad + Math.random() * Math.max(40, this.height - pad * 2);
    slot.vx = (Math.random() - 0.5) * 20;
    slot.vy = (Math.random() - 0.5) * 20;
    slot.radius = 14;
    slot.phase = 0;
    slot.life = 12;
  }

  private spawnDrifter(): void {
    const slot = this.drifters.find((d) => !d.active);
    if (!slot) return;

    const edge = Math.floor(Math.random() * 4);
    const speed = 105 + this.wave * 14 + Math.random() * 55;
    let x = 0;
    let y = 0;
    let targetX = this.width * (0.2 + Math.random() * 0.6);
    let targetY = this.height * (0.2 + Math.random() * 0.6);

    if (edge === 0) {
      x = Math.random() * this.width;
      y = -32;
    } else if (edge === 1) {
      x = this.width + 32;
      y = Math.random() * this.height;
    } else if (edge === 2) {
      x = Math.random() * this.width;
      y = this.height + 32;
    } else {
      x = -32;
      y = Math.random() * this.height;
    }

    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.hypot(dx, dy) || 1;

    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = (dx / len) * speed;
    slot.vy = (dy / len) * speed;
    slot.radius = 14 + Math.random() * 5;
    slot.angle = Math.random() * Math.PI * 2;
    slot.spin = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 1.4);
    slot.grazed = false;
    slot.hitFlash = 0;
  }

  private spawnLancer(): void {
    const slot = this.lancers.find((l) => !l.active);
    if (!slot) return;

    const fromLeft = Math.random() < 0.5;
    slot.active = true;
    slot.x = fromLeft ? -28 : this.width + 28;
    slot.y = 70 + Math.random() * Math.max(60, this.height - 140);
    slot.vx = fromLeft ? 150 : -150;
    slot.vy = 0;
    slot.radius = 14;
    slot.phase = 'ENTERING';
    slot.phaseTimer = 0.5;
    slot.aimDirX = fromLeft ? 1 : -1;
    slot.aimDirY = 0;
    slot.angle = Math.atan2(slot.aimDirY, slot.aimDirX);
    slot.grazed = false;
  }

  private spawnPulseNode(): void {
    const slot = this.pulses.find((p) => !p.active);
    if (!slot) return;

    // Spawn away from immediate player position for fairness
    let x = 100 + Math.random() * Math.max(80, this.width - 200);
    let y = 100 + Math.random() * Math.max(80, this.height - 200);
    const dist = Math.hypot(x - this.player.x, y - this.player.y);
    if (dist < 130) {
      x = this.player.x < this.width * 0.5 ? this.width * 0.75 : this.width * 0.25;
      y = this.player.y < this.height * 0.5 ? this.height * 0.72 : this.height * 0.28;
    }

    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.phase = 'CHARGING';
    slot.chargeDuration = Math.max(0.85, 1.2 - this.wave * 0.03);
    slot.timer = slot.chargeDuration;
    slot.currentRadius = 12;
    slot.maxRadius = 195 + Math.min(60, this.wave * 6);
    slot.ringWidth = 10;
    slot.grazed = false;
  }

  private updateShards(dt: number, collectEnabled: boolean): void {
    const p = this.player;
    const isDashing = p.dashTimer > 0;
    const magnetRange = isDashing ? 165 : 72;

    for (const s of this.shards) {
      if (!s.active) continue;
      s.angle += dt * 1.9;
      s.bobPhase += dt * 3.4;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }

      if (collectEnabled) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dist = Math.hypot(dx, dy);

        if (dist < magnetRange && dist > 1) {
          const pull = isDashing ? 720 : 320;
          s.vx += (dx / dist) * pull * dt * 4;
          s.vy += (dy / dist) * pull * dt * 4;
        }

        // Collect check
        if (dist < p.radius + s.radius + (isDashing ? 12 : 4)) {
          s.active = false;
          this.shardsCollected += 1;
          this.combo = Math.min(12, this.combo + 1);
          this.comboTimer = this.comboMaxDuration;

          const dashBonus = isDashing ? 2 : 1;
          const points = s.value * this.combo * dashBonus;
          this.score += points;

          this.sound.playShardCollect(this.combo);
          this.spawnBurst(s.x, s.y, '#F59E0B', isDashing ? 18 : 11, isDashing ? 230 : 150);
          this.spawnFloatingText(
            s.x,
            s.y - 10,
            isDashing ? `+${points} DASH!` : `+${points}`,
            isDashing ? '#38BDF8' : '#FBBF24',
            isDashing ? 1.15 : 1.0
          );

          if (isDashing) {
            this.hitstopTimer = Math.max(this.hitstopTimer, 0.032);
            this.shakeIntensity = Math.max(this.shakeIntensity, 3.2);
          }

          this.emitHud(true);
          continue;
        }
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(0.45, dt);
      s.vy *= Math.pow(0.45, dt);

      if (s.x < 30 || s.x > this.width - 30) s.vx *= -1;
      if (s.y < 30 || s.y > this.height - 30) s.vy *= -1;
    }
  }

  private updateShieldOrbs(dt: number): void {
    const p = this.player;
    for (const o of this.shieldOrbs) {
      if (!o.active) continue;
      o.phase += dt * 3.5;
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.life <= 0) {
        o.active = false;
        continue;
      }

      const dist = Math.hypot(p.x - o.x, p.y - o.y);
      if (dist < p.radius + o.radius + 6) {
        o.active = false;
        if (p.shields < p.maxShields) {
          p.shields += 1;
          this.spawnFloatingText(o.x, o.y - 12, 'SHIELD +1', '#34D399', 1.1);
        } else {
          this.score += 250;
          this.spawnFloatingText(o.x, o.y - 12, '+250', '#34D399', 1.1);
        }
        this.sound.playShieldGain();
        this.spawnBurst(o.x, o.y, '#34D399', 16, 180);
        this.emitHud(true);
      }
    }
  }

  private updateDrifters(dt: number): void {
    const p = this.player;
    const isDashing = p.dashTimer > 0;

    for (const d of this.drifters) {
      if (!d.active) continue;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.angle += d.spin * dt;
      if (d.hitFlash > 0) d.hitFlash -= dt;

      // Despawn well outside bounds
      if (d.x < -80 || d.x > this.width + 80 || d.y < -80 || d.y > this.height + 80) {
        d.active = false;
        continue;
      }

      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      const hitDist = p.radius + d.radius - 3;

      if (dist < hitDist) {
        if (isDashing) {
          // Shatter drifter on dash!
          d.active = false;
          this.grazes += 1;
          const pts = 75 * this.combo;
          this.score += pts;
          this.comboTimer = Math.max(this.comboTimer, this.comboMaxDuration * 0.75);
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.045);
          this.shakeIntensity = Math.max(this.shakeIntensity, 6.5);
          this.sound.playGraze();
          this.spawnBurst(d.x, d.y, '#FB7185', 16, 240);
          this.spawnFloatingText(d.x, d.y - 12, `SHATTER +${pts}`, '#38BDF8', 1.1);
          this.emitHud(true);
        } else if (p.invulnTimer <= 0) {
          d.active = false;
          this.damagePlayer(d.x, d.y);
        }
      } else if (!d.grazed && dist < hitDist + 24 && p.invulnTimer <= 0) {
        d.grazed = true;
        this.awardGraze(d.x, d.y);
      }
    }
  }

  private updateLancers(dt: number): void {
    const p = this.player;
    const isDashing = p.dashTimer > 0;

    for (const l of this.lancers) {
      if (!l.active) continue;

      if (l.phase === 'ENTERING') {
        l.x += l.vx * dt;
        l.phaseTimer -= dt;
        // Track player smoothly during entry
        const dx = p.x - l.x;
        const dy = p.y - l.y;
        const len = Math.hypot(dx, dy) || 1;
        l.aimDirX = dx / len;
        l.aimDirY = dy / len;
        l.angle = Math.atan2(l.aimDirY, l.aimDirX);

        if (l.phaseTimer <= 0) {
          l.phase = 'AIMING';
          l.phaseTimer = 0.85;
          l.vx = 0;
          l.vy = 0;
        }
      } else if (l.phase === 'AIMING') {
        l.phaseTimer -= dt;
        // Lock aim during final 0.3s so player has fair dodge window
        if (l.phaseTimer > 0.3) {
          const dx = p.x - l.x;
          const dy = p.y - l.y;
          const len = Math.hypot(dx, dy) || 1;
          l.aimDirX = dx / len;
          l.aimDirY = dy / len;
          l.angle = Math.atan2(l.aimDirY, l.aimDirX);
        }

        if (l.phaseTimer <= 0) {
          l.phase = 'DASHING';
          const dashSpeed = 680 + this.wave * 35;
          l.vx = l.aimDirX * dashSpeed;
          l.vy = l.aimDirY * dashSpeed;
          this.spawnBurst(l.x, l.y, '#F43F5E', 10, 140);
        }
      } else {
        // DASHING
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        if (Math.random() < 0.6) {
          this.spawnParticle(l.x, l.y, -l.vx * 0.15, -l.vy * 0.15, '#F43F5E', 2.5, 0.22, 'diamond');
        }

        if (l.x < -100 || l.x > this.width + 100 || l.y < -100 || l.y > this.height + 100) {
          l.active = false;
          continue;
        }
      }

      const dist = Math.hypot(p.x - l.x, p.y - l.y);
      const hitDist = p.radius + l.radius - 2;
      if (dist < hitDist) {
        if (!isDashing && p.invulnTimer <= 0) {
          l.active = false;
          this.damagePlayer(l.x, l.y);
        }
      } else if (l.phase === 'DASHING' && !l.grazed && dist < hitDist + 26) {
        l.grazed = true;
        this.awardGraze(l.x, l.y);
      }
    }
  }

  private updatePulses(dt: number): void {
    const p = this.player;
    const isDashing = p.dashTimer > 0;

    for (const node of this.pulses) {
      if (!node.active) continue;

      if (node.phase === 'CHARGING') {
        node.timer -= dt;
        if (node.timer <= 0) {
          node.phase = 'EXPANDING';
          node.currentRadius = 16;
          this.spawnBurst(node.x, node.y, '#F43F5E', 12, 160);
        }
      } else {
        node.currentRadius += (210 + this.wave * 12) * dt;
        if (node.currentRadius >= node.maxRadius) {
          node.active = false;
          continue;
        }

        // Ring collision check
        const dist = Math.hypot(p.x - node.x, p.y - node.y);
        const ringDelta = Math.abs(dist - node.currentRadius);
        if (ringDelta < p.radius + node.ringWidth * 0.45) {
          if (isDashing) {
            if (!node.grazed) {
              node.grazed = true;
              this.awardGraze(p.x, p.y);
            }
          } else if (p.invulnTimer <= 0) {
            this.damagePlayer(node.x, node.y);
          }
        }
      }
    }
  }

  private awardGraze(x: number, y: number): void {
    this.grazes += 1;
    const pts = 40 * this.combo;
    this.score += pts;
    this.comboTimer = Math.min(this.comboMaxDuration, this.comboTimer + 0.6);
    this.sound.playGraze();
    this.spawnBurst((this.player.x + x) * 0.5, (this.player.y + y) * 0.5, '#38BDF8', 7, 130);
    this.spawnFloatingText(this.player.x, this.player.y - 20, `GRAZE +${pts}`, '#7DD3FC', 0.95);
    this.emitHud();
  }

  private damagePlayer(sourceX: number, sourceY: number): void {
    const p = this.player;
    p.shields -= 1;
    p.invulnTimer = 1.45;
    p.hitFlashTimer = 0.2;
    p.scaleX = 0.65;
    p.scaleY = 1.45;

    // Knockback away from hazard
    const dx = p.x - sourceX;
    const dy = p.y - sourceY;
    const len = Math.hypot(dx, dy) || 1;
    p.vx = (dx / len) * 380;
    p.vy = (dy / len) * 380;

    this.combo = 1;
    this.comboTimer = 0;

    this.hitstopTimer = 0.065;
    this.shakeIntensity = 12;
    this.screenFlashColor = '#F43F5E';
    this.screenFlashAlpha = 0.26;

    this.sound.playHit();
    this.spawnBurst(p.x, p.y, '#F43F5E', 24, 260);
    this.spawnFloatingText(p.x, p.y - 18, 'SHIELD HIT', '#FB7185', 1.15);

    if (p.shields <= 0) {
      this.triggerGameOver();
    } else {
      this.emitHud(true);
    }
  }

  private triggerGameOver(): void {
    const finalScore = Math.floor(this.score);
    if (finalScore > this.bestScore) {
      this.bestScore = finalScore;
    }
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
    } catch {
      // Ignore storage errors
    }

    this.heldKeys.clear();
    this.pointerActive = false;
    this.sound.playGameOver();
    this.spawnBurst(this.player.x, this.player.y, '#F59E0B', 32, 300);
    this.spawnBurst(this.player.x, this.player.y, '#F43F5E', 24, 240);
    this.setGameState('GAME_OVER');
    this.emitHud(true);
  }

  // ==================== PARTICLE & EFFECT POOLS ====================

  private spawnBurst(x: number, y: number, color: string, count: number, maxSpeed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = maxSpeed * (0.35 + Math.random() * 0.75);
      this.spawnParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        2 + Math.random() * 2.8,
        0.3 + Math.random() * 0.35,
        Math.random() < 0.5 ? 'diamond' : 'circle'
      );
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size: number,
    maxLife: number,
    shape: 'circle' | 'diamond' | 'line'
  ): void {
    const slot = this.particles.find((pt) => !pt.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = vx;
    slot.vy = vy;
    slot.color = color;
    slot.size = size;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.drag = 0.08;
    slot.shape = shape;
    slot.angle = Math.atan2(vy, vx);
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(pt.drag, dt);
      pt.vy *= Math.pow(pt.drag, dt);
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    const slot = this.floatingTexts.find((t) => !t.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vy = -48;
    slot.text = text;
    slot.color = color;
    slot.life = 0.85;
    slot.maxLife = 0.85;
    slot.scale = scale;
  }

  private updateFloatingTexts(dt: number): void {
    for (const t of this.floatingTexts) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.25, dt);
    }
  }

  private spawnAfterimage(x: number, y: number, angle: number, scaleX: number, scaleY: number): void {
    const slot = this.afterimages.find((a) => !a.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.angle = angle;
    slot.alpha = 0.55;
    slot.scaleX = scaleX;
    slot.scaleY = scaleY;
  }

  private updateAfterimages(dt: number): void {
    for (const a of this.afterimages) {
      if (!a.active) continue;
      a.alpha -= dt * 2.8;
      if (a.alpha <= 0) {
        a.active = false;
      }
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * Math.min(1, t);
  }

  // ==================== RENDERING ====================

  private render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 60% Deep twilight slate-navy sky background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#090E1A');
    bgGrad.addColorStop(0.55, '#0D1528');
    bgGrad.addColorStop(1, '#121D36');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // Subtle atmospheric horizon grid lines
    this.renderBackdropGrid(ctx, w, h);

    // Parallax stars
    this.renderStars(ctx);

    // Pulse nodes (ground layer)
    this.renderPulses(ctx);

    // Shards & shield orbs
    this.renderShards(ctx);
    this.renderShieldOrbs(ctx);

    // Hazards
    this.renderDrifters(ctx);
    this.renderLancers(ctx);

    // Afterimages & Player glider
    this.renderAfterimages(ctx);
    if (this.gameState !== 'GAME_OVER') {
      this.renderPlayer(ctx);
    }

    // Particles & Floating Texts
    this.renderParticles(ctx);
    this.renderFloatingTexts(ctx);

    ctx.restore();

    // Screen impact flash
    if (this.screenFlashAlpha > 0) {
      ctx.fillStyle = this.screenFlashColor;
      ctx.globalAlpha = this.screenFlashAlpha;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  private renderBackdropGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
    ctx.lineWidth = 1;
    const step = 72;
    const offsetY = (this.ambientTime * 18) % step;

    ctx.beginPath();
    for (let x = step; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offsetY; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const s of this.stars) {
      const twinkle = 0.72 + 0.28 * Math.sin(s.twinklePhase);
      ctx.fillStyle = s.z > 0.7 ? '#BAE6FD' : '#CBD5E1';
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderShards(ctx: CanvasRenderingContext2D): void {
    for (const s of this.shards) {
      if (!s.active) continue;
      const bobY = Math.sin(s.bobPhase) * 3.5;
      const fadeAlpha = s.life < 2 ? Math.max(0.2, s.life / 2) : 1;

      ctx.save();
      ctx.translate(s.x, s.y + bobY);
      ctx.globalAlpha = fadeAlpha;

      // Soft warm halo
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 1.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(s.angle);

      // Crisp golden diamond prism
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -s.radius);
      ctx.lineTo(s.radius * 0.72, 0);
      ctx.lineTo(0, s.radius);
      ctx.lineTo(-s.radius * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner bright core
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.moveTo(0, -s.radius * 0.42);
      ctx.lineTo(s.radius * 0.28, 0);
      ctx.lineTo(0, s.radius * 0.42);
      ctx.lineTo(-s.radius * 0.28, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private renderShieldOrbs(ctx: CanvasRenderingContext2D): void {
    for (const o of this.shieldOrbs) {
      if (!o.active) continue;
      const pulse = 1 + Math.sin(o.phase) * 0.1;

      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, o.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#34D399';
      ctx.fillStyle = '#065F46';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, o.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crisp plus emblem
      ctx.fillStyle = '#ECFDF5';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);

      ctx.restore();
    }
  }

  private renderDrifters(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drifters) {
      if (!d.active) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);

      // Subtle hazard aura
      ctx.fillStyle = 'rgba(244, 63, 94, 0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, d.radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Spiked hexagonal mine silhouette
      ctx.fillStyle = '#E11D48';
      ctx.strokeStyle = '#FDA4AF';
      ctx.lineWidth = 1.6;
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i < sides * 2; i++) {
        const r = i % 2 === 0 ? d.radius : d.radius * 0.66;
        const a = (i * Math.PI) / sides;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner dark core
      ctx.fillStyle = '#1E1B2E';
      ctx.beginPath();
      ctx.arc(0, 0, d.radius * 0.34, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderLancers(ctx: CanvasRenderingContext2D): void {
    for (const l of this.lancers) {
      if (!l.active) continue;

      // Windup laser sight telegraph during AIMING
      if (l.phase === 'AIMING') {
        const progress = 1 - Math.max(0, l.phaseTimer / 0.85);
        ctx.save();
        ctx.strokeStyle = progress > 0.65 ? 'rgba(251, 113, 133, 0.85)' : 'rgba(251, 113, 133, 0.45)';
        ctx.lineWidth = progress > 0.65 ? 2.2 : 1.4;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + l.aimDirX * 1400, l.y + l.aimDirY * 1400);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle);

      // Spearhead body
      ctx.fillStyle = l.phase === 'DASHING' ? '#FB7185' : '#F43F5E';
      ctx.strokeStyle = '#FFE4E6';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(l.radius * 1.45, 0);
      ctx.lineTo(-l.radius * 0.95, -l.radius * 0.78);
      ctx.lineTo(-l.radius * 0.48, 0);
      ctx.lineTo(-l.radius * 0.95, l.radius * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderPulses(ctx: CanvasRenderingContext2D): void {
    for (const node of this.pulses) {
      if (!node.active) continue;

      if (node.phase === 'CHARGING') {
        const t = Math.max(0, node.timer / node.chargeDuration);
        const telegraphRadius = 14 + t * (node.maxRadius * 0.48);

        ctx.save();
        // Outer dashed limit preview
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.24)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.maxRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Shrinking timing ring
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, telegraphRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Central charging beacon
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6 + (1 - t) * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        const lifeAlpha = Math.max(0, 1 - node.currentRadius / node.maxRadius);
        ctx.save();
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.85 * lifeAlpha})`;
        ctx.lineWidth = node.ringWidth * (0.45 + 0.55 * lifeAlpha);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 228, 230, ${0.65 * lifeAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.currentRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderAfterimages(ctx: CanvasRenderingContext2D): void {
    for (const a of this.afterimages) {
      if (!a.active) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.scale(a.scaleX, a.scaleY);
      ctx.globalAlpha = a.alpha * 0.6;
      ctx.fillStyle = '#38BDF8';
      this.traceGliderPath(ctx);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;

    // Smooth tapered ribbon trail
    if (p.trail.length > 2) {
      ctx.save();
      for (let i = 1; i < p.trail.length; i++) {
        const prev = p.trail[i - 1];
        const curr = p.trail[i];
        const ratio = i / p.trail.length;
        ctx.strokeStyle = p.dashTimer > 0 ? `rgba(56, 189, 248, ${ratio * 0.65})` : `rgba(125, 211, 252, ${ratio * 0.32})`;
        ctx.lineWidth = ratio * (p.dashTimer > 0 ? 7 : 4.2);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Invulnerability flicker
    const flickerHidden = p.invulnTimer > 0 && p.dashTimer <= 0 && Math.floor(p.invulnTimer * 18) % 2 === 0;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Subtle shield/dash halo
    if (p.dashTimer > 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.invulnTimer > 0) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!flickerHidden) {
      ctx.rotate(p.angle);
      ctx.scale(p.scaleX, p.scaleY);

      // Engine core glow
      ctx.fillStyle = p.dashTimer > 0 ? '#7DD3FC' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(-10, 0, p.dashTimer > 0 ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Glider hull
      ctx.fillStyle = p.hitFlashTimer > 0 ? '#FDA4AF' : '#F8FAFC';
      ctx.strokeStyle = p.dashTimer > 0 ? '#38BDF8' : '#94A3B8';
      ctx.lineWidth = 1.6;
      this.traceGliderPath(ctx);
      ctx.fill();
      ctx.stroke();

      // Canopy accent
      ctx.fillStyle = p.dashTimer > 0 ? '#38BDF8' : '#0EA5E9';
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-2, -3.5);
      ctx.lineTo(-2, 3.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private traceGliderPath(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11.5);
    ctx.lineTo(-5.5, 0);
    ctx.lineTo(-10, 11.5);
    ctx.closePath();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;

      if (pt.shape === 'diamond') {
        ctx.rotate(pt.angle);
        const s = pt.size * (0.5 + 0.5 * alpha);
        ctx.beginPath();
        ctx.moveTo(s * 1.4, 0);
        ctx.lineTo(0, -s * 0.7);
        ctx.lineTo(-s * 1.4, 0);
        ctx.lineTo(0, s * 0.7);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const t of this.floatingTexts) {
      if (!t.active) continue;
      const ratio = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      ctx.font = `700 ${Math.round(13 * t.scale)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(11, 17, 32, 0.75)';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
