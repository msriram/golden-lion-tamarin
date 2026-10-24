import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,simulateOneWeek,applyTool,applyAdversity,startFundraiser,toggleService,getMetrics,weeklyCost,reachable,TREE_MATURITY_WEEKS} from '../js/game-core.js';
import {runCampaign} from '../scripts/playtest.mjs';

function advance(state,weeks){state={...state,paused:false};for(let week=0;week<weeks;week+=1)state=simulateOneWeek(state);return state;}
test('idle management exhausts cash and eventually ends the program',()=>{
  const state=advance(createInitialState(),1000);
  assert.equal(state.balanceFC,0);assert.equal(state.status,'lost-population');
  assert.ok(getMetrics(state).population<1000);assert.ok(getMetrics(state).forestPercent<32);
});
test('outreach and monitoring add recurring costs and earn trust and evidence only when paid',()=>{
  let state=toggleService(createInitialState(),'outreach').state;
  state=toggleService(state,'monitoring').state;
  assert.equal(weeklyCost(state),182);
  state=advance(state,10);assert.ok(state.evidence>0);assert.ok(state.awareness>38);
  state.balanceFC=0;const trust=state.awareness,evidence=state.evidence;
  state.awareness=0;state=advance(state,1);assert.equal(state.evidence,evidence);assert.ok(state.awareness<trust);
});
test('insufficient funds and missing permission reject commands without mutating resources',()=>{
  const state=createInitialState();assert.equal(applyTool(state,'bridge','ab').ok,false);
  state.balanceFC=100;assert.equal(applyTool(state,'agreement','ab').ok,false);assert.equal(state.ledger.length,0);
});
test('bridge construction, delayed planting, and route-specific unlocks',()=>{
  let state=applyTool(createInitialState(),'agreement','ab').state;
  state=advance(state,12);assert.equal(state.links[0].agreement,true);
  state=applyTool(state,'bridge','ab').state;
  assert.equal(applyTool(state,'restore','ab').ok,false);
  state=advance(state,16);
  state.totalWeeks=52;
  assert.equal(applyTool(state,'restore','ab').ok,true);
  assert.equal(applyTool(state,'restore','ad').ok,false);
  assert.equal(reachable(state,'a').size,2);
  state=applyTool(state,'restore','ab').state;assert.equal(state.links[0].age,0);
  assert.ok(TREE_MATURITY_WEEKS>=208);
});
test('funding payout occurs once and cooldown prevents repeat-event exploits',()=>{
  let state=startFundraiser(createInitialState(),'presentation').state;
  assert.equal(startFundraiser(state,'artShow').ok,false);
  state=advance(state,8);
  assert.equal(state.ledger.filter(entry=>entry.category==='School outreach'&&entry.amount>0).length,1);
  assert.equal(startFundraiser(state,'presentation').ok,false);
  state=advance(state,2);assert.equal(state.ledger.filter(entry=>entry.category==='School outreach'&&entry.amount>0).length,1);
});
test('year-end accounting matches ledger with no duplicate deductions',()=>{
  const state=advance(createInitialState(),52),report=state.annualReports[0];
  assert.equal(report.opening+report.income-report.expenses,report.closing);
  assert.equal(state.ledger.reduce((sum,entry)=>sum+entry.amount,12000),state.balanceFC);
});
test('same seed and commands replay identically',()=>{
  assert.deepEqual(advance(createInitialState(42),100),advance(createInitialState(42),100));
});
test('a terminal game never advances or accepts fundraising',()=>{
  const state={...createInitialState(),status:'won',paused:false};
  assert.equal(simulateOneWeek(state),state);assert.equal(startFundraiser(state,'appeal').ok,false);
});
test('one good year and a planted bridge cannot instantly win',()=>{
  const state=advance(createInitialState(),52);assert.notEqual(state.status,'won');
  assert.equal(getMetrics(state).mature,0);assert.equal(state.sustainableYears,0);
});

test('construction crew cannot build two bridges at once',()=>{
  let state=createInitialState();state.links[0].agreement=true;state.links[1].agreement=true;
  state=applyTool(state,'bridge','ab').state;const balance=state.balanceFC;
  const second=applyTool(state,'bridge','bc');assert.equal(second.ok,false);assert.equal(second.state.balanceFC,balance);
});
test('grant review checks eligibility again at payout',()=>{
  let state=createInitialState();state.evidence=25;state.awareness=45;
  state=startFundraiser(state,'grant').state;state=advance(state,16);
  assert.equal(state.ledger.filter(entry=>entry.category==='Evidence grant'&&entry.amount>0).length,0);
});
test('cash shortfalls do not end a campaign before its population collapses',()=>{
  const initial=createInitialState();initial.balanceFC=0;
  const state=advance(initial,26);assert.equal(state.shortfallWeeks,26);assert.equal(state.status,'playing');
  assert.ok(getMetrics(state).population>=1000);
});
test('campaign remains winnable with reserve management across three seeds',()=>{
  for(const seed of [73,42,917]){
    const state=runCampaign(seed,'expert');assert.equal(state.status,'won',`seed ${seed}`);
    assert.ok(state.totalWeeks>=208);assert.ok(getMetrics(state).population>=10000);
  }
});

test('population starts at 5000 and victory never depends on crossing observations',()=>{
  const state=createInitialState();assert.equal(getMetrics(state).population,5000);
  state.patches.forEach(patch=>{patch.population=2000;});
  const ended=advance(state,1);assert.equal(ended.status,'won');assert.equal(ended.crossingCount,0);
});
test('population loss threshold is strictly below 1000',()=>{
  const state=createInitialState();state.patches.forEach(patch=>{patch.population=0;});state.patches[0].population=1000;
  assert.equal(advance(state,1).status,'playing');
  state.patches[0].population=999;assert.equal(advance(state,1).status,'lost-population');
});
test('fire, disease and construction kill tamarins and damage their habitats',()=>{
  for(const type of ['wildfire','yellow-fever','construction']){
    const initial=createInitialState(),state=applyAdversity(initial,type,'a');
    assert.ok(getMetrics(state).population<5000,type);assert.equal(getMetrics(initial).population,5000);
    if(type!=='yellow-fever')assert.ok(getMetrics(state).forestPercent<32,type);
    assert.equal(state.adversityHistory.length,1);
  }
});
test('vaccinated populations suffer fewer yellow fever losses',()=>{
  const initial=createInitialState(),protectedState=createInitialState();protectedState.patches.forEach(patch=>{patch.vaccinated=.9;});
  assert.ok(getMetrics(applyAdversity(protectedState,'yellow-fever','a')).population>getMetrics(applyAdversity(initial,'yellow-fever','a')).population);
});
test('tree cover expands gradually near planted bridges and can be destroyed',()=>{
  const initial=createInitialState(),link=initial.links[0];link.agreement=true;link.built=true;link.planted=true;
  const early=getMetrics(initial);link.age=104;const growing=getMetrics(initial);link.age=208;const mature=getMetrics(initial);
  assert.ok(early.capacity<growing.capacity);assert.ok(growing.forestPercent<mature.forestPercent);
  const burned=applyAdversity(initial,'wildfire','a');assert.ok(burned.links[0].survival<100);
});
test('funded fire preparedness and outreach reduce the matching threat damage',()=>{
  for(const [type,program] of [['wildfire','fireWatch'],['construction','outreach']]){
    const initial=createInitialState(),protectedState=toggleService(initial,program).state;
    const unprotected=applyAdversity(initial,type,'a'),protectedResult=applyAdversity(protectedState,type,'a');
    assert.ok(getMetrics(protectedResult).population>getMetrics(unprotected).population);
    assert.ok(protectedResult.patches[0].health>unprotected.patches[0].health);
  }
});
test('vaccination takes paid time and protection persists after a veterinary visit',()=>{
  let state=toggleService(createInitialState(),'health').state;
  assert.equal(state.patches[0].vaccinated,0);state=advance(state,26);
  assert.equal(state.services.health,false);const coverage=state.patches[0].vaccinated;
  assert.ok(coverage>0&&coverage<.5);state=advance(state,1);assert.ok(state.patches[0].vaccinated>coverage*.98);
  state.balanceFC=0;state=advance(state,1);assert.ok(state.patches[0].vaccinated<=coverage);
});
test('threat warnings precede persistent damage and follow-up events',()=>{
  const state=advance(createInitialState(),78);
  assert.ok(state.events.some(entry=>entry.message.includes('Yellow fever warning')));
  assert.equal(state.adversityHistory[0].type,'yellow-fever');assert.ok(state.adversityHistory[0].deaths>0);
  assert.ok(state.nextAdversity.week>78);assert.equal(state.nextAdversity.type,'construction');
});
test('habitat collapse causes bounded weekly mortality rather than instant extinction',()=>{
  const initial=createInitialState();initial.patches.forEach(patch=>{patch.health=0;});initial.balanceFC=0;
  const state=advance(initial,1);
  assert.ok(getMetrics(state).population>=4700);assert.ok(getMetrics(state).population<5000);
  assert.ok(state.patches.every(patch=>Number.isInteger(patch.population)&&patch.population>=0));
});

test('program commitment and completion cooldown block rapid toggling',()=>{
  let state=toggleService(createInitialState(),'outreach').state;
  assert.equal(toggleService(state,'outreach').ok,false);
  state=advance(state,12);assert.equal(state.services.outreach,false);
  assert.equal(toggleService(state,'outreach').ok,false);
  state=advance(state,7);assert.equal(toggleService(state,'outreach').ok,false);
  state=advance(state,1);assert.equal(toggleService(state,'outreach').ok,true);
});
test('fundraising cooldown begins after the payout, not the start',()=>{
  let state=startFundraiser(createInitialState(),'presentation').state;
  state=advance(state,33);assert.equal(startFundraiser(state,'presentation').ok,false);
  state=advance(state,1);assert.equal(startFundraiser(state,'presentation').ok,true);
});
test('grant final installment waits for new monitoring and is paid once',()=>{
  let state=createInitialState();state.evidence=25;state.awareness=80;
  state=startFundraiser(state,'grant').state;state=advance(state,16);
  assert.equal(state.fundraisers[0].firstPaid,true);
  assert.equal(state.ledger.filter(entry=>entry.category==='Evidence grant'&&entry.amount>0)[0].amount,4500);
  state=advance(state,15);assert.equal(state.fundraisers[0].completed,false);
  state=toggleService(state,'monitoring').state;state=advance(state,5);
  assert.equal(state.fundraisers[0].completed,true);
  state=advance(state,2);assert.equal(state.ledger.filter(entry=>entry.category==='Evidence grant final installment').length,1);
});
test('planting has a wet-season window',()=>{
  let state=createInitialState();state.links[0].agreement=true;state.links[0].built=true;state.totalWeeks=30;
  assert.equal(applyTool(state,'restore','ab').ok,false);
  state.totalWeeks=52;assert.equal(applyTool(state,'restore','ab').ok,true);
});
test('nursery care has capacity for only two areas',()=>{
  let state=createInitialState();state.links.slice(0,3).forEach(link=>{link.planted=true;link.survival=50;});
  state=toggleService(state,'nursery').state;state=advance(state,1);
  assert.equal(state.links.filter(link=>link.planted&&link.survival>50).length,2);
});
test('nursery disaster protection reaches only its two assigned planting areas',()=>{
  let state=createInitialState();state.links.slice(0,3).forEach(link=>{link.planted=true;link.survival=50;});
  state=toggleService(state,'nursery').state;state=applyAdversity(state,'drought','a');
  assert.equal(state.links.filter(link=>link.planted&&link.survival>40).length,2);
  assert.ok(state.links[2].survival<40);
});
