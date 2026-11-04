const {chromium}=require('playwright');
const fs=require('node:fs');const http=require('node:http');const assert=require('node:assert/strict');const ts=require('typescript');
(async()=>{
  const html=fs.readFileSync('dist/index.html');
  assert.ok(!html.includes('fonts.googleapis.com'));assert.ok(html.includes('data:font/woff2'));
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch(process.env.CI?{}:{channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];const remote=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:'))remote.push(r.url())});
    await page.addInitScript(()=>localStorage.setItem('nokia-snake-highscores','{}'));
    await page.goto(origin);await page.getByLabel('Theme',{exact:true}).selectOption('modern-light');
    await page.getByLabel('Player name').fill('TEST');await page.getByRole('button',{name:'PRESS START'}).click();
    await page.getByRole('button',{name:'PAUSE',exact:true}).waitFor();await page.getByRole('button',{name:'PAUSE',exact:true}).click();
    await page.getByText('PAUSED',{exact:true}).waitFor();await page.getByRole('button',{name:'RESUME',exact:true}).first().click();
    assert.equal(await page.getByText('PAUSED',{exact:true}).count(),0);
    // At medium speed the initial straight line hits the wall in ~2.2s.
    await page.waitForTimeout(2250);await page.getByRole('button',{name:'RESTART',exact:true}).click();await page.waitForTimeout(1100);
    assert.equal(await page.getByText('GAME OVER',{exact:true}).count(),0);
    await page.getByText('GAME OVER',{exact:true}).waitFor({timeout:6000});await page.getByRole('button',{name:'PLAY AGAIN'}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Run the actual engine on a real canvas with a deterministic near-complete board.
    const source=ts.transpileModule(fs.readFileSync('src/game/engine.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    await page.addScriptTag({content:`window.snakeModule={};(function(exports){${source}})(window.snakeModule);`});
    const result=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');document.body.append(canvas);const events=[];
      const e=new window.snakeModule.SnakeEngine(canvas,{onScore:s=>events.push(['score',s]),onWin:s=>events.push(['win',s]),onGameOver:s=>events.push(['dead',s])});
      e.start();const path=[];for(let y=0;y<20;y++)for(let n=0;n<20;n++)path.push({x:y%2?19-n:n,y});e.food=path.pop();e.snake=path.reverse();e.prevSnake=[...e.snake];e.dir='left';e.step();e.draw();e.step();const result={events,won:e.won,length:e.snake.length};e.destroy();canvas.remove();return result;
    });assert.deepEqual(result,{events:[['score',10],['win',10]],won:true,length:400});
    assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
    const blocked=await browser.newPage();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('disabled')}}));await blocked.goto(origin);await blocked.getByRole('button',{name:'PRESS START'}).click();await blocked.getByRole('button',{name:'PAUSE',exact:true}).waitFor();
    console.log('Browser checks passed: mobile, pause/resume, death/restart, real canvas win, offline fonts, corrupt/blocked storage.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
