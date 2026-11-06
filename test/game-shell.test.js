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
  assert.doesNotMatch(html,/data-cashflow|class="game-stats"|class="game-sidebar"|data-tool=/);
  assert.equal((html.match(/data-route-action=/g)||[]).length,5);
  assert.equal((html.match(/data-fundraiser=/g)||[]).length,5);
  assert.equal((html.match(/data-service=/g)||[]).length,5);
  assert.match(html,/data-command-rail="funding"/);assert.match(html,/data-command-rail="programs"/);
  for(const panel of ['threat','season','wildlife','goals','events','advice','map']){
    assert.match(html,new RegExp(`data-status-toggle="${panel}"`));
    assert.match(html,new RegExp(`data-status-panel="${panel}"`));
  }
  assert.match(styles,/\.map-command-rail\.expanded/);assert.match(styles,/\.status-drawer\[hidden\]/);
  assert.match(styles,/\.selection-panel\s*\{[^}]*position:absolute/);
  const map=html.indexOf('id="game-map"'),controls=html.indexOf('class="hud-controls"'),mission=html.indexOf('class="mission-strip"'),tutorial=html.indexOf('class="tutorial-panel"');
  assert.ok(map<controls&&controls<mission&&mission<tutorial);
  assert.match(html,/data-leaderboard-scope/);assert.match(html,/data-interest-form/);
  assert.match(html,/name="adultConfirmed" type="checkbox" required/);
  assert.match(html,/name="outreachConsent" type="checkbox" required/);
  assert.doesNotMatch(html,/data-request-code|data-online-form|data-verify-code/);
  assert.match(html,/Unverified|unverified/);
  for(const speed of [1,2,4,8,16,32])assert.match(html,new RegExp(`data-speed="${speed}"`));
  assert.match(html,/1× · 1 week every 8 seconds/);
});
test('game introduction launches a separate tab and publishes explicit difficulty modifiers',async()=>{
  const html=await readFile(new URL('../game-about.html',import.meta.url),'utf8');
  assert.match(html,/href="game.html" target="_blank" rel="noopener"/);
  assert.match(html,/data-mode-table/);
  assert.match(html,/minimum of 81 weeks/);
  assert.match(html,/no automatic cash rescues/i);
});
