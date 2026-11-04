export interface HighScore { name: string; score: number; date: string }
const KEY = 'nokia-snake-highscores';
export function loadScores(): HighScore[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is HighScore => s && typeof s.name === 'string' && s.name.length <= 8 &&
      Number.isSafeInteger(s.score) && s.score > 0 && typeof s.date === 'string' && s.date.length <= 40)
      .sort((a,b) => b.score-a.score).slice(0,8);
  } catch { return []; }
}
export function loadName(): string {
  try { return (localStorage.getItem('nokia-snake-name') || 'YOU').slice(0,8); } catch { return 'YOU'; }
}
export function saveName(name: string): boolean {
  try { localStorage.setItem('nokia-snake-name', name); return true; } catch { return false; }
}
export function saveScores(scores: HighScore[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(scores)); return true; } catch { return false; }
}
