import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { ClientEngine } from '../game/ClientEngine';
import { CyberButton } from './ui/CyberButton';
import { CyberPanel } from './ui/CyberPanel';
import { CyberText } from './ui/CyberText';

export const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ClientEngine | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceStart, setForceStart] = useState(false);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [credits, setCredits] = useState(0);

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
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    if ((isPortrait && !forceStart) || !canvasRef.current) return;
    const engine = new ClientEngine(canvasRef.current);
    engineRef.current = engine;
    
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

  const handleJoinRoom = (type: 'city' | 'arena' | 'battlefield') => {
    if (engineRef.current) {
      engineRef.current.joinRoom(type);
    }
  };

  if (isPortrait && !forceStart) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-cyber-bg text-white p-8 text-center bg-scanlines">
        <CyberPanel variant="cyan" className="max-w-md">
          <CyberText variant="h2" color="cyan" glow className="mb-4">ROTATE DEVICE</CyberText>
          <CyberText variant="body" color="neutral" className="mb-8">
            This game is designed to be played in landscape mode for the best experience.
          </CyberText>
          <CyberButton variant="ghost" onClick={() => setForceStart(true)}>
            PLAY ANYWAY
          </CyberButton>
        </CyberPanel>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cyber-bg">
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        style={{ touchAction: 'none' }}
      />
      
      {/* UI Overlays */}
      {gameState === 'START' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <CyberPanel variant="cyan" className="flex flex-col items-center text-center">
            <CyberText variant="h1" color="cyan" glow className="mb-2">SURVIVOR</CyberText>
            <CyberText variant="label" color="neutral" className="mb-8">CONNECTING TO SERVER...</CyberText>
          </CyberPanel>
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-30 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors border border-white/10"
        aria-label="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      </button>

      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-40">
          <CyberPanel variant="danger" className="flex flex-col items-center text-center max-w-md w-full">
            <CyberText variant="h1" color="danger" glow className="mb-2">SYSTEM FAILURE</CyberText>
            <CyberText variant="body" color="neutral" className="mb-8">
              Your integrity has reached 0%. Returning to City...
            </CyberText>
            
            <div className="flex gap-4 w-full">
              <CyberButton 
                variant="danger" 
                className="w-full"
                onClick={() => handleJoinRoom('city')}
              >
                RESPAWN
              </CyberButton>
            </div>
          </CyberPanel>
        </div>
      )}
    </div>
  );
};
