import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnakeEngine, COLS, ROWS, type Vec } from '../src/game/engine.ts';
import { loadScores, loadName, saveScores } from '../src/game/scores.ts';

Object.assign(globalThis, { window: { devicePixelRatio: 1 }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
const noop = () => {};
function game(t: any) {
  const events: [string, number][] = [];
  const canvas = { style: {}, parentElement: { clientWidth: 400, clientHeight: 400 }, getContext: () => new Proxy({}, { get: () => noop }) };
  const e = new SnakeEngine(canvas as any, { onScore: s => events.push(['score',s]), onWin: s => events.push(['win',s]), onGameOver: s => events.push(['dead',s]) });
  e.start(); t.after(() => e.destroy()); return { e, events };
}
function almostFull(e: SnakeEngine) {
  const path: Vec[] = [];
  for (let y=0;y<ROWS;y++) for (let n=0;n<COLS;n++) path.push({x:y%2 ? COLS-1-n : n,y});
  e.food = path.pop()!; e.snake = path.reverse(); e.prevSnake = [...e.snake]; e.dir = 'left';
}
test('final food fills all 400 cells, awards score before a single win and renders without food', t => {
  const {e,events}=game(t); almostFull(e); e.step();
  assert.equal(e.snake.length,400); assert.equal(e.won,true); assert.equal(e.running,false); assert.equal(e.food,null);
  assert.deepEqual(events,[['score',10],['win',10]]); e.step(); e.die(); e.draw();
  assert.equal(events.length,2); e.start(); assert.equal(e.won,false); assert.equal(e.snake.length,3);
});
test('bonus yields the only free cell to food', t => {
  const {e}=game(t); almostFull(e); const pos=e.food!;
  e.bonus={pos,ttl:40,max:40,type:'points'}; e.spawnFood(); assert.deepEqual(e.food,pos); assert.equal(e.bonus,null);
});
test('food never overlaps body or bonus over repeated spawns', t => {
  const {e}=game(t); e.bonus={pos:{x:0,y:0},ttl:40,max:40,type:'points'};
  for(let i=0;i<100;i++){e.spawnFood();assert.ok(e.food); assert.ok(!e.snake.some(s=>s.x===e.food!.x&&s.y===e.food!.y));assert.notDeepEqual(e.food,e.bonus.pos);}
});
test('moving into the departing tail is legal; another body cell is fatal', t => {
  const {e}=game(t); e.snake=[{x:1,y:1},{x:1,y:2},{x:0,y:2},{x:0,y:1}];e.dir='left';e.food={x:10,y:10};e.step();assert.equal(e.dead,false);
  e.snake=[{x:1,y:1},{x:1,y:2},{x:0,y:2},{x:0,y:1}];e.dir='down';e.step();assert.equal(e.dead,true);
});
test('wall death callback runs only once', t => {
  t.mock.timers.enable({apis:['setTimeout']});const {e,events}=game(t);e.snake=[{x:19,y:0}];e.dir='right';e.step();e.die();e.step();t.mock.timers.tick(1000);assert.deepEqual(events,[['dead',0]]);
});
test('restart cancels previous death and restores combo, speed, and timers', t => {
  t.mock.timers.enable({apis:['setTimeout']});const {e,events}=game(t); e.die(); e.slowTime=100;e.lastEatTime=performance.now();e.combo=8;e.start();
  assert.equal(e.slowTime,0);assert.equal(e.tickMs,143.4);assert.equal(e.lastEatTime,-Infinity);t.mock.timers.tick(1000);assert.equal(e.running,true);assert.deepEqual(events,[]);
  e.food={x:6,y:10};e.step();assert.deepEqual(events,[['score',10]]);
});
test('destroy cancels terminal callbacks and cannot be restarted', t => {
  t.mock.timers.enable({apis:['setTimeout']});const {e,events}=game(t);e.die();e.destroy();t.mock.timers.tick(1000);e.start();e.step();assert.deepEqual(events,[]);assert.equal(e.running,false);
});
test('direction queue prevents reversal and is bounded; paused steps do nothing', t => {
  const {e}=game(t);e.setDir('left');assert.deepEqual(e.queue,[]);e.setDir('up');e.setDir('down');e.setDir('left');e.setDir('down');assert.deepEqual(e.queue,['up','left']);
  e.paused=true;const before=JSON.stringify(e.snake);e.step();assert.equal(JSON.stringify(e.snake),before);assert.equal(e.queue.length,2);
});
test('malformed saved scores are discarded and valid scores sorted', () => {
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify([{name:'A',score:10,date:'now'},{name:'B',score:30,date:'now'},null,{name:'X',score:'90',date:''}])}});
  assert.deepEqual(loadScores().map(s=>s.score),[30,10]);Object.assign(globalThis,{localStorage:{getItem:()=>'{}'}});assert.deepEqual(loadScores(),[]);
});
test('unavailable device storage never prevents play', () => {
  Object.assign(globalThis,{localStorage:{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}}});
  assert.deepEqual(loadScores(),[]);assert.equal(loadName(),'YOU');assert.equal(saveScores([]),false);
});
