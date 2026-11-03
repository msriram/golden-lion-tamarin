import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,simulateOneWeek,applyTool,applyAdversity,startFundraiser,toggleService,getMetrics,weeklyCost,weeklySupport,weeklyBudget,weeklyBudgetBreakdown,getPopulationExplanation,DIFFICULTIES,FUNDRAISERS,fundingAward,reachable,TREE_MATURITY_WEEKS,SPEED_INTERVALS_MS,speedIntervalMs,setSpeed} from '../js/game-core.js';
import {runCampaign} from '../scripts/playtest.mjs';

function advance(state,weeks){state={...state,paused:false};for(let week=0;week<weeks;week+=1)state=simulateOneWeek(state);return state;}
test('speed controls use the requested real-time interval for every multiplier',()=>{
  assert.deepEqual(SPEED_INTERVALS_MS,{1:8000,2:4000,4:2000,8:1000,16:500,32:250});
  for(const [speed,interval] of Object.entries(SPEED_INTERVALS_MS)){
    assert.equal(speedIntervalMs(Number(speed)),interval);
    assert.equal(setSpeed(createInitialState(),Number(speed)).speed,Number(speed));
  }
  assert.equal(setSpeed(createInitialState(),64).speed,1);
});
test('idle management exhausts cash and eventually ends the program',()=>{
  const state=advance(createInitialState(),1000);
  assert.equal(state.balanceFC,0);assert.equal(state.status,'lost-population');
  assert.ok(getMetrics(state).population<1000);assert.ok(getMetrics(state).forestPercent<32);
});
test('outreach and monitoring add recurring costs and earn trust and evidence only when paid',()=>{
  let state=toggleService(createInitialState(73,'challenge'),'outreach').state;
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
  assert.equal(state.links[0].bridgeRemainingWeeks,16);
  state=advance(state,15);
  assert.equal(state.links[0].built,false);assert.equal(state.links[0].bridgeRemainingWeeks,1);
  state=advance(state,1);
  assert.equal(state.links[0].bridgeRemainingWeeks,null);assert.equal(state.links[0].bridgeDue,null);
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

test('fifteen unpaid construction weeks do not replace any of the sixteen paid weeks',()=>{
  let state=createInitialState(73,'challenge');state.links[0].agreement=true;
  state=applyTool(state,'bridge','ab').state;
  state.balanceFC=0;state.awareness=0;
  state=advance(state,15);
  assert.equal(state.shortfallWeeks,15);assert.equal(state.links[0].built,false);
  assert.equal(state.links[0].bridgeRemainingWeeks,16);
  assert.equal(state.links[0].bridgeDue,31);
  state.balanceFC=12000;state=advance(state,15);
  assert.equal(state.totalWeeks,30);assert.equal(state.links[0].built,false);
  assert.equal(state.links[0].bridgeRemainingWeeks,1);assert.equal(state.links[0].bridgeDue,31);
  state=advance(state,1);
  assert.equal(state.links[0].built,true);assert.equal(state.links[0].bridgeDue,null);
  assert.equal(state.links[0].bridgeRemainingWeeks,null);
  assert.equal(state.events.filter(entry=>entry.message==='Ridge route: bridge opened.').length,1);
});

test('partial bills pause construction, retain crew occupancy and survive a saved-game round trip',()=>{
  let state=createInitialState(73,'challenge');state.links[0].agreement=true;state.links[1].agreement=true;
  state=applyTool(state,'bridge','ab').state;state.awareness=0;
  state.balanceFC=weeklyCost(state)-1;
  const before=structuredClone(state);
  state=advance(state,1);
  assert.equal(before.links[0].bridgeDue,16);
  assert.equal(state.lastWeek.funded,false);
  assert.equal(state.lastWeek.operationsPaidFC,state.lastWeek.operationsDueFC-1);
  assert.equal(state.links[0].bridgeRemainingWeeks,16);assert.equal(state.links[0].bridgeDue,17);
  assert.equal(applyTool(state,'bridge','bc').ok,false);
  state.balanceFC=12000;state=advance(state,4);
  assert.equal(state.links[0].bridgeRemainingWeeks,12);
  state=JSON.parse(JSON.stringify(state));
  state.balanceFC=weeklyCost(state)-1;state=advance(state,1);
  assert.equal(state.links[0].bridgeRemainingWeeks,12);assert.equal(state.links[0].bridgeDue,18);
  state.balanceFC=12000;state=advance(state,11);
  assert.equal(state.links[0].built,false);assert.equal(state.links[0].bridgeRemainingWeeks,1);
  state=advance(state,1);assert.equal(state.links[0].built,true);
  assert.equal(state.totalWeeks,18);
});

test('legacy bridge deadlines migrate remaining work without restarting or granting unpaid progress',()=>{
  for(const deadline of [17,20,25]){
    let state=createInitialState(73,'challenge');state.totalWeeks=20;
    state.links[0].agreement=true;state.links[0].bridgeDue=deadline;
    delete state.links[0].bridgeRemainingWeeks;
    state.awareness=0;state.balanceFC=weeklyCost(state)-1;
    const remaining=Math.max(0,deadline-state.totalWeeks);
    state=advance(state,1);
    assert.equal(state.version,5);assert.equal(state.links[0].built,false);
    assert.equal(state.links[0].bridgeRemainingWeeks,remaining);
    assert.equal(state.links[0].bridgeDue,state.totalWeeks+remaining);
    state.balanceFC=12000;
    if(remaining>1){
      state=advance(state,remaining-1);
      assert.equal(state.links[0].built,false);assert.equal(state.links[0].bridgeRemainingWeeks,1);
    }
    state=advance(state,1);
    assert.equal(state.links[0].built,true);assert.equal(state.links[0].bridgeDue,null);
  }
});

test('paused construction does not progress or move its deadline',()=>{
  const initial=createInitialState();initial.links[0].agreement=true;
  const state=applyTool(initial,'bridge','ab').state;
  assert.equal(simulateOneWeek(state),state);
  assert.equal(state.links[0].bridgeRemainingWeeks,16);assert.equal(state.links[0].bridgeDue,16);
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
  let state=createInitialState(73,'challenge');state.evidence=25;state.awareness=80;
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

test('pure budget explains aggregate rounding and both support formula inputs at every difficulty',()=>{
  for(const difficulty of Object.keys(DIFFICULTIES))for(const trust of [34,35,38.25,64.99,65,90,100]){
    let state=createInitialState(73,difficulty);
    state.awareness=trust;
    Object.keys(state.services).forEach(name=>{state=toggleService(state,name).state;});
    state.links.slice(0,3).forEach(link=>{link.agreement=true;link.built=true;link.planted=true;link.age=208;});
    const original=structuredClone(state),budget=weeklyBudget(state);
    assert.deepEqual(state,original);
    assert.deepEqual(budget,weeklyBudgetBreakdown(state));
    assert.equal(budget.cost,weeklyCost(state));assert.equal(budget.support,weeklySupport(state));
    assert.equal(budget.items.reduce((sum,item)=>sum+item.amount,0),budget.cost);
    assert.ok(budget.items.every(item=>Number.isInteger(item.amount)));
    assert.ok(Math.abs(budget.income.reduce((sum,item)=>sum+item.scaledFC,0)+budget.incomeRoundingFC-budget.support)<1e-9);
    assert.equal(budget.cost,Math.round(budget.items.reduce((sum,item)=>sum+item.base,0)*budget.operationsMultiplier));
    assert.equal(budget.support,Math.floor((Math.max(0,trust-35)*2.8+(trust>=65?105:0)+budget.supportInputs.sponsorBaseFC)*budget.incomeMultiplier));
    assert.equal(budget.supportInputs.matureCorridors,3);
    assert.equal(budget.net,budget.support-budget.cost);assert.equal(budget.burn,-budget.net);
  }
});

test('last week includes purchases since the previous close and reconciles actual ledger categories',()=>{
  let state=createInitialState();
  state=toggleService(state,'outreach').state;
  state=applyTool(state,'agreement','ab').state;
  state=startFundraiser(state,'presentation').state;
  const forecast=weeklyBudget(state);
  state=advance(state,1);
  const first=state.lastWeek;
  assert.equal(first.openingBalanceFC,12000);
  assert.equal(first.expensesFC,100+600+200+forecast.cost);
  assert.equal(first.incomeFC,forecast.support);
  assert.equal(first.openingBalanceFC+first.incomeFC-first.expensesFC,first.closingBalanceFC);
  assert.equal(first.closingBalanceFC,state.balanceFC);
  assert.equal(first.categories.find(item=>item.category==='Land negotiation').expensesFC,600);
  assert.deepEqual(first.ledger,state.ledger);
  assert.equal(first.categories.reduce((sum,item)=>sum+item.incomeFC,0),first.incomeFC);
  assert.equal(first.categories.reduce((sum,item)=>sum+item.expensesFC,0),first.expensesFC);
  state=toggleService(state,'monitoring').state;
  state=advance(state,1);
  assert.equal(state.lastWeek.openingBalanceFC,first.closingBalanceFC);
  assert.equal(state.lastWeek.ledgerStart,first.ledgerEnd);
  assert.equal(state.lastWeek.expensesFC,80+state.lastWeek.operationsDueFC);
  assert.ok(!state.lastWeek.ledger.some(entry=>entry.category==='Land negotiation'));
  state=advance(state,6);
  assert.ok(state.lastWeek.incomeFC>state.lastWeek.budget.support);
  assert.ok(state.lastWeek.categories.some(item=>item.category==='School outreach'&&item.incomeFC>0));
});

test('partial operations show the real payment rather than inventing the full expense or a bailout',()=>{
  const initial=createInitialState();initial.balanceFC=10;
  const state=advance(initial,1),week=state.lastWeek;
  assert.equal(week.openingBalanceFC,10);assert.equal(week.closingBalanceFC,0);
  assert.equal(week.incomeFC,weeklySupport(initial));
  assert.equal(week.expensesFC,10+week.incomeFC);
  assert.equal(week.operationsPaidFC,week.expensesFC);assert.equal(week.funded,false);
  assert.ok(week.operationsDueFC>week.operationsPaidFC);
  assert.equal(week.ledger.find(entry=>entry.category==='Partial operations payment').amount,-week.expensesFC);
  assert.match(state.events[0].message,/not fully funded/);
  const empty=advance({...initial,balanceFC:0,awareness:0},1);
  assert.equal(empty.lastWeek.expensesFC,0);assert.equal(empty.lastWeek.incomeFC,0);
});

test('last week freezes the charged forecast before agreements, trust and program expirations change it',()=>{
  let state=toggleService(createInitialState(),'outreach').state;
  state=applyTool(state,'agreement','ab').state;
  state=advance(state,11);
  const budget=weeklyBudget(state);
  state=advance(state,1);
  assert.equal(state.lastWeek.operationsDueFC,budget.cost);
  assert.equal(state.lastWeek.budget.support,budget.support);
  assert.equal(state.services.outreach,false);assert.equal(state.links[0].agreement,true);
  assert.notEqual(weeklyCost(state),state.lastWeek.operationsDueFC);
});

test('legacy version 5 saves without lastWeek do not replay historical ledger in the next report',()=>{
  const saved=JSON.parse(JSON.stringify(advance(createInitialState(73,'challenge'),20)));
  delete saved.lastWeek;
  const state=advance(saved,1);
  assert.equal(state.version,5);assert.equal(state.difficulty,'challenge');
  assert.equal(state.lastWeek.openingBalanceFC,saved.balanceFC);
  assert.equal(state.lastWeek.ledgerStart,saved.ledger.length);
  assert.equal(state.lastWeek.ledger.length,2);
});

test('legacy accounting captures all new purchases while excluding the historical ledger',()=>{
  let legacy=JSON.parse(JSON.stringify(advance(createInitialState(73,'challenge'),20)));
  delete legacy.lastWeek;
  legacy.ledger.forEach(entry=>{delete entry.phase;});
  const original=structuredClone(legacy),opening=legacy.balanceFC,cursor=legacy.ledger.length;
  let state=toggleService(legacy,'outreach').state;
  assert.deepEqual(legacy,original);
  assert.equal(state.accountingCursor,cursor);
  state=JSON.parse(JSON.stringify(state));
  state=toggleService(state,'monitoring').state;
  state=applyTool(state,'agreement','ab').state;
  state=startFundraiser(state,'presentation').state;
  assert.equal(state.accountingCursor,cursor);
  const expectedExpenses=100+80+600+200+weeklyCost(state);
  state=advance(state,1);
  const last=state.lastWeek;
  assert.equal(last.openingBalanceFC,opening);assert.equal(last.ledgerStart,cursor);
  assert.equal(last.expensesFC,expectedExpenses);
  assert.equal(last.openingBalanceFC+last.incomeFC-last.expensesFC,state.balanceFC);
  assert.deepEqual(last.ledger,state.ledger.slice(cursor));
  assert.equal(last.ledger.filter(entry=>entry.phase==='action').length,4);
  assert.ok(last.ledger.every(entry=>entry.phase));
  assert.equal(state.accountingCursor,undefined);
  const next=advance(state,1);
  assert.equal(next.lastWeek.openingBalanceFC,state.balanceFC);
  assert.equal(next.lastWeek.expensesFC,next.lastWeek.operationsDueFC);
  assert.equal(next.lastWeek.ledger.filter(entry=>entry.phase==='action').length,0);
});

test('initial custom setup balances and purchases reconcile without treating opening cash as income',()=>{
  const initial=createInitialState();initial.balanceFC=3000;initial.awareness=0;
  let state=startFundraiser(initial,'presentation').state;
  assert.equal(state.accountingCursor,0);
  state=advance(state,1);
  assert.equal(state.lastWeek.openingBalanceFC,3000);
  assert.equal(state.lastWeek.expensesFC,200+weeklyCost(initial));
  assert.equal(state.lastWeek.incomeFC,0);
  assert.equal(state.lastWeek.closingBalanceFC,3000-state.lastWeek.expensesFC);
  const direct=advance({...createInitialState(),balanceFC:500,awareness:0},1);
  assert.equal(direct.lastWeek.openingBalanceFC,500);
});

test('rejected legacy purchases do not create a cursor or alter history',()=>{
  const legacy=advance(createInitialState(),20);delete legacy.lastWeek;
  const original=structuredClone(legacy);
  const rejected=applyTool(legacy,'bridge','ab');
  assert.equal(rejected.ok,false);assert.equal(rejected.state,legacy);
  assert.deepEqual(legacy,original);assert.equal(legacy.accountingCursor,undefined);
});

test('tick 52 distinguishes Year 1 settlement from Year 2 actions without retagging legacy history',()=>{
  const initial=createInitialState();
  initial.ledger.push({week:0,amount:0,category:'Legacy entry'});
  let state=advance(initial,52);
  const settlement=state.ledger.filter(entry=>entry.week===52);
  assert.ok(settlement.length>0);assert.ok(settlement.every(entry=>entry.phase==='settlement'));
  const annual=state.annualReports[0];
  const opening=state.balanceFC;
  state=toggleService(state,'outreach').state;
  const action=state.ledger.at(-1);
  assert.equal(action.week,52);assert.equal(action.phase,'action');
  assert.equal(state.balanceFC,opening-100);
  assert.deepEqual(state.annualReports[0],annual);
  const calendar=entry=>{
    const index=entry.week-(entry.phase==='settlement'?1:0);
    return {year:Math.floor(index/52)+1,week:index%52+1};
  };
  assert.deepEqual(calendar(settlement[0]),{year:1,week:52});
  assert.deepEqual(calendar(action),{year:2,week:1});
  assert.equal(state.ledger[0].phase,undefined);
  state=advance(state,1);
  assert.equal(state.lastWeek.openingBalanceFC,opening);
  assert.ok(state.lastWeek.categories.some(entry=>entry.category==='Community outreach mobilization'&&entry.expensesFC===100));
});

test('fundraiser installments, support and partial operations are explicitly settlement transactions',()=>{
  let state=createInitialState();state.evidence=100;state.awareness=100;
  state=startFundraiser(state,'grant').state;
  state=advance(state,16);state=toggleService(state,'monitoring').state;
  state=advance(state,13);
  const awards=state.ledger.filter(entry=>entry.category.startsWith('Evidence grant')&&entry.amount>0);
  assert.equal(awards.length,2);assert.ok(awards.every(entry=>entry.phase==='settlement'));
  assert.ok(state.ledger.filter(entry=>['Recurring supporters','Weekly operations'].includes(entry.category)).every(entry=>entry.phase==='settlement'));
  assert.equal(state.ledger.find(entry=>entry.category==='Evidence grant'&&entry.amount<0).phase,'action');
  assert.equal(state.ledger.find(entry=>entry.category.endsWith('mobilization')).phase,'action');
  const partial=advance({...createInitialState(),balanceFC:1,awareness:0},1);
  assert.equal(partial.ledger.find(entry=>entry.category==='Partial operations payment').phase,'settlement');
  const school=advance(startFundraiser(createInitialState(),'presentation').state,8);
  assert.equal(school.ledger.find(entry=>entry.category==='School outreach'&&entry.amount>0).phase,'settlement');
});

test('grant forecast exposes the full minimum renewal cycle and excludes pending money from recurring support',()=>{
  let state=createInitialState();state.evidence=100;state.awareness=100;
  const support=weeklySupport(state);
  state=startFundraiser(state,'grant').state;
  assert.equal(weeklyBudget(state).grant.phase,'review');
  assert.equal(weeklyBudget(state).support,support);
  state=advance(state,16);
  assert.equal(weeklyBudget(state).grant.phase,'reporting');
  assert.equal(weeklyBudget(state).grant.reportWeeksDone,0);
  assert.equal(weeklyBudget(state).grant.minimumCycleWeeks,81);
  assert.equal(weeklyBudget(state).grant.readyWeek,null);
  state=advance(state,20);
  assert.equal(state.fundraisers[0].completed,false);
  assert.equal(startFundraiser(state,'presentation').ok,false);
  assert.equal(state.ledger.filter(entry=>entry.category==='Evidence grant final installment').length,0);
  state=toggleService(state,'monitoring').state;state=advance(state,4);
  assert.equal(weeklyBudget(state).grant.reportWeeksDone,4);
  state=advance(state,1);
  assert.equal(weeklyBudget(state).grant.phase,'idle');
  assert.equal(weeklyBudget(state).grant.readyWeek,state.totalWeeks+52);
  assert.equal(state.lastWeek.categories.find(item=>item.category==='Evidence grant final installment').incomeFC,4950);
  state=advance(state,51);assert.equal(startFundraiser(state,'grant').ok,false);
  state=advance(state,1);assert.equal(startFundraiser(state,'grant').ok,true);
});

test('odd grant awards remain whole credits and installments sum to the exact displayed total',()=>{
  const original=FUNDRAISERS.grant.payout;
  try{
    FUNDRAISERS.grant.payout=9001;
    let state=createInitialState(73,'tutorial');state.evidence=100;state.awareness=100;
    state=startFundraiser(state,'grant').state;
    const award=fundingAward(state,'grant'),budget=weeklyBudget(state);
    assert.equal(award%2,1);
    state=advance(state,16);state=toggleService(state,'monitoring').state;state=advance(state,19);
    const payments=state.ledger.filter(entry=>entry.category.startsWith('Evidence grant')&&entry.amount>0);
    assert.deepEqual(payments.map(entry=>entry.amount),[budget.grant.firstInstallmentFC,budget.grant.finalInstallmentFC]);
    assert.equal(payments.reduce((sum,entry)=>sum+entry.amount,0),award);
    assert.ok(state.ledger.every(entry=>Number.isInteger(entry.amount)));
  }finally{FUNDRAISERS.grant.payout=original;}
});

test('population explanation shares simulated factors, separates threat deaths, and conserves migration',()=>{
  const initial=createInitialState();initial.nextAdversity.week=1;
  initial.links[0].agreement=true;initial.links[0].built=true;
  const original=structuredClone(initial),projection=getPopulationExplanation(initial);
  assert.deepEqual(initial,original);assert.equal(projection.population,5000);
  assert.equal(projection.patches.find(patch=>patch.id==='a').isolationMultiplier,1);
  assert.equal(projection.patches.find(patch=>patch.id==='c').isolationMultiplier,.55);
  const state=advance(initial,1),population=state.lastWeek.population;
  assert.equal(population.opening,5000);assert.equal(population.closing,getMetrics(state).population);
  assert.ok(population.adversityDeaths>0);
  assert.equal(population.change,population.naturalChange-population.adversityDeaths);
  assert.equal(population.patches.reduce((sum,patch)=>sum+patch.migration,0),0);
  for(const patch of population.patches){
    assert.equal(patch.naturalChange,Math.trunc(patch.expectedNaturalChange+patch.remainder));
    assert.equal(state.patches.find(entry=>entry.id===patch.id).population,patch.population+patch.naturalChange+patch.migration);
  }
  assert.deepEqual(getPopulationExplanation(state).lastWeek,population);
  assert.equal(getMetrics(state).populationChange,population.change);
});

test('population factors expose crowding, poor health, isolation and unpaid mortality rather than promised growth',()=>{
  const state=createInitialState();state.balanceFC=0;state.awareness=0;
  state.patches[0].health=20;
  const explanation=getPopulationExplanation(state),patch=explanation.patches[0];
  assert.equal(explanation.funded,false);assert.equal(patch.expectedBirths,0);
  assert.ok(patch.mortality.unfunded>0);assert.ok(patch.mortality.poorHealth>0);
  assert.ok(patch.mortality.isolation>0);assert.ok(patch.mortality.overCapacity>0);
  assert.ok(explanation.expectedNaturalChange<0);
});
