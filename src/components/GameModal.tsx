import { GameState, HudSnapshot } from '../game/types';

interface GameModalProps {
  gameState: Extract<GameState, 'PAUSED' | 'GAME_OVER'>;
  hud: HudSnapshot;
  isNewBest: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function GameModal({
  gameState,
  hud,
  isNewBest,
  onResume,
  onRestart,
  onQuitToTitle,
}: GameModalProps) {
  const isPaused = gameState === 'PAUSED';

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#070B14]/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-heading"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-700/90 bg-[#131C31] p-7 shadow-2xl">
        <h2
          id="modal-heading"
          className="font-display text-2xl font-bold tracking-tight text-white"
        >
          {isPaused ? 'Paused' : 'Run Complete'}
        </h2>

        {isPaused ? (
          <p className="mt-1.5 text-sm text-slate-400">
            Sector {hud.wave} · Score {hud.score.toLocaleString()}
          </p>
        ) : (
          <div className="mt-5">
            <div className="flex items-baseline justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="text-xs font-medium text-slate-400">Final Score</div>
                <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-white">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-slate-400">
                  {isNewBest ? 'New Best Score' : 'Best Score'}
                </div>
                <div
                  className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                    isNewBest ? 'text-[#F59E0B]' : 'text-slate-200'
                  }`}
                >
                  {hud.bestScore.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-left">
              <div>
                <div className="text-xs text-slate-400">Sector</div>
                <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-100">
                  {hud.wave}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Shards</div>
                <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-100">
                  {hud.shardsCollected}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Grazes</div>
                <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-100">
                  {hud.grazes}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-2.5">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#F59E0B] px-5 font-display text-sm font-bold text-[#0B1120] transition-colors duration-150 hover:bg-[#FBBF24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#F59E0B] px-5 font-display text-sm font-bold text-[#0B1120] transition-colors duration-150 hover:bg-[#FBBF24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap"
            >
              Play Again
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 px-5 text-sm font-semibold text-slate-100 transition-colors duration-150 hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap"
            >
              Restart
            </button>
          )}

          <button
            type="button"
            onClick={onQuitToTitle}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-800 bg-transparent px-5 text-sm font-medium text-slate-300 transition-colors duration-150 hover:border-slate-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
