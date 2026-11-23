import { Pause, Volume2, VolumeX, Zap } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface HudOverlayProps {
  hud: HudSnapshot;
  isMuted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onTouchDash: () => void;
}

export function HudOverlay({
  hud,
  isMuted,
  onPause,
  onToggleMute,
  onTouchDash,
}: HudOverlayProps) {
  const dashReady = hud.dashCharge >= 0.99;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Perimeter */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Score, Combo & Sector (unboxed tabular numerals) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-white sm:text-3xl">
              {hud.score.toLocaleString()}
            </span>

            {hud.combo > 1 && (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-sm font-bold tabular-nums text-[#F59E0B]">
                  {hud.combo}x
                </span>
                <div className="h-1 w-14 overflow-hidden rounded-sm bg-slate-800">
                  <div
                    className="h-full bg-[#F59E0B] transition-transform duration-75 origin-left"
                    style={{ transform: `scaleX(${hud.comboTimerRatio})` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="tabular-nums">Sector {hud.wave}</span>
            {hud.bestScore > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Best {hud.bestScore.toLocaleString()}</span>
              </>
            )}
          </div>
        </div>

        {/* Center Transient Sector Banner */}
        {hud.waveBannerText && (
          <div className="hidden sm:block pt-1 text-center">
            <span className="font-display text-lg font-bold tracking-wide text-[#38BDF8]">
              {hud.waveBannerText}
            </span>
          </div>
        )}

        {/* Top-Right: Mute & Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#131C31] text-slate-200 transition-colors duration-150 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            title="Pause (Esc)"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#131C31] text-slate-200 transition-colors duration-150 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Perimeter */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Shield Pips + Dash Readiness */}
        <div className="flex flex-col gap-2.5">
          {/* Shields */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: hud.maxShields }).map((_, idx) => {
                const active = idx < hud.shields;
                return (
                  <svg key={idx} viewBox="0 0 16 16" className="h-4 w-4">
                    <polygon
                      points="8,1 15,8 8,15 1,8"
                      fill={active ? '#34D399' : 'transparent'}
                      stroke={active ? '#A7F3D0' : '#475569'}
                      strokeWidth="1.5"
                    />
                  </svg>
                );
              })}
            </div>
            <span className="font-mono text-xs font-medium tabular-nums text-slate-300">
              Shields {hud.shields}/{hud.maxShields}
            </span>
          </div>

          {/* Dash Meter */}
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-28 overflow-hidden rounded-sm bg-slate-800">
              <div
                className={`h-full origin-left transition-transform duration-75 ${
                  dashReady ? 'bg-[#38BDF8]' : 'bg-slate-500'
                }`}
                style={{ transform: `scaleX(${hud.dashCharge})` }}
              />
            </div>
            <span
              className={`font-mono text-xs font-medium ${
                dashReady ? 'text-[#38BDF8]' : 'text-slate-400'
              }`}
            >
              {dashReady ? 'Dash Ready' : 'Charging'}
            </span>
          </div>
        </div>

        {/* Bottom-Right: Dedicated Touch Dash Button (shown on touch/small screens) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onTouchDash();
          }}
          aria-label="Dash"
          className={`pointer-events-auto flex h-14 w-14 items-center justify-center rounded-xl border sm:hidden transition-colors duration-150 ${
            dashReady
              ? 'border-[#38BDF8] bg-[#131C31] text-[#38BDF8] active:bg-[#38BDF8] active:text-[#0B1120]'
              : 'border-slate-700 bg-[#131C31] text-slate-500'
          }`}
        >
          <Zap className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
