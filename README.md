# Nokia 3310 Snake

A Nokia-inspired browser game with a 20 by 20 board, three themes and three difficulty levels. The combo and bonus rules are this game's own additions, not an exact recreation of the original phone game.

## Play

Use arrow keys or WASD, swipe, or the direction buttons. Space/P pauses or resumes; R restarts. Choose your theme, difficulty and player name before starting.

Eat food to grow. Each food awards 10 points multiplied by a quick-eating combo, capped at five. Bonus items award points or temporarily slow the snake. Hitting a wall or your body ends the run; filling all 400 cells wins. Moving into the departing tail is allowed.

Restart clears pending effects and callbacks from the previous run. Hiding the tab pauses play. Scores are saved on this device only; unavailable storage does not block play and a failed score save is shown on screen.

## Run locally

Requires Node.js 24 and npm.

```sh
git clone https://github.com/almuzahidseyam/nokia-3310-snake.git
cd nokia-3310-snake
npm ci
npm run dev
```

`npm run build` produces `dist/index.html`, including the game and its font. The built game does not need a font service or network requests to play. Press Start 2P is distributed under the SIL Open Font License by the bundled `@fontsource/press-start-2p` package.

## Verification

```sh
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm audit --audit-level=low
```

The browser script uses installed Chrome locally and Playwright Chromium in CI. Tests cover full-board victory, the last free cell, collision/tail rules, direction queues, pause, stale death callbacks, storage failures, mobile layout and actual canvas rendering. Windows/Linux CI runs these checks; deployment repeats checks before publishing. These checks do not establish accessibility for nonvisual gameplay: the board is still a visual canvas game.

MIT. See [LICENSE](LICENSE).
