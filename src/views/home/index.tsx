// Next, React
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';

// Wallet
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Components
import { RequestAirdrop } from '../../components/RequestAirdrop';
import pkg from '../../../package.json';

// Store
import useUserSOLBalanceStore from '../../stores/useUserSOLBalanceStore';

const GameSandbox: FC = () => {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  const [lives, setLives] = useState(3);
  const [carPos, setCarPos] = useState(50);
  const [speed, setSpeed] = useState(1);
  const [bullets, setBullets] = useState<{id: number, x: number, y: number}[]>([]);
  const [obstacles, setObstacles] = useState<{id: number, x: number, y: number, type: string, hit?: boolean}[]>([]);
  const [roadOffset, setRoadOffset] = useState(0);
  const [nextId, setNextId] = useState(0);

  // Timer
  useEffect(() => {
    if (!started || gameOver) return;
    const timer = setInterval(() => {
      setTime(t => t + 1);
      // Increase speed every 10 seconds
      setSpeed(s => Math.min(3, 1 + Math.floor(time / 10) * 0.3));
    }, 1000);
    return () => clearInterval(timer);
  }, [started, gameOver, time]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver) return;

    const interval = setInterval(() => {
      // Animate road
      setRoadOffset(prev => (prev + speed * 2) % 100);

      // Move bullets up
      setBullets(prev => prev.map(b => ({
        ...b,
        y: b.y - 4
      })).filter(b => b.y > -5));

      // Move obstacles down (faster with speed)
      setObstacles(prev => {
        const updated = prev.map(o => o.hit ? o : { ...o, y: o.y + (1.2 * speed) });
        
        // Check collision with car
        const carCollision = updated.find(o => 
          !o.hit && 
          o.y > 80 && o.y < 95 && 
          Math.abs(o.x - carPos) < 12
        );
        
        if (carCollision) {
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) setGameOver(true);
            return newLives;
          });
          return updated.filter(o => o.id !== carCollision.id);
        }
        
        // Remove obstacles that passed
        return updated.filter(o => !o.hit && o.y < 105 || o.hit && o.y > -5);
      });

      // Spawn obstacles (more frequent with speed)
      if (Math.random() < 0.02 + speed * 0.01) {
        const obstacleTypes = ['🚧', '🛢️', '⚠️', '🔥', '💎'];
        setObstacles(prev => [...prev, {
          id: Date.now() + Math.random(),
          x: Math.random() * 70 + 15,
          y: -5,
          type: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)]
        }]);
      }

      // Collision detection between bullets and obstacles
      setBullets(prevB => {
        setObstacles(prevO => {
          const newObstacles = [...prevO];
          const newBullets = prevB.filter(b => {
            let hit = false;
            newObstacles.forEach(o => {
              if (!o.hit && Math.abs(b.x - o.x) < 10 && Math.abs(b.y - o.y) < 10) {
                o.hit = true;
                o.y = o.y - 3; // Fly up when destroyed
                hit = true;
                const points = o.type === '💎' ? 50 : 20;
                setScore(s => s + points);
              }
            });
            return !hit;
          });
          return newObstacles;
        });
        return prevB;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [started, gameOver, carPos, speed]);

  const moveCar = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    setCarPos(Math.max(15, Math.min(85, x)));
  };

  const shoot = () => {
    if (gameOver) return;
    const id = nextId;
    setNextId(id + 1);
    setBullets(prev => [...prev, { 
      id, 
      x: carPos, 
      y: 80
    }]);
  };

  const startGame = () => {
    setScore(0);
    setTime(0);
    setLives(3);
    setSpeed(1);
    setGameOver(false);
    setStarted(true);
    setBullets([]);
    setObstacles([]);
    setCarPos(50);
    setRoadOffset(0);
  };

  return (
    <div className="w-full flex justify-center py-6">
      <div className="w-[360px] aspect-[9/16] bg-gradient-to-b from-gray-900 via-slate-800 to-gray-900 rounded-3xl shadow-xl p-4 flex flex-col text-white relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-2 text-sm font-bold">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">⏱️ {time}s</span>
            <span className="text-xs text-gray-400">x{speed.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[...Array(lives)].map((_, i) => (
                <span key={i} className="text-red-500">❤️</span>
              ))}
            </div>
            <div className="text-yellow-400">🏆 {score}</div>
          </div>
        </div>

        {/* Game Area */}
        <div 
          className="flex-1 relative bg-gradient-to-b from-gray-700 via-gray-600 to-gray-700 rounded-2xl overflow-hidden border-4 border-gray-500/50"
          onClick={(e) => {
            if (started && !gameOver) {
              moveCar(e.clientX, e.currentTarget.getBoundingClientRect());
              shoot();
            }
          }}
          onMouseMove={(e) => {
            if (started && !gameOver) {
              moveCar(e.clientX, e.currentTarget.getBoundingClientRect());
            }
          }}
          onTouchMove={(e) => {
            if (started && !gameOver && e.touches[0]) {
              moveCar(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
            }
          }}
        >
          {/* Animated Road Lines */}
          <div className="absolute inset-0 flex justify-around opacity-40">
            <div 
              className="w-1 h-full bg-yellow-400" 
              style={{
                backgroundImage: 'linear-gradient(to bottom, transparent 0%, transparent 40%, yellow 40%, yellow 60%, transparent 60%, transparent 100%)',
                backgroundSize: '100% 40px',
                backgroundPosition: `0 ${roadOffset}%`,
                transition: 'none'
              }}
            />
            <div 
              className="w-2 h-full bg-white/30" 
              style={{
                backgroundImage: 'linear-gradient(to bottom, transparent 0%, transparent 30%, white 30%, white 70%, transparent 70%, transparent 100%)',
                backgroundSize: '100% 60px',
                backgroundPosition: `0 ${roadOffset}%`,
                transition: 'none'
              }}
            />
            <div 
              className="w-1 h-full bg-yellow-400" 
              style={{
                backgroundImage: 'linear-gradient(to bottom, transparent 0%, transparent 40%, yellow 40%, yellow 60%, transparent 60%, transparent 100%)',
                backgroundSize: '100% 40px',
                backgroundPosition: `0 ${roadOffset}%`,
                transition: 'none'
              }}
            />
          </div>

          {started && !gameOver && (
            <>
              {/* Player Car */}
              <div
                className="absolute transition-all duration-75"
                style={{
                  left: `${carPos}%`,
                  bottom: '8%',
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="text-4xl drop-shadow-[0_0_15px_rgba(0,255,255,1)] filter brightness-110">
                  🏎️
                </div>
              </div>

              {/* Bullets / Shots */}
              {bullets.map(b => (
                <div
                  key={b.id}
                  className="absolute w-1 h-6 bg-gradient-to-t from-cyan-400 via-blue-400 to-white rounded-full shadow-[0_0_15px_rgba(0,255,255,1)]"
                  style={{
                    left: `${b.x}%`,
                    top: `${b.y}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              ))}

              {/* Obstacles */}
              {obstacles.map(o => (
                <div
                  key={o.id}
                  className={`absolute transition-all ${o.hit ? 'scale-150 opacity-0 rotate-180' : 'scale-100'}`}
                  style={{
                    left: `${o.x}%`,
                    top: `${o.y}%`,
                    transform: 'translateX(-50%)',
                    transitionDuration: o.hit ? '400ms' : '0ms'
                  }}
                >
                  <div className={`text-3xl ${o.hit ? '' : 'drop-shadow-[0_0_8px_rgba(255,100,0,0.8)]'}`}>
                    {o.hit ? '💥' : o.type}
                  </div>
                </div>
              ))}
            </>
          )}

          {!started && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-black/50">
              <div className="text-6xl mb-4 animate-bounce">🏁</div>
              <h2 className="text-3xl font-bold mb-2 text-cyan-400">TURBO RACER</h2>
              <p className="text-sm opacity-90 mb-4 max-w-xs">
                Race against time! Tap to steer and shoot obstacles before you crash!
              </p>
              <div className="text-xs opacity-75 mb-6 space-y-1">
                <div>🚧 Dodge or destroy obstacles</div>
                <div>💎 Diamonds = 50 pts | Others = 20 pts</div>
                <div>⚡ Speed increases over time!</div>
              </div>
              <button
                onClick={startGame}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-8 py-3 rounded-full shadow-lg active:scale-95 transition-transform animate-pulse"
              >
                🏁 START RACE
              </button>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-black/90">
              <div className="text-6xl mb-4">💥</div>
              <h2 className="text-3xl font-bold mb-2 text-red-500">CRASHED!</h2>
              <div className="mb-6 space-y-2">
                <p className="text-sm text-gray-300">Survived: <span className="font-bold text-cyan-400">{time}s</span></p>
                <p className="text-sm text-gray-300">Max Speed: <span className="font-bold text-yellow-400">x{speed.toFixed(1)}</span></p>
                <p className="text-2xl font-bold text-yellow-400">Score: {score}</p>
              </div>
              <button
                onClick={startGame}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-3 rounded-full shadow-lg active:scale-95 transition-transform"
              >
                🔄 RACE AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 text-center text-xs opacity-70">
          🎯 Tap/Move to steer • Click to shoot • Survive the race!
        </div>
      </div>
    </div>
  );
};

export const HomeView = GameSandbox;
