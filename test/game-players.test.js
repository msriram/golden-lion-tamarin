import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerStore,normalizeNickname,rankScores} from '../js/game-players.js';
import {createInitialState} from '../js/game-core.js';

function storage(){const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function win(){const state=createInitialState(73,'standard');state.campaignId='one-campaign';state.status='won';state.totalWeeks=500;for(const patch of state.patches)patch.population=1800;return state;}

test('nicknames exclude emails and markup and normalize spacing',()=>{
  assert.equal(normalizeNickname('  Forest   friend  '),'Forest friend');
  for(const value of ['a','a@b.com','<script>','a'.repeat(25),'bad\u0000name'])assert.throws(()=>normalizeNickname(value));
});
test('local profiles keep independent saves and can switch back',()=>{
  const local=storage(),players=createPlayerStore(local),guest=createInitialState();
  players.saveCampaign(guest);
  const first=players.useNickname('Forest friend');players.saveCampaign({...guest,totalWeeks:10});
  players.useNickname('Tree friend');assert.equal(players.loadCampaign(),null);
  players.select(first.id);assert.equal(players.loadCampaign().totalWeeks,10);
  players.select('guest');assert.equal(players.loadCampaign().totalWeeks,0);
  assert.equal(createPlayerStore(local).current().id,'guest');
});
test('finished campaigns are recorded once and delete removes the player data',()=>{
  const players=createPlayerStore(storage());players.useNickname('Tree friend');players.saveCampaign(win());
  players.recordScore(win());players.recordScore(win());assert.equal(players.scores().length,1);
  players.deleteCurrent();assert.equal(players.scores().length,0);assert.equal(players.profiles().length,0);assert.equal(players.current().id,'guest');
});
test('only actual terminal population outcomes qualify for leaderboard',()=>{
  const players=createPlayerStore(storage()),state=win();state.patches[0].population=0;
  assert.equal(players.recordScore(state),null);
  state.status='playing';assert.equal(players.recordScore(state),null);
});
test('leaderboard separates difficulty, wins, completion time and funds',()=>{
  const entries=[
    {id:'a',difficulty:'standard',status:'won',weeks:700,funds:100,population:10000},
    {id:'b',difficulty:'standard',status:'won',weeks:600,funds:200,population:10000},
    {id:'c',difficulty:'standard',status:'won',weeks:600,funds:300,population:10000},
    {id:'d',difficulty:'standard',status:'lost-population',weeks:900,funds:900,population:900},
    {id:'e',difficulty:'tutorial',status:'won',weeks:100,funds:999,population:10000}
  ];
  assert.deepEqual(rankScores(entries,'standard').map(entry=>entry.id),['c','b','a','d']);
  assert.equal(entries[0].id,'a');
});
test('blocked browser storage still supports this session without crashing',()=>{
  const players=createPlayerStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
  players.useNickname('Forest friend');players.saveCampaign(win());
  assert.equal(players.loadCampaign().totalWeeks,500);assert.equal(players.persistent,false);
});
test('nickname profiles stay local and matching names do not create duplicate records',()=>{
  const players=createPlayerStore(storage());
  const local=players.useNickname('Forest Friend');players.saveCampaign({...win(),totalWeeks:500});
  assert.equal(players.useNickname('forest friend').id,local.id);
  assert.equal(players.loadCampaign().totalWeeks,500);
  assert.equal(players.profiles().length,1);
  assert.deepEqual(Object.keys(players.current()).sort(),['id','nickname']);
});
