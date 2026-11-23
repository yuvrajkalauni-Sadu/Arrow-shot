export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface HudSnapshot {
  score: number;
  bestScore: number;
  combo: number;
  comboTimerRatio: number; // 0 to 1
  wave: number;
  shields: number;
  maxShields: number;
  dashCharge: number; // 0 to 1 (1 = ready)
  shardsCollected: number;
  grazes: number;
  waveBannerText: string | null;
}

export interface Star {
  x: number;
  y: number;
  z: number; // parallax depth 0.2..1.0
  size: number;
  alpha: number;
  twinklePhase: number;
}

export interface Shard {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  bobPhase: number;
  life: number;
  maxLife: number;
  value: number;
}

export interface ShieldOrb {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  life: number;
}

export interface Drifter {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  grazed: boolean;
  hitFlash: number;
}

export type LancerPhase = 'ENTERING' | 'AIMING' | 'DASHING';

export interface Lancer {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  phase: LancerPhase;
  phaseTimer: number;
  aimDirX: number;
  aimDirY: number;
  grazed: boolean;
}

export type PulsePhase = 'CHARGING' | 'EXPANDING';

export interface PulseNode {
  active: boolean;
  x: number;
  y: number;
  phase: PulsePhase;
  timer: number;
  chargeDuration: number;
  currentRadius: number;
  maxRadius: number;
  ringWidth: number;
  grazed: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  drag: number;
  shape: 'circle' | 'diamond' | 'line';
  angle: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface Afterimage {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
}
