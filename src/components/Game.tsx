import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Maximize, Minimize, Bug } from 'lucide-react';
import { GameEngine, type EngineUiSnapshot } from '../game/Engine';
import { BoomerElite, MeleeEnemy, RangedEnemy, TankElite } from '../game/Entities';
import type { Difficulty } from '../game/Difficulty';
import type { WeaponId } from '../game/combat/Weapon';
import { CyberButton, CyberPanel, CyberText, CyberBadge, CyberInput, CyberProgressBar, CyberGlitchText, CyberModal } from './ui';
import { useI18n } from '../i18n';

const EMPTY_UI_SNAPSHOT: EngineUiSnapshot = {
  weaponSlots: [null, null],
  activeWeaponIndex: 0,
  nearbyInteractables: [],
};

const usePresence = (isOpen: boolean, durationMs: number) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [state, setState] = useState<'enter' | 'exit'>(isOpen ? 'enter' : 'exit');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsMounted(true);
      window.requestAnimationFrame(() => setState('enter'));
      return;
    }

    setState('exit');
    timeoutRef.current = window.setTimeout(() => {
      setIsMounted(false);
    }, durationMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen, durationMs]);

  return { isMounted, state };
};

export const Game = () => {
  const { t, language, setLanguage } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
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
  const [spawnWeaponId, setSpawnWeaponId] = useState<WeaponId>('default');
  const [debugFlags, setDebugFlags] = useState({
    stopSpawning: false,
    godMode: false,
    noCooldowns: false,
    showWaveDebug: false,
  });

  const debugWeaponOptions: Array<{ id: WeaponId; label: string }> = [
    { id: 'default', label: 'DEFAULT GUN' },
    { id: 'knife', label: 'KNIFE' },
    { id: 'bow', label: 'BOW' },
    { id: 'bounce_gun', label: 'BOUNCE GUN' },
  ];

  const weaponKeyById = {
    default: 'weapon.default',
    bounce_gun: 'weapon.bounce_gun',
    knife: 'weapon.knife',
    bow: 'weapon.bow',
  } satisfies Record<WeaponId, 'weapon.default' | 'weapon.bounce_gun' | 'weapon.knife' | 'weapon.bow'>;

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
      console.error('Error toggling fullscreen:', err);
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
    setEngine(engine);

    engine.setLanguage(language);

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
      setEngine(null);
    };
  }, [isPortrait, forceStart]);

  const subscribeUi = useCallback((onStoreChange: () => void) => {
    if (!engine) return () => {};
    return engine.subscribeUi(onStoreChange);
  }, [engine]);

  const getUiSnapshot = useCallback((): EngineUiSnapshot => {
    if (!engine) return EMPTY_UI_SNAPSHOT;
    return engine.getUiSnapshot();
  }, [engine]);

  const uiSnapshot = useSyncExternalStore(subscribeUi, getUiSnapshot, () => EMPTY_UI_SNAPSHOT);
  const weaponSlots = uiSnapshot.weaponSlots;
  const activeWeaponIndex = uiSnapshot.activeWeaponIndex;
  const nearbyDrops = uiSnapshot.nearbyInteractables;

  const startOverlay = usePresence(gameState === 'START', 200);
  const gameOverOverlay = usePresence(gameState === 'GAME_OVER', 200);
  const rotateOverlay = usePresence(isPortrait && !forceStart, 200);

  const handleStartGame = () => {
    if (engineRef.current) {
      engineRef.current.startGame(difficulty);
    }
  };

  useEffect(() => {
    engineRef.current?.setLanguage(language);
  }, [language]);

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
          className="p-2 bg-black/50 border border-cyan-500/30 text-cyan-500 clip-chamfer-sm hover:bg-cyan-900/50 transition-[background-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.35),0_0_12px_rgba(6,182,212,0.25)] active:translate-y-px"
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

                <div className="flex flex-col gap-2">
                  <CyberText variant="label" color="cyan">SPAWN WEAPON DROP</CyberText>
                  <select
                    value={spawnWeaponId}
                    onChange={(e) => {
                      const next = debugWeaponOptions.find(opt => opt.id === e.target.value);
                      if (next) {
                        setSpawnWeaponId(next.id);
                      }
                    }}
                    className="w-full bg-black/40 border border-cyan-500/30 text-cyan-200 font-mono uppercase tracking-widest text-xs px-3 py-2 clip-chamfer-sm focus:outline-none focus:border-cyan-400/60"
                  >
                    {debugWeaponOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <CyberButton variant="primary" onClick={() => {
                    engineRef.current?.debugSpawnWeaponDrop(spawnWeaponId);
                  }}>SPAWN WEAPON</CyberButton>
                </div>

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
                     }}
                    className={`w-full !px-3 !py-2 text-left ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="flex items-start gap-2">
                      <CyberBadge variant={isActive ? 'cyan' : 'neutral'}>{idx + 1}</CyberBadge>
                      <span className="font-mono uppercase text-[11px] tracking-widest whitespace-normal break-words leading-tight">
                        {slot ? t(weaponKeyById[slot]) : t('weapon.empty')}
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
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                  {nearbyDrops.map((d) => (
                    <CyberButton
                      key={d.id}
                      variant="ghost"
                       onClick={() => {
                         const engine = engineRef.current;
                         if (!engine) return;
                         engine.interactWith(d.id);
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
      {startOverlay.isMounted && (
        <div
          className={`absolute inset-0 z-20 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            gameState === 'START' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div
              className={`w-full max-w-lg max-h-[calc(100svh-2rem)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                startOverlay.state === 'enter' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
              }`}
            >
              <CyberPanel
                variant="cyan"
                className="w-full max-h-[calc(100svh-2rem)]"
                contentClassName="flex flex-col items-center text-center max-h-[calc(100svh-2rem)]"
              >
                <div className="w-full flex items-center justify-end gap-2 mb-2">
                  <CyberButton
                    variant={language === 'en' ? 'primary' : 'ghost'}
                    onClick={() => setLanguage('en')}
                    className="!px-3 !py-1.5"
                  >
                    EN
                  </CyberButton>
                  <CyberButton
                    variant={language === 'zh' ? 'primary' : 'ghost'}
                    onClick={() => setLanguage('zh')}
                    className="!px-3 !py-1.5"
                  >
                    中文
                  </CyberButton>
                </div>
                <CyberGlitchText
                  text={t('menu.title')}
                  color="cyan"
                  className={isShortLandscape ? 'text-4xl md:text-5xl mb-1' : 'text-5xl md:text-7xl mb-2'}
                />
                <CyberText variant="label" color="neutral" className={isShortLandscape ? 'mb-4' : 'mb-8'}>
                  {t('menu.subtitle')}
                </CyberText>

                <div className={isShortLandscape ? 'w-full mb-4' : 'w-full mb-6'}>
                  <CyberText variant="label" color="cyan" className={isShortLandscape ? 'mb-2' : 'mb-3'}>
                    {t('menu.difficulty')}
                  </CyberText>
                  <div className="grid grid-cols-3 gap-2">
                    <CyberButton
                      variant={difficulty === 'EASY' ? 'primary' : 'ghost'}
                      onClick={() => setDifficulty('EASY')}
                      className={isShortLandscape ? 'px-3 py-1.5' : 'px-3 py-2'}
                    >
                      {t('menu.difficulty.easy')}
                    </CyberButton>
                    <CyberButton
                      variant={difficulty === 'NORMAL' ? 'primary' : 'ghost'}
                      onClick={() => setDifficulty('NORMAL')}
                      className={isShortLandscape ? 'px-3 py-1.5' : 'px-3 py-2'}
                    >
                      {t('menu.difficulty.normal')}
                    </CyberButton>
                    <CyberButton
                      variant={difficulty === 'HARD' ? 'danger' : 'ghost'}
                      onClick={() => setDifficulty('HARD')}
                      className={isShortLandscape ? 'px-3 py-1.5' : 'px-3 py-2'}
                    >
                      {t('menu.difficulty.hard')}
                    </CyberButton>
                  </div>
                  <CyberText
                    variant="body"
                    color="neutral"
                    className={isShortLandscape ? 'mt-2 text-sm md:text-base' : 'mt-3'}
                  >
                    {difficulty === 'EASY' && t('menu.difficultyDesc.easy')}
                    {difficulty === 'NORMAL' && t('menu.difficultyDesc.normal')}
                    {difficulty === 'HARD' && t('menu.difficultyDesc.hard')}
                  </CyberText>
                </div>

                <div className={isShortLandscape ? 'flex flex-col gap-3 w-full' : 'flex flex-col gap-4 w-full'}>
                  <CyberButton variant="primary" onClick={handleStartGame}>
                    {t('menu.startGame')}
                  </CyberButton>
                  <CyberButton variant="ghost" onClick={() => setShowUIPreview(true)}>
                    {t('menu.uiComponents')}
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
        title={t('uiPreview.title')}
        variant="cyan"
        actions={
          <CyberButton variant="ghost" onClick={() => setShowUIPreview(false)}>{t('uiPreview.close')}</CyberButton>
        }
      >
        <div className="flex flex-col gap-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          
          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">{t('uiPreview.section.badges')}</CyberText>
            <div className="flex flex-wrap gap-2">
              <CyberBadge variant="cyan" glow>{t('uiPreview.badge.active')}</CyberBadge>
              <CyberBadge variant="red" glow>{t('uiPreview.badge.danger')}</CyberBadge>
              <CyberBadge variant="yellow" glow>{t('uiPreview.badge.warning')}</CyberBadge>
              <CyberBadge variant="purple" glow>{t('uiPreview.badge.epic')}</CyberBadge>
              <CyberBadge variant="neutral">{t('uiPreview.badge.offline')}</CyberBadge>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">{t('uiPreview.section.progressBars')}</CyberText>
            <div className="flex flex-col gap-4">
              <CyberProgressBar value={75} max={100} variant="cyan" label={t('uiPreview.progress.hp')} showValue />
              <CyberProgressBar value={30} max={100} variant="red" label={t('uiPreview.progress.shield')} showValue />
              <CyberProgressBar value={90} max={100} variant="yellow" label={t('uiPreview.progress.energy')} showValue />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">{t('uiPreview.section.inputs')}</CyberText>
            <CyberInput label={t('uiPreview.input.username')} placeholder={t('uiPreview.input.usernamePlaceholder')} />
            <CyberInput label={t('uiPreview.input.password')} type="password" placeholder={t('uiPreview.input.passwordPlaceholder')} error={t('uiPreview.input.passwordError')} />
          </div>

          <div className="flex flex-col gap-2">
            <CyberText variant="label" color="cyan">{t('uiPreview.section.glitchText')}</CyberText>
            <div className="flex flex-col gap-2">
              <CyberGlitchText text={t('uiPreview.glitch.compromised')} color="red" className="text-xl" />
              <CyberGlitchText text={t('uiPreview.glitch.uploading')} color="cyan" className="text-xl" />
            </div>
          </div>

        </div>
      </CyberModal>

      {gameOverOverlay.isMounted && (
        <div
          className={`absolute inset-0 z-20 overflow-hidden bg-black/80 backdrop-blur-md transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            gameState === 'GAME_OVER' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div
              className={`w-full max-w-md max-h-[calc(100svh-2rem)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                gameOverOverlay.state === 'enter' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
              }`}
            >
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
                  {t('gameOver.title')}
                </CyberText>
                <CyberText variant="h3" color="white" className={isShortLandscape ? 'mb-1 text-lg md:text-xl' : 'mb-2'}>
                  {t('gameOver.finalScore', { score })}
                </CyberText>
                <CyberText variant="label" color="cyan" className={isShortLandscape ? 'mb-4' : 'mb-8'}>
                  {t('gameOver.creditsCollected', { credits })}
                </CyberText>
                <CyberButton variant="primary" onClick={handleStartGame}>
                  {t('gameOver.reboot')}
                </CyberButton>
              </CyberPanel>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-30 p-2 bg-black/50 clip-chamfer-sm text-white hover:bg-black/70 transition-[background-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none border border-white/10 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.18),0_0_12px_rgba(255,255,255,0.12)] active:translate-y-px"
        aria-label={t('aria.toggleFullscreen')}
      >
        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      </button>

      {rotateOverlay.isMounted && (
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center bg-cyber-bg text-white p-8 text-center bg-scanlines transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            isPortrait && !forceStart ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div
            className={`w-full max-w-md transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
              rotateOverlay.state === 'enter' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
            }`}
          >
            <CyberPanel variant="cyan" className="w-full max-w-md" contentClassName="text-center">
            <CyberText variant="h2" color="cyan" glow className="mb-4">{t('rotate.title')}</CyberText>
            <CyberText variant="body" color="neutral" className="mb-8">
              {t('rotate.body')}
            </CyberText>
            <CyberButton variant="ghost" onClick={() => setForceStart(true)}>
              {t('rotate.playAnyway')}
            </CyberButton>
          </CyberPanel>
          </div>
        </div>
      )}
    </div>
  );
};
