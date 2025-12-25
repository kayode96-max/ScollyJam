// Next, React
import { FC, useEffect, useState, useRef } from 'react';
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
  const [highScore, setHighScore] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('turboShiftHighScore') || '0');
    }
    return 0;
  });
  const [distance, setDistance] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [level, setLevel] = useState(1);
  const [carX, setCarX] = useState(50);
  const [speed, setSpeed] = useState(1);
  const [shieldActive, setShieldActive] = useState(false);
  const [shieldCharge, setShieldCharge] = useState(0);
  const [roadOffset, setRoadOffset] = useState(0);
  const [lastShieldDistance, setLastShieldDistance] = useState(0);
  const [objects, setObjects] = useState<{id: number, x: number, y: number, type: 'coin' | 'car' | 'shield' | 'truck' | 'life', hit?: boolean}[]>([]);
  const [particles, setParticles] = useState<{id: number, x: number, y: number, vx: number, vy: number, color: string, life: number}[]>([]);
  const [shake, setShake] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for game loop to avoid dependency churn
  const carXRef = useRef(carX);
  const speedRef = useRef(speed);
  const shieldActiveRef = useRef(shieldActive);
  const levelRef = useRef(level);
  const distanceRef = useRef(distance);
  const lastShieldDistanceRef = useRef(lastShieldDistance);
  const comboRef = useRef(combo);
  const highScoreRef = useRef(highScore);

  useEffect(() => { carXRef.current = carX; }, [carX]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { shieldActiveRef.current = shieldActive; }, [shieldActive]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { lastShieldDistanceRef.current = lastShieldDistance; }, [lastShieldDistance]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  // Speed and distance tracking
  useEffect(() => {
    if (!started || gameOver) return;
    const timer = setInterval(() => {
      const currentSpeed = shieldActiveRef.current ? speedRef.current * 1.5 : speedRef.current;
      setDistance(d => {
        const newDistance = d + currentSpeed;
        // Level up every 150m, max level 10
        const newLevel = Math.min(10, Math.floor(newDistance / 150) + 1);
        setLevel(newLevel);
        
        // Speed increases every 300m (very gradual)
        const speedMilestone = Math.floor(newDistance / 300);
        const previousMilestone = Math.floor(d / 300);
        if (speedMilestone > previousMilestone) {
          setSpeed(s => Math.min(4, s + 0.2));
        }
        
        return newDistance;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [started, gameOver]);

  // Combo decay
  useEffect(() => {
    if (combo > 0 && started && !gameOver) {
      const timer = setTimeout(() => setCombo(0), 2000);
      return () => clearTimeout(timer);
    }
  }, [combo, started, gameOver]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver) return;

    const interval = setInterval(() => {
      const currentSpeed = shieldActiveRef.current ? speedRef.current * 1.5 : speedRef.current;
      const levelSpeed = 1 + (levelRef.current - 1) * 0.2; // Speed multiplier based on level
      
      // Animate road
      setRoadOffset(prev => (prev + currentSpeed * 3) % 100);

      // Move objects down
      setObjects(prev => {
        const updated = prev.map(o => o.hit ? o : { ...o, y: o.y + (2 * currentSpeed * levelSpeed) });
        updated.forEach(obj => {
          if (Math.abs(obj.x - carXRef.current) < 12 && obj.y > 75 && obj.y < 95 && !obj.hit) {
            if (obj.type === 'coin') {
              // Collect coin
              const points = 10 + (comboRef.current * 5);
              setScore(s => s + points);
              setCombo(c => {
                const newCombo = c + 1;
                setMaxCombo(m => Math.max(m, newCombo));
                return newCombo;
              });
              setShieldCharge(n => Math.min(100, n + 10));
              createParticles(carXRef.current, 85, '#fbbf24', 6);
              obj.hit = true;
            } else if (obj.type === 'shield') {
              // Collect shield boost
              setShieldCharge(100);
              setScore(s => s + 50);
              createParticles(carXRef.current, 85, '#00ffff', 8);
              obj.hit = true;
            } else if (obj.type === 'life') {
              // Collect life
              setLives(l => Math.min(5, l + 1));
              setScore(s => s + 100);
              createParticles(carXRef.current, 85, '#ff69b4', 10);
              obj.hit = true;
            } else if (obj.type === 'car' || obj.type === 'truck') {
              // Hit obstacle
              if (!shieldActiveRef.current) {
                setShake(15);
                setTimeout(() => setShake(0), 300);
                setCombo(0);
                setSpeed(s => Math.max(1, s - 0.5));
                setLives(l => {
                  const newLives = l - 1;
                  if (newLives <= 0) {
                    setGameOver(true);
                    // Update high score
                    setScore(currentScore => {
                      if (currentScore > highScoreRef.current) {
                        setHighScore(currentScore);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('turboShiftHighScore', currentScore.toString());
                        }
                      }
                      return currentScore;
                    });
                  }
                  return newLives;
                });
                createParticles(carXRef.current, 85, '#ff0000', 12);
              } else {
                // Destroy with shield
                setScore(s => s + 30);
                createParticles(carXRef.current, obj.y, '#00ffff', 10);
              }
              obj.hit = true;
            }
          }
        });
        
        return updated.filter(o => (!o.hit && o.y < 110) || (o.hit && o.y < 120));
      });

      // Spawn objects - more frequent at higher levels
      const spawnRate = 0.015 + (levelRef.current * 0.008) + currentSpeed * 0.003;
      if (Math.random() < spawnRate) {
        const rand = Math.random();
        let type: 'coin' | 'car' | 'shield' | 'truck' | 'life';
        
        // More cars/trucks at higher levels
        const carChance = 0.30 + (levelRef.current * 0.04); // Increases with level
        const truckChance = carChance + 0.15 + (levelRef.current * 0.02);
        const coinChance = Math.max(0.15, 0.40 - (levelRef.current * 0.02)); // Decreases with level
        
        // Shield spawning controlled by distance - approximately 1 per 100m
        const canSpawnShield = (distanceRef.current - lastShieldDistanceRef.current) >= 100;
        
        if (rand < coinChance) type = 'coin';
        else if (rand < coinChance + carChance) type = 'car';
        else if (rand < truckChance) type = 'truck';
        else if (rand < 0.99 && canSpawnShield) {
          type = 'shield';
          setLastShieldDistance(distanceRef.current);
        }
        else if (rand >= 0.99) type = 'life'; // 1% chance - extremely rare
        else type = 'car'; // Default to car if shield not available
        
        setObjects(prev => [...prev, {
          id: Date.now() + Math.random(),
          x: Math.random() * 70 + 15,
          y: -10,
          type
        }]);
      }

      // Update particles
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.3,
          life: p.life - 1
        }))
        .filter(p => p.life > 0)
      );
    }, 30);

    return () => clearInterval(interval);
  }, [started, gameOver]);

  const createParticles = (x: number, y: number, color: string, count: number) => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 1) * 3,
      color,
      life: 15 + Math.random() * 10
    }));
    setParticles(prev => [...prev, ...newParticles]);
  };

  const moveCar = (clientX: number, rect: DOMRect) => {
    requestAnimationFrame(() => {
      const x = ((clientX - rect.left) / rect.width) * 100;
      setCarX(Math.max(10, Math.min(90, x)));
    });
  };

  const activateShield = () => {
    if (shieldCharge >= 100 && !shieldActive) {
      setShieldActive(true);
      setShieldCharge(0);
      setTimeout(() => setShieldActive(false), 3000);
    }
  };

  const startGame = () => {
    setScore(0);
    setDistance(0);
    setLives(3);
    setCombo(0);
    setMaxCombo(0);
    setLevel(1);
    setSpeed(1);
    setCarX(50);
    setShieldActive(false);
    setShieldCharge(0);
    setLastShieldDistance(0);
    setGameOver(false);
    setStarted(true);
    setObjects([]);
    setParticles([]);
    setRoadOffset(0);
  };

  return (
    <div className="fixed inset-0 w-full h-full flex justify-center items-center bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      <div 
        className="w-full h-full md:w-[calc(90vh*0.5625)] md:h-[90vh] bg-gradient-to-b from-gray-900 via-gray-800 to-black md:rounded-3xl shadow-2xl p-3 md:p-4 flex flex-col text-white relative overflow-hidden"
        style={{
          transform: `translate(${shake * (Math.random() - 0.5)}px, ${shake * (Math.random() - 0.5)}px)`
        }}
      >
        {/* Header */}
        <div className="relative z-10 flex justify-between items-center mb-2 text-sm font-bold">
          <div className="flex flex-col gap-1">
            <div className="text-yellow-400 text-lg">💰 {score}</div>
            <div className="text-xs text-cyan-300">{Math.floor(distance)}m</div>
            <div className="text-xs text-purple-400">🎯 Level {level}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              {[...Array(lives)].map((_, i) => (
                <span key={i} className="text-red-500 text-sm">❤️</span>
              ))}
            </div>
            <div className="text-xs text-orange-400">🏁 {speed.toFixed(1)}x</div>
            {combo > 1 && (
              <div className="text-xs text-pink-400 animate-pulse">
                🔥 {combo}x
              </div>
            )}
          </div>
        </div>

        {/* Shield Bar */}
        {started && !gameOver && (
          <div className="relative z-10 mb-2">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${shieldCharge >= 100 ? 'bg-cyan-400 animate-pulse' : 'bg-blue-500'}`}
                style={{ width: `${shieldCharge}%` }}
              />
            </div>
            {shieldCharge >= 100 && (
              <div className="absolute -top-1 right-0 text-xs text-cyan-400 animate-bounce">
                🛡️ READY!
              </div>
            )}
          </div>
        )}

        {/* Game Area */}
        <div 
          className={`flex-1 relative rounded-2xl overflow-hidden border-4 transition-all duration-300 ${
            shieldActive 
              ? 'border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.9)]'
              : 'border-gray-700'
          }`}
          style={{
            background: shieldActive 
              ? 'linear-gradient(180deg, #134e4a 0%, #0f766e 50%, #134e4a 100%)'
              : 'linear-gradient(180deg, #1e293b 0%, #334155 50%, #1e293b 100%)'
          }}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={(e) => {
            if (started && !gameOver && isDragging) {
              moveCar(e.clientX, e.currentTarget.getBoundingClientRect());
            }
          }}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          onTouchMove={(e) => {
            if (started && !gameOver && e.touches[0]) {
              e.preventDefault();
              moveCar(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
            }
          }}
          onClick={(e) => {
            if (started && !gameOver && shieldCharge >= 100) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * 100;
              if (clickX > 40 && clickX < 60) {
                activateShield();
              }
            }
          }}
        >
          {/* Road markings */}
          <div className="absolute inset-0 flex justify-around px-4">
            {/* Left lane line */}
            <div 
              className="w-1 h-full bg-white/30"
              style={{
                backgroundImage: 'linear-gradient(to bottom, white 40%, transparent 40%, transparent 60%, white 60%)',
                backgroundSize: '100% 30px',
                backgroundPosition: `0 ${roadOffset}%`
              }}
            />
            {/* Right lane line */}
            <div 
              className="w-1 h-full bg-white/30"
              style={{
                backgroundImage: 'linear-gradient(to bottom, white 40%, transparent 40%, transparent 60%, white 60%)',
                backgroundSize: '100% 30px',
                backgroundPosition: `0 ${roadOffset}%`
              }}
            />
          </div>

          {/* Speed lines when shield active */}
          {shieldActive && (
            <div className="absolute inset-0 opacity-40">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"
                  style={{
                    top: `${(i * 6 + roadOffset) % 100}%`,
                    animationDelay: `${i * 0.05}s`
                  }}
                />
              ))}
            </div>
          )}

          {started && !gameOver && (
            <>
              {/* Player Car - Facing Up */}
              <div
                className="absolute bottom-[10%] transition-all duration-100"
                style={{
                  left: `${carX}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                <div 
                  className={`text-5xl ${shieldActive ? 'animate-pulse scale-110' : ''}`}
                  style={{
                    transform: 'rotate(90deg)',
                    filter: shieldActive 
                      ? 'drop-shadow(0 0 20px #00ffff) brightness(1.3)'
                      : `drop-shadow(0 0 15px #3b82f6)`
                  }}
                >
                  🏎️
                </div>
                {shieldActive && (
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-400 animate-ping" 
                       style={{ width: '60px', height: '60px', left: '-5px', top: '-5px' }} />
                )}
              </div>

              {/* Particles */}
              {particles.map(p => (
                <div
                  key={p.id}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    backgroundColor: p.color,
                    opacity: p.life / 25,
                    boxShadow: `0 0 8px ${p.color}`
                  }}
                />
              ))}

              {/* Objects */}
              {objects.map(obj => (
                <div
                  key={obj.id}
                  className={`absolute transition-opacity duration-300 ${obj.hit ? 'opacity-0 scale-150' : 'opacity-100'}`}
                  style={{
                    left: `${obj.x}%`,
                    top: `${obj.y}%`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {/* Shadow effect */}
                  <div className="absolute w-12 h-3 bg-black/30 rounded-full blur-sm" 
                       style={{ bottom: '-8px', left: '50%', transform: 'translateX(-50%)' }} />
                  {obj.type === 'coin' && (
                    <div className="text-3xl animate-spin" style={{ animationDuration: '1s' }}>
                      🪙
                    </div>
                  )}
                  {obj.type === 'shield' && (
                    <div className="text-3xl animate-bounce">
                      🛡️
                    </div>
                  )}
                  {obj.type === 'life' && (
                    <div className="text-3xl animate-pulse" style={{ filter: 'drop-shadow(0 0 10px #ff69b4)' }}>
                      ❤️
                    </div>
                  )}
                  {obj.type === 'car' && (
                    <div className="text-4xl" style={{ filter: 'drop-shadow(0 0 10px #ff0000)', transform: 'rotate(-90deg)' }}>
                      🚗
                    </div>
                  )}
                  {obj.type === 'truck' && (
                    <div className="text-5xl" style={{ filter: 'drop-shadow(0 0 10px #ff4500)', transform: 'rotate(-90deg)' }}>
                      🚚
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {!started && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-black/80 backdrop-blur-sm">
              <div className="text-7xl mb-4 animate-bounce">🏁</div>
              <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 bg-clip-text text-transparent">
                TURBO SHIFT
              </h2>
              {highScore > 0 && (
                <div className="mb-2 text-sm">
                  <span className="text-gray-400">High Score: </span>
                  <span className="text-yellow-400 font-bold">🏆 {highScore}</span>
                </div>
              )}
              <p className="text-sm opacity-90 mb-4 max-w-xs leading-relaxed">
                Dodge traffic, collect coins, and survive! Drag your car to move!
              </p>
              <div className="text-xs mb-6 space-y-1 bg-black/50 p-3 rounded-lg">
                <div>👆 Drag car left/right to move</div>
                <div>🪙 Collect coins for points & shield</div>
                <div>🛡️ Full shield bar = click center to activate!</div>
                <div>❤️ Collect rare hearts for extra lives (max 5)</div>
                <div>🚗🚚 Avoid traffic or lose lives!</div>
                <div>🔥 Chain coins for combo multiplier!</div>
              </div>
              <button
                onClick={startGame}
                className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 text-white font-bold px-8 py-4 rounded-full shadow-lg active:scale-95 transition-all animate-pulse"
              >
                🚀 START RACE
              </button>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-black/90 backdrop-blur">
              <div className="text-6xl mb-4">💥</div>
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                RACE OVER!
              </h2>
              <div className="mb-6 space-y-2">
                <p className="text-3xl font-bold text-yellow-400">💰 {score}</p>
                {score > highScore && score > 0 && (
                  <p className="text-sm font-bold text-green-400 animate-pulse">🎉 NEW HIGH SCORE! 🎉</p>
                )}
                {highScore > 0 && score <= highScore && (
                  <p className="text-xs text-gray-400">High Score: 🏆 {highScore}</p>
                )}
                <p className="text-sm text-gray-300">Distance: <span className="font-bold text-cyan-400">{Math.floor(distance)}m</span></p>
                <p className="text-sm text-gray-300">Level Reached: <span className="font-bold text-purple-400">🎯 {level}</span></p>
                <p className="text-sm text-gray-300">Max Combo: <span className="font-bold text-orange-400">{maxCombo}x</span></p>
                <p className="text-sm text-gray-300">Top Speed: <span className="font-bold text-pink-400">{speed.toFixed(1)}x</span></p>
              </div>
              <button
                onClick={startGame}
                className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-bold px-8 py-3 rounded-full shadow-lg active:scale-95 transition-transform"
              >
                🔄 RACE AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Controls hint */}
        <div className="relative z-10 mt-3 text-center text-xs opacity-70">
          {started && !gameOver ? (
            <span>� Drag car to move • {shieldCharge >= 100 ? '🛡️ Click center for SHIELD!' : '🛡️ Collect coins for shield'}</span>
          ) : (
            <span>🏎️ Drag to dodge • Shield protects you • Collect hearts!</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const HomeView = GameSandbox;
