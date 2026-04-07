import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameEngine } from '../game/engine';

export default function GameScreen() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, (finalScore) => {
        navigate('/game-over', { state: { score: finalScore } });
      });
      engineRef.current.start();
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, [navigate]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-gray-400 font-mono">
        Controls: [A/D] or [Left/Right] to Move | [W/Up/Space] to Jump | [F/Enter] to Shoot
      </div>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={450} 
        className="bg-black rounded-lg shadow-[0_0_30px_rgba(233,69,96,0.3)]"
      />
    </div>
  );
}