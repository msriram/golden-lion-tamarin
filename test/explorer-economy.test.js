import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,simulateOneWeek,weeklyBudget,applyTool,toggleService} from '../js/game-core.js';

test('Explorer begins with a transparent surplus and no fundraising deadline',()=>{
  let state=createInitialState(73,'explorer');const budget=weeklyBudget(state);
  assert.equal(budget.cost,58);assert.equal(budget.support,140);assert.equal(budget.net,82);
  assert.equal(budget.income.find(line=>line.category==='Standing Explorer sponsor').scaledFC,130);
  for(let week=0;week<52;week+=1)state=simulateOneWeek({...state,paused:false});
  assert.ok(state.balanceFC>12000);assert.equal(state.shortfallWeeks,0);
  assert.equal(state.fundraisers.length,0);
  assert.equal(state.balanceFC,12000+state.ledger.reduce((sum,entry)=>sum+entry.amount,0));
  assert.equal(weeklyBudget(createInitialState(73,'challenge')).supportInputs.sponsorBaseFC,0);
});
test('a novice can fund one corridor, outreach and monitoring for four years without grants or bankruptcy',context=>{
  for(const seed of [1,7,42,73,917,2026]){
    let state=createInitialState(seed,'explorer'),minimum=12000;
    state=toggleService(state,'outreach').state;state=toggleService(state,'monitoring').state;
    state=applyTool(state,'agreement','cf').state;
    for(let week=0;week<208;week+=1){
      const route=state.links.find(link=>link.id==='cf');
      if(route.agreement&&!route.built&&!route.bridgeDue)state=applyTool(state,'bridge','cf').state;
      if(route.built&&!route.planted)state=applyTool(state,'restore','cf').state;
      state=simulateOneWeek({...state,paused:false});minimum=Math.min(minimum,state.balanceFC);
      assert.equal(state.lastFunded,true);
    }
    assert.ok(state.links.find(link=>link.id==='cf').planted);
    assert.ok(minimum>7000);assert.ok(state.balanceFC>12000);assert.equal(state.fundraisers.length,0);
    context.diagnostic(JSON.stringify({seed,minimum,closing:state.balanceFC}));
  }
});
