import { useCallback, useEffect, useRef, useState } from 'react';
import { GameModal } from './components/GameModal';
import { HudOverlay } from './components/HudOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { SoundEngine } from './game/audio';
import { CometEngine } from './game/engine';
import { GameState, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  bestScore: 0,
  combo: 1,
  comboTimerRatio: 0,
  wave: 1,
  shields: 3,
  maxShields: 3,
  dashCharge: 1,
  shardsCollected: 0,
  grazes: 0,
  waveBannerText: null,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CometEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const previousBestRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);

  // Keep latest gameState accessible inside keyboard handler without re-creating engine
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sound = new SoundEngine();
    soundRef.current = sound;
    setIsMuted(sound.isMuted());

    const engine = new CometEngine(
      canvas,
      sound,
      (nextState) => {
        setGameState(nextState);
      },
      (snapshot) => {
        setHud(snapshot);
        setIsNewBest(snapshot.score > 0 && snapshot.score >= snapshot.bestScore && snapshot.score > previousBestRef.current);
      }
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = useCallback(() => {
    previousBestRef.current = hud.bestScore;
    setIsNewBest(false);
    engineRef.current?.startGame();
  }, [hud.bestScore]);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleQuitToTitle = useCallback(() => {
    engineRef.current?.quitToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!soundRef.current) return;
    const nextMuted = soundRef.current.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  const handleTouchDash = useCallback(() => {
    engineRef.current?.triggerTouchDash();
  }, []);

  // Global keyboard shortcuts for shell state transitions & mute
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      const current = gameStateRef.current;
      if (current === 'TITLE_MENU') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
      } else if (current === 'PLAYING') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handlePause();
        }
      } else if (current === 'PAUSED') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleResume();
        }
      } else if (current === 'GAME_OVER') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        } else if (e.code === 'Escape') {
          e.preventDefault();
          handleQuitToTitle();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePause, handleQuitToTitle, handleResume, handleStartGame, handleToggleMute]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0B1120]">
      {/* Isolated full-viewport HTML5 Canvas container */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-crosshair"
          aria-label="Comet Dash game canvas"
        />
      </div>

      {/* State-driven minimal overlays */}
      {gameState === 'TITLE_MENU' && (
        <TitleOverlay
          bestScore={hud.bestScore}
          isMuted={isMuted}
          onStart={handleStartGame}
          onToggleMute={handleToggleMute}
        />
      )}

      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <HudOverlay
          hud={hud}
          isMuted={isMuted}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onTouchDash={handleTouchDash}
        />
      )}

      {(gameState === 'PAUSED' || gameState === 'GAME_OVER') && (
        <GameModal
          gameState={gameState}
          hud={hud}
          isNewBest={isNewBest}
          onResume={handleResume}
          onRestart={handleStartGame}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </main>
  );
}
