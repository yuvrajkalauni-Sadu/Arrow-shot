import { Volume2, VolumeX } from 'lucide-react';

interface TitleOverlayProps {
  bestScore: number;
  isMuted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}

export function TitleOverlay({ bestScore, isMuted, onStart, onToggleMute }: TitleOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 sm:p-10 md:p-14">
      {/* Top Bar: Mute toggle only (zero navbars, zero pill clutter) */}
      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700/80 bg-[#131C31] text-slate-200 transition-colors duration-150 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Left-aligned Title Lockup & Start CTA over calm sky negative space */}
      <div className="my-auto max-w-lg">
        {/* Bespoke inline SVG title lockup */}
        <svg
          viewBox="0 0 420 112"
          className="mb-4 h-auto w-full max-w-[380px] select-none"
          role="img"
          aria-label="Comet Dash"
        >
          {/* Comet emblem */}
          <g transform="translate(8, 12)">
            <path
              d="M4 26 L26 20 M0 34 L22 30 M10 42 L28 38"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.7"
            />
            <polygon
              points="52,26 24,14 31,26 24,38"
              fill="#F8FAFC"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <polygon points="41,26 32,22 32,30" fill="#0EA5E9" />
            <polygon points="62,10 66,18 62,26 58,18" fill="#F59E0B" />
          </g>

          {/* Display Wordmark */}
          <text
            x="84"
            y="50"
            fill="#F8FAFC"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="44"
            letterSpacing="-1.2"
          >
            COMET
          </text>
          <text
            x="84"
            y="95"
            fill="#F59E0B"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="44"
            letterSpacing="-1.2"
          >
            DASH
          </text>
        </svg>

        <p className="mb-7 max-w-md text-base leading-relaxed text-slate-300">
          Steer through twilight sectors, gather solar shards to build your multiplier, and dash through hazards before they strike.
        </p>

        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={onStart}
            className="pointer-events-auto inline-flex h-12 items-center justify-center rounded-lg bg-[#F59E0B] px-7 font-display text-base font-bold tracking-wide text-[#0B1120] transition-transform duration-150 hover:bg-[#FBBF24] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            Start Game
          </button>

          {bestScore > 0 && (
            <div className="flex items-baseline gap-2.5 text-sm text-slate-400">
              <span>Best Score</span>
              <span className="font-mono text-lg font-bold tabular-nums text-slate-100">
                {bestScore.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="text-xs font-medium tracking-wide text-slate-400 sm:text-sm">
        WASD / Arrows Move <span aria-hidden="true" className="mx-2 text-slate-600">·</span> Space / Click Dash{' '}
        <span aria-hidden="true" className="mx-2 text-slate-600">·</span> Esc Pause
      </div>
    </div>
  );
}
