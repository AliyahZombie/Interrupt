import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Bug } from 'lucide-react';
import { GameEngine } from '../game/Engine';
import { BoomerElite, MeleeEnemy, RangedEnemy, TankElite } from '../game/Entities';
import type { NearbyInteractableEntry } from '../game/Entities';
import type { Difficulty } from '../game/Difficulty';
import type { WeaponId } from '../game/combat/Weapon';
import { CyberButton, CyberPanel, CyberText, CyberBadge, CyberInput, CyberProgressBar, CyberGlitchText, CyberModal } from './ui';

export const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isShortLandscape, setIsShortLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceStart, setForceStart] = useState(false);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [score, setScore] = useState(0);
  const [credits, setCredits] = useState(0);
  const [showUIPreview, setShowUIPreview] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [spawnLevelText, setSpawnLevelText] = useState('1');
  const [weaponSlots, setWeaponSlots] = useState<Array<{ id: WeaponId; name: string } | null>>([null, null]);
  const [activeWeaponIndex, setActiveWeaponIndex] = useState<0 | 1>(0);
  const [nearbyDrops, setNearbyDrops] = useState<NearbyInteractableEntry[]>([]);
  const [debugFlags, setDebugFlags] = useState({
    stopSpawning: false,
    godMode: false,
    noCooldowns: false,
    showWaveDebug: false,
  });

  const debugFlagsRef = useRef(debugFlags);
  useEffect(() => {
    debugFlagsRef.current = debugFlags;
  }, [debugFlags]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      setIsShortLandscape(!portrait && window.innerHeight <= 520);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    if ((isPortrait && !forceStart) || !canvasRef.current) return;
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    engine.debugFlags.stopSpawning = debugFlagsRef.current.stopSpawning;
    engine.debugFlags.godMode = debugFlagsRef.current.godMode;
    engine.debugFlags.noCooldowns = debugFlagsRef.current.noCooldowns;
    engine.debugFlags.showWaveDebug = debugFlagsRef.current.showWaveDebug;

    // When the engine is recreated (e.g. rotation / resize), reset the UI state
    // so we don't get stuck in PLAYING with a fresh engine that hasn't started.
    setGameState('START');
    setScore(0);
    setCredits(0);
    
    engine.onStateChange = (state) => {
      setGameState(state);
    };
    
    engine.onScoreChange = (newScore, newCredits) => {
      setScore(newScore);
      setCredits(newCredits);
    };
    
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [isPortrait, forceStart]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const id = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      setWeaponSlots(engine.getWeaponSlots());
      setActiveWeaponIndex(engine.activeWeaponIndex);
      setNearbyDrops(engine.nearbyInteractables);
    }, 120);
    return () => window.clearInterval(id);
  }, [gameState]);

  const handleStartGame = () => {
    if (engineRef.current) {
      engineRef.current.startGame(difficulty);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cyber-bg">
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        style={{ touchAction: 'none' }}
      />
      
      {/* Debug Button */}
      <div className="absolute top-4 left-4 z-30">
        <button 
          onClick={() => setIsDebugPanelOpen(true)}
          className="p-2 bg-black/50 border border-cyan-500/30 text-cyan-500 clip-chamfer-sm hover:bg-cyan-900/50 transition-colors"
          aria-label="Open Debug Panel"
        >
          <Bug size={24} />
        </button>
      </div>

      {/* Debug Modal */}
      <CyberModal
        isOpen={isDebugPanelOpen}
        onClose={() => setIsDebugPanelOpen(false)}
        title="DEBUG PANEL"
        variant="cyan"
        actions={<CyberButton variant="ghost" onClick={() => setIsDebugPanelOpen(false)}>CLOSE</CyberButton>}
      >
          <div className="space-y-6">
              <div className="flex flex-col gap-3">
                <CyberText variant="label" color="cyan">ACTIONS</CyberText>
                <CyberInput
                  label="SPAWN LEVEL"
                  value={spawnLevelText}
                  onChange={(e) => setSpawnLevelText(e.target.value)}
                  placeholder="1"
                />
                <div className="grid grid-cols-2 gap-2">
                <CyberButton variant="danger" onClick={() => {
                  if (engineRef.current) engineRef.current.enemies = [];
                }}>CLEAR ENEMIES</CyberButton>
                <CyberButton variant="danger" onClick={() => {
                  engineRef.current?.skipCurrentWave();
                }}>SKIP WAVE</CyberButton>
                <CyberButton variant="primary" onClick={() => {
                  if (engineRef.current) {
                    const { player } = engineRef.current;
                    const level = Math.max(1, Math.floor(Number.parseInt(spawnLevelText, 10) || 1));
                    engineRef.current.enemies.push(new RangedEnemy(player.x + 200, player.y, level));
                  }
                }}>SPAWN RANGED</CyberButton>
                <CyberButton variant="primary" onClick={() => {
                  if (engineRef.current) {
                    const { player } = engineRef.current;
                    const level = Math.max(1, Math.floor(Number.parseInt(spawnLevelText, 10) || 1));
                    engineRef.current.enemies.push(new MeleeEnemy(player.x + 200, player.y, level));
                  }
                }}>SPAWN MELEE</CyberButton>
                 <CyberButton variant="primary" onClick={() => {
                   if (engineRef.current) {
                     const { player } = engineRef.current;
                     const level = Math.max(1, Math.floor(Number.parseInt(spawnLevelText, 10) || 1));
                     engineRef.current.enemies.push(new TankElite(player.x + 240, player.y, level));
                   }
                 }}>SPAWN ELITE TANK</CyberButton>
                 <CyberButton variant="primary" onClick={() => {
                   if (engineRef.current) {
                     const { player } = engineRef.current;
                     const level = Math.max(1, Math.floor(Number.parseInt(spawnLevelText, 10) || 1));
                     engineRef.current.enemies.push(new BoomerElite(player.x + 240, player.y, level));
                   }
                 }}>SPAWN ELITE BOOMER</CyberButton>
                 <CyberButton variant="primary" onClick={() => {
                   engineRef.current?.applyPlayerEffect('STUN', 3000);
                 }}>STUN 3S</CyberButton>
                <CyberButton variant="primary" onClick={() => {
                  engineRef.current?.applyPlayerEffect('POISON', 8000);
                }}>POISON 8S</CyberButton>
             </div>
           </div>
          
          <div className="flex flex-col gap-3">
            <CyberText variant="label" color="cyan">TOGGLES</CyberText>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-white font-mono uppercase text-sm cursor-pointer">
                <input type="checkbox" checked={debugFlags.stopSpawning} onChange={(e) => {
                  const val = e.target.checked;
                  setDebugFlags(prev => ({...prev, stopSpawning: val}));
                  if (engineRef.current) engineRef.current.debugFlags.stopSpawning = val;
                }} className="w-5 h-5 accent-cyan-500" />
                STOP SPAWNING
              </label>
              <label className="flex items-center gap-3 text-white font-mono uppercase text-sm cursor-pointer">
                <input type="checkbox" checked={debugFlags.godMode} onChange={(e) => {
                  const val = e.target.checked;
                  setDebugFlags(prev => ({...prev, godMode: val}));
                  if (engineRef.current) engineRef.current.debugFlags.godMode = val;
                }} className="w-5 h-5 accent-cyan-500" />
                GOD MODE
              </label>
              <label className="flex items-center gap-3 text-white font-mono uppercase text-sm cursor-pointer">
                <input type="checkbox" checked={debugFlags.noCooldowns} onChange={(e) => {
                  const val = e.target.checked;
                  setDebugFlags(prev => ({...prev, noCooldowns: val}));
                  if (engineRef.current) {
                    engineRef.current.debugFlags.noCooldowns = val;
                    if (val) {
                      engineRef.current.skills.forEach(skill => {
                        if (skill) skill.currentCooldown = 0;
                      });
                    }
                  }
                }} className="w-5 h-5 accent-cyan-500" />
                NO COOLDOWNS
              </label>
              <label className="flex items-center gap-3 text-white font-mono uppercase text-sm cursor-pointer">
                <input type="checkbox" checked={debugFlags.showWaveDebug} onChange={(e) => {
                  const val = e.target.checked;
                  setDebugFlags(prev => ({...prev, showWaveDebug: val}));
                  if (engineRef.current) engineRef.current.debugFlags.showWaveDebug = val;
                }} className="w-5 h-5 accent-cyan-500" />
                SHOW WAVE DEBUG
              </label>
            </div>
          </div>
        </div>
      </CyberModal>

      {gameState === 'PLAYING' && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-44 pointer-events-auto">
            <div className="flex flex-col gap-2">
              {[0, 1].map((idx) => {
                const slot = weaponSlots[idx];
                const isActive = activeWeaponIndex === idx;
                const isDisabled = !slot;
                return (
                  <CyberButton
                    key={idx}
                    variant={isActive ? 'primary' : 'ghost'}
                    disabled={isDisabled}
                    onClick={() => {
                      const engine = engineRef.current;
                      if (!engine) return;
                      engine.switchWeapon(idx as 0 | 1);
                      setActiveWeaponIndex(idx as 0 | 1);
                    }}
                    className={`w-full !px-3 !py-2 text-left ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="flex items-start gap-2">
                      <CyberBadge variant={isActive ? 'cyan' : 'neutral'}>{idx + 1}</CyberBadge>
                      <span className="font-mono uppercase text-[11px] tracking-widest whitespace-normal break-words leading-tight">
                        {slot ? slot.name : 'EMPTY'}
                      </span>
                    </span>
                  </CyberButton>
                );
              })}
            </div>
          </div>

          {nearbyDrops.length > 0 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-72 pointer-events-auto z-40">
              <div className="bg-black/40 backdrop-blur-sm border border-white/10 clip-chamfer-sm p-2">
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {nearbyDrops.map((d) => (
                    <CyberButton
                      key={d.id}
                      variant="ghost"
                      onClick={() => {
                        const engine = engineRef.current;
                        if (!engine) return;
                        engine.interactWith(d.id);
                        setNearbyDrops(engine.nearbyInteractables);
                        setWeaponSlots(engine.getWeaponSlots());
                        setActiveWeaponIndex(engine.activeWeaponIndex);
                      }}
                      className="w-full !px-3 !py-2 text-left bg-black/20 hover:bg-black/30 border border-white/10"
                    >
                      <span className="font-mono uppercase text-[11px] tracking-widest whitespace-normal break-words leading-tight">{d.title}</span>
                    </CyberButton>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UI Overlays */}
      {gameState === 'START' && (
        <div className="absolute inset-0 z-20 overflow-hidden bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-lg max-h-[calc(100svh-2rem)]">
              <CyberPanel
                variant="cyan"
                className="w-full max-h-[calc(100svh-2rem)]"
                contentClassName="flex flex-col items-center text-center max-h-[calc(100svh-2rem)]"
              >
                <CyberGlitchText
                  text="SURVIVOR"
                  color="cyan"
                  className={isShortLandscape ? 'text-4xl md:text-5xl mb-1' : 'text-5xl md:text-7xl mb-2'}
                />
                <CyberText variant="label" color="neutral" className={isShortLandscape ? 'mb-4' : 'mb-8'}>
                  SYSTEM INITIALIZATION READY
                </CyberText>

                <div className={isShortLandscape ? 'w-full mb-4' : 'w-full mb-6'}>
                  <CyberText variant="label" color="cyan" className={isShortLandscape ? 'mb-2' : 'mb-3'}>
                    DIFFICULTY
                  </CyberText>
                  <div className="grid grid-cols-3 gap-2">
                    <CyberButton
                      variant={difficulty === 'EASY' ? 'primary' : 'ghost'}
                      onClick={() => setDifficulty('EASY')}
                      className={isShortLandscape ? 'px-3 py-1.5' : 'px-3 py-2'}
                    >
                      EASY
                    </CyberButton>
                    <CyberButton
                      variant={difficulty === 'NORMAL' ? 'primary' : 'ghost'}
                      onClick={() => setDifficulty('NORMAL')}
                      className={isShortLandscape ? 'px-3 py-1.5' : 'px-3 py-2'}
                    >
                      NORMAL
                    </CyberButton>
                    <CyberButton
                      variant={difficulty === 'HARD' ? 'danger' : 'ghost'}
                      onClick={() => setDifficulty('HARD')}
                      className={isShortLandscape ? 'px-3 py-1.5' : 'px-3 py-2'}
                    >
                      HARD
                    </CyberButton>
                  </div>
                  <CyberText
                    variant="body"
                    color="neutral"
                    className={isShortLandscape ? 'mt-2 text-sm md:text-base' : 'mt-3'}
                  >
                    {difficulty === 'EASY' && 'PLAYER TAKES 50% DAMAGE'}
                    {difficulty === 'NORMAL' && 'STANDARD DAMAGE'}
                    {difficulty === 'HARD' && 'PLAYER TAKES 150% DAMAGE • ENEMIES DODGE BULLETS'}
                  </CyberText>
                </div>

                <div className={isShortLandscape ? 'flex flex-col gap-3 w-full' : 'flex flex-col gap-4 w-full'}>
                  <CyberButton variant="primary" onClick={handleStartGame}>
                    START GAME
                  </CyberButton>
                  <CyberButton variant="ghost" onClick={() => setShowUIPreview(true)}>
                    UI COMPONENTS
                  </CyberButton>
                </div>
              </CyberPanel>
            </div>
          </div>
        </div>
      )}

      {/* UI Preview Modal */}
      <CyberModal 
        isOpen={showUIPreview} 
        onClose={() => setShowUIPreview(false)} 
        title="UI COMPONENT LIBRARY"
        variant="cyan"
        actions={
          <CyberButton variant="ghost" onClick={() => setShowUIPreview(false)}>CLOSE</CyberButton>
        }
      >
        <div className="flex flex-col gap-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          
          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">Badges</CyberText>
            <div className="flex flex-wrap gap-2">
              <CyberBadge variant="cyan" glow>Active</CyberBadge>
              <CyberBadge variant="red" glow>Danger</CyberBadge>
              <CyberBadge variant="yellow" glow>Warning</CyberBadge>
              <CyberBadge variant="purple" glow>Epic</CyberBadge>
              <CyberBadge variant="neutral">Offline</CyberBadge>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">Progress Bars</CyberText>
            <div className="flex flex-col gap-4">
              <CyberProgressBar value={75} max={100} variant="cyan" label="HP" showValue />
              <CyberProgressBar value={30} max={100} variant="red" label="SHIELD" showValue />
              <CyberProgressBar value={90} max={100} variant="yellow" label="ENERGY" showValue />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">Inputs</CyberText>
            <CyberInput label="USERNAME" placeholder="Enter alias..." />
            <CyberInput label="PASSWORD" type="password" placeholder="Enter key..." error="Invalid access key" />
          </div>

          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">Glitch Text</CyberText>
            <div className="flex flex-col gap-2">
              <CyberGlitchText text="SYSTEM COMPROMISED" color="red" className="text-xl" />
              <CyberGlitchText text="UPLOADING VIRUS..." color="cyan" className="text-xl" />
            </div>
          </div>

        </div>
      </CyberModal>

      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-20 overflow-hidden bg-black/80 backdrop-blur-md">
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-md max-h-[calc(100svh-2rem)]">
              <CyberPanel
                variant="red"
                className="w-full max-h-[calc(100svh-2rem)]"
                contentClassName="flex flex-col items-center text-center max-h-[calc(100svh-2rem)]"
              >
                <CyberText
                  variant="h1"
                  color="red"
                  glow
                  className={isShortLandscape ? 'mb-1 text-4xl md:text-5xl' : 'mb-2'}
                >
                  SYSTEM FAILURE
                </CyberText>
                <CyberText variant="h3" color="white" className={isShortLandscape ? 'mb-1 text-lg md:text-xl' : 'mb-2'}>
                  FINAL SCORE: {score}
                </CyberText>
                <CyberText variant="label" color="cyan" className={isShortLandscape ? 'mb-4' : 'mb-8'}>
                  CREDITS COLLECTED: {credits}
                </CyberText>
                <CyberButton variant="primary" onClick={handleStartGame}>
                  REBOOT SYSTEM
                </CyberButton>
              </CyberPanel>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-30 p-2 bg-black/50 clip-chamfer-sm text-white hover:bg-black/70 transition-colors border border-white/10"
        aria-label="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      </button>

      {isPortrait && !forceStart && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-cyber-bg text-white p-8 text-center bg-scanlines">
          <CyberPanel variant="cyan" className="w-full max-w-md" contentClassName="text-center">
            <CyberText variant="h2" color="cyan" glow className="mb-4">ROTATE DEVICE</CyberText>
            <CyberText variant="body" color="neutral" className="mb-8">
              This game is designed to be played in landscape mode for the best experience.
            </CyberText>
            <CyberButton variant="ghost" onClick={() => setForceStart(true)}>
              PLAY ANYWAY
            </CyberButton>
          </CyberPanel>
        </div>
      )}
    </div>
  );
};
