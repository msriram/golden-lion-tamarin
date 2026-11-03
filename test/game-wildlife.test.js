import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,applyTool,simulateOneWeek,getTamarinPosition,PATCHES} from '../js/game-core.js';

function advance(state,weeks){
  state={...state,paused:false};
  for(let week=0;week<weeks;week+=1)state=simulateOneWeek(state);
  return state;
}
function openBridge(state,routeId){
  state=applyTool(state,'agreement',routeId).state;state=advance(state,12);
  state=applyTool(state,'bridge',routeId).state;return advance(state,16);
}
test('monkey is hidden initially and throughout negotiation and construction',async()=>{
  let state=createInitialState();
  assert.equal(getTamarinPosition(state),null);
  state=applyTool(state,'agreement','cf').state;state=advance(state,12);
  assert.equal(getTamarinPosition(state),null);
  state=applyTool(state,'bridge','cf').state;state=advance(state,15);
  assert.equal(getTamarinPosition(state),null);
  const html=await readFile(new URL('../game.html',import.meta.url),'utf8');
  assert.match(html,/data-tamarin[^>]* hidden/);
});
test('first completed bridge spawns a midpoint monkey that travels between its groves',()=>{
  let state=openBridge(createInitialState(),'cf');
  const bridge=state.links.find(link=>link.id==='cf');
  assert.equal(bridge.bridgeOpenedWeek,state.totalWeeks);
  const from=PATCHES.find(patch=>patch.id===bridge.from),to=PATCHES.find(patch=>patch.id===bridge.to);
  assert.deepEqual(getTamarinPosition(state),{routeId:'cf',x:(from.x+to.x)/2,y:(from.y+to.y)/2});
  state=advance(state,4);
  assert.deepEqual(getTamarinPosition(state),{routeId:'cf',x:to.x,y:to.y});
  state=advance(state,8);
  assert.deepEqual(getTamarinPosition(state),{routeId:'cf',x:from.x,y:from.y});
  state=advance(state,4);
  assert.equal(getTamarinPosition(state).y,(from.y+to.y)/2);
});
test('later bridges do not redirect the monkey toward West reserve; closed bridges hide it',()=>{
  let state=createInitialState();state.balanceFC=100000;
  state=openBridge(state,'cf');state=openBridge(state,'ab');
  assert.equal(getTamarinPosition(state).routeId,'cf');
  assert.equal(getTamarinPosition(JSON.parse(JSON.stringify(state))).routeId,'cf');
  const first=state.links.find(link=>link.id==='cf');first.condition=44;
  assert.equal(getTamarinPosition(state),null);
  first.condition=100;assert.equal(getTamarinPosition(state).routeId,'cf');
  assert.equal(getTamarinPosition(createInitialState()),null);
});
test('older saves with an open bridge remain playable without completion timestamps',()=>{
  const state=createInitialState(),bridge=state.links.find(link=>link.id==='ef');
  bridge.built=true;bridge.agreement=true;
  const position=getTamarinPosition(state);
  assert.equal(position.routeId,'ef');assert.ok(Number.isFinite(position.x)&&Number.isFinite(position.y));
});
