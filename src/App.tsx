import { useCallback, useEffect, useRef, useState } from 'react';
import { SnakeEngine, type Dir } from './game/engine';

type Screen = 'start' | 'playing' | 'paused' | 'gameover';
interface HighScore { name: string; score: number; date: string; }
const HS_KEY = 'nokia-snake-highscores';

function loadScores(): HighScore[] {
  try { return JSON.parse(localStorage.getItem(HS_KEY) || '[]'); } catch { return []; }
}
function saveScores(s: HighScore[]) { localStorage.setItem(HS_KEY, JSON.stringify(s)); }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const screenRef = useRef<Screen>('start');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [scoreBump, setScoreBump] = useState(0);
  const [scores, setScores] = useState<HighScore[]>(loadScores);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('nokia-snake-name') || 'YOU');
  const [muted, setMuted] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const go = (s: Screen) => { screenRef.current = s; setScreen(s); };
  const best = scores[0]?.score ?? 0;

  useEffect(() => {
    if (!canvasRef.current) return;
    const eng = new SnakeEngine(canvasRef.current, {
      onScore: (s, c) => { setScore(s); setCombo(c); setScoreBump(b => b + 1); },
      onGameOver: (s) => {
        setFinalScore(s);
        const prev = loadScores();
        setIsNewBest(s > 0 && (prev.length === 0 || s > prev[0].score));
        go('gameover');
      },
    });
    engineRef.current = eng;
    const onResize = () => eng.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); eng.destroy(); };
  }, []);

  const startGame = useCallback(() => {
    const e = engineRef.current; if (!e) return;
    e.start();
    setScore(0); setCombo(0);
    go('playing');
  }, []);

  const togglePause = useCallback(() => {
    const e = engineRef.current; if (!e) return;
    if (screenRef.current === 'playing') { e.togglePause(); go('paused'); }
    else if (screenRef.current === 'paused') { e.togglePause(); go('playing'); }
  }, []);

  const submitScore = useCallback(() => {
    if (finalScore <= 0) return;
    const nm = (name.trim() || 'YOU').toUpperCase().slice(0, 8);
    localStorage.setItem('nokia-snake-name', nm);
    const next = [...loadScores(), { name: nm, score: finalScore, date: new Date().toLocaleDateString() }]
      .sort((a, b) => b.score - a.score).slice(0, 8);
    saveScores(next);
    setScores(next);
  }, [finalScore, name]);

  // Save score automatically when game over
  useEffect(() => { if (screen === 'gameover') submitScore(); // eslint-disable-next-line
  }, [screen]);

  // Keyboard
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
    };
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current; if (!eng) return;
      const sc = screenRef.current;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (sc === 'start' || sc === 'gameover') startGame();
        else togglePause();
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { togglePause(); return; }
      if (e.key === 'r' || e.key === 'R') { startGame(); return; }
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        if (sc === 'start' || sc === 'gameover') { startGame(); engineRef.current?.setDir(d); }
        else if (sc === 'paused') { togglePause(); eng.setDir(d); }
        else eng.setDir(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startGame, togglePause]);

  // Auto-pause on tab hide
  useEffect(() => {
    const onVis = () => { if (document.hidden && screenRef.current === 'playing') togglePause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [togglePause]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x, dy = t.clientY - touchStart.current.y;
    if (Math.hypot(dx, dy) < 18) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    engineRef.current?.setDir(d);
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = () => { touchStart.current = null; };

  const dpad = (d: Dir) => {
    engineRef.current?.ensureAudio();
    if (screenRef.current === 'paused') togglePause();
    engineRef.current?.setDir(d);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 select-none font-pixel"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #2a2f36 0%, #14171b 60%, #0a0c0e 100%)' }}>
      {/* Phone shell */}
      <div className="relative w-full max-w-[440px] rounded-[40px] px-5 pt-5 pb-6 shadow-2xl"
        style={{ background: 'linear-gradient(160deg,#3d4450,#1d2127 60%,#14171b)', boxShadow: '0 30px 80px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.12), inset 0 -2px 0 rgba(0,0,0,.6)' }}>
        <div className="text-center text-[10px] tracking-[0.35em] text-slate-400 mb-3">NOKIA</div>

        {/* HUD */}
        <div className="flex justify-between items-end px-1 mb-2 text-[11px] text-lime-200/80">
          <div>
            <div className="text-[8px] text-slate-400">SCORE</div>
            <div key={scoreBump} className="text-xl text-lime-300 animate-bump">{score.toString().padStart(4, '0')}</div>
          </div>
          <div className={`text-[9px] transition-opacity duration-200 ${combo > 1 && screen === 'playing' ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-yellow-300 animate-pulse">COMBO x{Math.min(combo, 5)}</span>
          </div>
          <div className="text-right">
            <div className="text-[8px] text-slate-400">BEST</div>
            <div className="text-xl text-lime-300/70">{Math.max(best, score).toString().padStart(4, '0')}</div>
          </div>
        </div>

        {/* LCD screen */}
        <div className="relative rounded-xl overflow-hidden" style={{ boxShadow: 'inset 0 4px 14px rgba(0,0,0,.6), 0 0 0 4px #0b0d10, 0 0 0 6px #3a414b' }}>
          <div className="aspect-square w-full bg-[#9bbc0f] relative"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            onClick={() => { if (screen === 'playing') togglePause(); }}>
            <canvas ref={canvasRef} className="block touch-none" />
            {/* scanline overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-30"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(15,56,15,.15) 0 1px, transparent 1px 3px)' }} />
            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.12), transparent 40%)' }} />

            {/* Overlays */}
            {screen === 'start' && (
              <Overlay>
                <div className="text-[#0f380f] text-2xl sm:text-3xl mb-1 animate-wiggle">SNAKE</div>
                <div className="text-[#306230] text-[9px] mb-3">II · 3310 EDITION</div>
                <div className="flex flex-col items-center gap-1 mb-4">
                  <div className="text-[#0f380f] text-[8px]">PLAYER NAME</div>
                  <input value={name} maxLength={8} placeholder="YOU"
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setName(val);
                      localStorage.setItem('nokia-snake-name', val.trim() || 'YOU');
                    }}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') startGame(); }}
                    className="bg-[#9bbc0f] border-2 border-[#0f380f] text-[#0f380f] text-[10px] p-1 w-24 text-center outline-none uppercase placeholder:text-[#306230]/50 focus:bg-[#a7c93a]" />
                </div>
                <button onClick={startGame} className="pixel-btn animate-blink">▶ PRESS START</button>
                <div className="text-[#306230] text-[8px] mt-4 leading-relaxed">
                  ARROWS / WASD · SWIPE<br />SPACE PAUSE · R RESTART
                </div>
                {scores.length > 0 && <ScoreTable scores={scores.slice(0, 3)} />}
              </Overlay>
            )}
            {screen === 'paused' && (
              <Overlay>
                <div className="text-[#0f380f] text-2xl mb-4">PAUSED</div>
                <button onClick={togglePause} className="pixel-btn">RESUME</button>
                <button onClick={startGame} className="pixel-btn mt-2 text-[9px]">RESTART</button>
              </Overlay>
            )}
            {screen === 'gameover' && (
              <Overlay>
                <div className="text-[#0f380f] text-xl mb-1 animate-shake">GAME OVER</div>
                {isNewBest && <div className="text-[#0f380f] text-[10px] mb-1 animate-blink">★ NEW HIGH SCORE ★</div>}
                <div className="text-[#0f380f] text-3xl my-2">{finalScore}</div>
                <div className="flex items-center gap-2 mb-3">
                  <input value={name} maxLength={8}
                    onChange={e => setName(e.target.value.toUpperCase())}
                    onBlur={() => { const next = loadScores(); const idx = next.findIndex(s => s.score === finalScore); if (idx >= 0) { next[idx].name = (name.trim() || 'YOU').toUpperCase().slice(0, 8); saveScores(next); setScores(next); localStorage.setItem('nokia-snake-name', next[idx].name); } }}
                    onKeyDown={e => e.stopPropagation()}
                    className="bg-transparent border-b-2 border-[#0f380f] text-[#0f380f] text-[10px] w-24 text-center outline-none uppercase" />
                </div>
                <button onClick={startGame} className="pixel-btn animate-blink">↻ PLAY AGAIN</button>
                <ScoreTable scores={scores.slice(0, 5)} highlight={finalScore} />
              </Overlay>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between mt-4 px-1">
          <button onClick={() => { setMuted(m => { if (engineRef.current) engineRef.current.muted = !m; return !m; }); }}
            className="soft-key">{muted ? 'MUTE' : 'SND'}</button>
          <button onClick={() => screen === 'playing' || screen === 'paused' ? togglePause() : startGame()} className="soft-key">
            {screen === 'playing' ? 'PAUSE' : screen === 'paused' ? 'RESUME' : 'START'}
          </button>
          <button onClick={startGame} className="soft-key">RESTART</button>
        </div>

        {/* D-Pad (touch) */}
        <div className="grid grid-cols-3 gap-1 w-44 mx-auto mt-4">
          <div />
          <DBtn label="▲" onPress={() => dpad('up')} />
          <div />
          <DBtn label="◀" onPress={() => dpad('left')} />
          <div className="rounded-full bg-black/40 shadow-inner" />
          <DBtn label="▶" onPress={() => dpad('right')} />
          <div />
          <DBtn label="▼" onPress={() => dpad('down')} />
          <div />
        </div>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 animate-fadein"
      style={{ background: 'rgba(155,188,15,0.88)' }}>
      {children}
    </div>
  );
}

function DBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className="h-14 rounded-xl text-slate-200 text-lg active:scale-90 active:bg-slate-600 transition-transform touch-none"
      style={{ background: 'linear-gradient(180deg,#4a525e,#2b3038)', boxShadow: '0 4px 0 #14171b, inset 0 1px 0 rgba(255,255,255,.15)' }}>
      {label}
    </button>
  );
}

function ScoreTable({ scores, highlight }: { scores: HighScore[]; highlight?: number }) {
  return (
    <div className="mt-4 w-full max-w-[220px] text-[8px] text-[#0f380f]">
      <div className="border-b-2 border-[#0f380f] pb-1 mb-1 text-[9px]">HIGH SCORES</div>
      {scores.map((s, i) => (
        <div key={i} className={`flex justify-between py-[2px] ${highlight === s.score ? 'bg-[#0f380f] text-[#9bbc0f] px-1' : ''}`}>
          <span>{i + 1}. {s.name}</span><span>{s.score}</span>
        </div>
      ))}
    </div>
  );
}
