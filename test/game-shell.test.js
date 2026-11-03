import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('game is a standalone application without website article framing',async()=>{
  const html=await readFile(new URL('../game.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/class="site-header"|class="site-footer"|class="game-intro|data-hud=|data-finance/);
  assert.match(html,/data-fullscreen/);assert.match(html,/data-budget-open/);
  assert.match(html,/data-map-zoom-in/);assert.match(html,/data-map-zoom-out/);assert.match(html,/data-map-fit/);
  const styles=await readFile(new URL('../game-shell.css',import.meta.url),'utf8');
  assert.match(styles,/\.game-frame\s*\{[^}]*max-width:none/);
  assert.match(styles,/\.map-scroll\s*\{[^}]*touch-action:none/);
  for(const field of ['cashflow-net','cashflow-in','cashflow-in-detail','cashflow-out','cashflow-out-detail','cashflow-latest-amount','cashflow-latest-detail'])assert.match(html,new RegExp(`data-${field}`));
  assert.match(html,/Full ledger/);assert.match(html,/Weekly money in/);assert.match(html,/Weekly money out/);assert.match(html,/Latest one-time movement/);
  const left=html.match(/<aside class="game-stats"[^>]*>([\s\S]*?)<\/aside>/)[1];
  assert.ok(left.indexOf('Threat watch')<left.indexOf('Funding desk'));
  assert.doesNotMatch(left,/Weekly budget|Calendar/);
  const right=html.match(/<aside class="game-sidebar"[^>]*>([\s\S]*?)<\/aside>/)[1];
  assert.ok(right.indexOf('Local programs')<right.indexOf('Bring the population back'));
  const map=html.indexOf('id="game-map"'),controls=html.indexOf('class="hud-controls"'),mission=html.indexOf('class="mission-strip"'),tutorial=html.indexOf('class="tutorial-panel"');
  assert.ok(map<controls&&controls<mission&&mission<tutorial);
  assert.match(html,/data-leaderboard-scope/);assert.match(html,/data-interest-form/);
  assert.match(html,/name="adultConfirmed" type="checkbox" required/);
  assert.match(html,/name="outreachConsent" type="checkbox" required/);
  assert.doesNotMatch(html,/data-request-code|data-online-form|data-verify-code/);
  assert.match(html,/Unverified|unverified/);
});
test('game introduction launches a separate tab and publishes explicit difficulty modifiers',async()=>{
  const html=await readFile(new URL('../game-about.html',import.meta.url),'utf8');
  assert.match(html,/href="game.html" target="_blank" rel="noopener"/);
  assert.match(html,/data-mode-table/);
  assert.match(html,/minimum of 81 weeks/);
  assert.match(html,/no automatic cash rescues/i);
});
