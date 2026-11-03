import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,weeklyCost,weeklySupport,weeklyBudget,DIFFICULTIES,FUNDRAISERS,applyTool,toggleService,applyAdversity,getMetrics,startFundraiser,simulateOneWeek} from '../js/game-core.js';
import {getTutorialStep,getRecommendedStep,performTutorialStep} from '../js/game-guide.js';

function recommendedCampaign(seed,difficulty){
  let state=createInitialState(seed,difficulty),minimumBalance=12000,shortfalls=0,yearIncome=0,yearExpenses=0;
  const allowedIncome=new Set(['Recurring supporters','Evidence grant final installment',...Object.values(FUNDRAISERS).map(config=>config.label)]);
  for(let week=0;week<1560&&state.status==='playing';week+=1){
    const opening=state.balanceFC;
    for(let decision=0;decision<20;decision+=1){
      const step=getRecommendedStep(state);
      if(step.kind==='wait')break;
      const result=step.kind==='program'?toggleService(state,step.id):step.kind==='fundraiser'?startFundraiser(state,step.id):applyTool(state,step.tool,step.id);
      assert.equal(result.ok,true,result.message);state=result.state;
      assert.ok(decision<19,'recommended policy must yield to weekly simulation');
    }
    state=simulateOneWeek({...state,paused:false});
    minimumBalance=Math.min(minimumBalance,state.balanceFC);if(!state.lastFunded)shortfalls+=1;
    const actual=state.lastWeek;
    assert.equal(actual.openingBalanceFC,opening);
    assert.equal(opening+actual.incomeFC-actual.expensesFC,state.balanceFC);
    assert.equal(actual.ledger.reduce((sum,entry)=>sum+entry.amount,0),actual.netFC);
    assert.ok(actual.ledger.every(entry=>Number.isInteger(entry.amount)));
    assert.ok(actual.ledger.filter(entry=>entry.amount>0).every(entry=>allowedIncome.has(entry.category)));
    assert.equal(actual.population.change,actual.population.naturalChange-actual.population.adversityDeaths);
    yearIncome+=actual.incomeFC;yearExpenses+=actual.expensesFC;
    if(state.totalWeeks%52===0){
      const report=state.annualReports.at(-1);
      assert.equal(report.income,yearIncome);assert.equal(report.expenses,yearExpenses);
      assert.equal(report.opening+report.income-report.expenses,report.closing);
      yearIncome=0;yearExpenses=0;
    }
  }
  assert.equal(12000+state.ledger.reduce((sum,entry)=>sum+entry.amount,0),state.balanceFC);
  return {state,summary:{seed,status:state.status,weeks:state.totalWeeks,population:getMetrics(state).population,balance:state.balanceFC,minimumBalance,shortfalls}};
}

test('difficulty changes recurring costs and threats without changing population goals',()=>{
  const easy=createInitialState(73,'explorer'),hard=createInitialState(73,'expert');
  assert.ok(weeklyCost(easy)<weeklyCost(hard));
  assert.ok(getMetrics(applyAdversity(easy,'wildfire','a')).population>getMetrics(applyAdversity(hard,'wildfire','a')).population);
  assert.equal(getMetrics(easy).population,5000);assert.equal(getMetrics(hard).population,5000);
});
test('new and invalid difficulties default to Standard while Challenge saves retain their difficulty',()=>{
  assert.equal(createInitialState(73,'explorer').difficulty,'explorer');
  assert.equal(createInitialState().difficulty,'standard');
  assert.equal(createInitialState(73,'unknown').difficulty,'standard');
  const saved=JSON.parse(JSON.stringify(createInitialState(73,'challenge')));
  saved.paused=false;
  assert.equal(simulateOneWeek(saved).difficulty,'challenge');
  assert.equal(saved.version,5);
});
test('tutorial begins with an explained action and does not advance time during setup',()=>{
  const initial=createInitialState(73,'tutorial'),step=getTutorialStep(initial);
  assert.equal(step.kind,'program');assert.equal(step.id,'outreach');assert.match(step.copy,/trust/i);
  const result=performTutorialStep(initial);assert.equal(result.ok,true);assert.equal(result.state.services.outreach,true);
  assert.equal(result.state.totalWeeks,0);assert.equal(result.state.paused,true);assert.equal(initial.services.outreach,false);
});
test('guided actions are unavailable in unassisted difficulty modes',()=>{
  const initial=createInitialState();assert.equal(performTutorialStep(initial).ok,false);
});
test('following tutorial guidance reaches a real population victory across seeds',()=>{
  for(const seed of [73,42,917]){
    let state=createInitialState(seed,'tutorial');const lessons=new Set();
    for(let step=0;step<1800&&state.status==='playing';step+=1){
      const guide=getTutorialStep(state);lessons.add(guide.kind==='route'?guide.tool:guide.kind);
      const result=performTutorialStep(state);assert.equal(result.ok,true,result.message);state=result.state;
    }
    assert.equal(state.status,'won',`seed ${seed}: ${getMetrics(state).population} tamarins`);
    assert.ok(getMetrics(state).population>=10000);assert.ok(state.totalWeeks>=208);
    for(const lesson of ['program','fundraiser','agreement','bridge','restore','wait'])assert.ok(lessons.has(lesson),lesson);
    for(const lesson of ['nursery','repair','health','fireWatch','grant'])assert.ok(state.tutorialLessons.includes(lesson),lesson);
  }
});
test('difficulty-adjusted grant installments total the displayed award once',()=>{
  let state=createInitialState(73,'tutorial');state.evidence=100;state.awareness=100;
  state=startFundraiser(state,'grant').state;state.reportWork=10;
  for(let week=0;week<35;week+=1){state.paused=false;state=simulateOneWeek(state);if(week===17)state.reportWork+=4;}
  assert.equal(state.ledger.filter(entry=>entry.category.startsWith('Evidence grant')&&entry.amount>0).reduce((sum,entry)=>sum+entry.amount,0),12600);
});

test('Standard sits strictly between Explorer and Challenge in all four explicit parameters',()=>{
  const {explorer,standard,challenge}=DIFFICULTIES;
  for(const parameter of ['operations','threat'])assert.ok(explorer[parameter]<standard[parameter]&&standard[parameter]<challenge[parameter]);
  for(const parameter of ['income','growth'])assert.ok(explorer[parameter]>standard[parameter]&&standard[parameter]>challenge[parameter]);
  for(const config of Object.values(DIFFICULTIES)){
    assert.match(config.description,/bills/i);assert.match(config.description,/support/i);
    assert.match(config.description,/births/i);assert.match(config.description,/threat damage/i);
  }
  const states=['explorer','standard','challenge'].map(id=>createInitialState(73,id));
  assert.ok(weeklyCost(states[0])<weeklyCost(states[1])&&weeklyCost(states[1])<weeklyCost(states[2]));
  assert.ok(weeklySupport(states[0])>=weeklySupport(states[1])&&weeklySupport(states[1])>=weeklySupport(states[2]));
});

test('recommended Standard policy wins six deterministic seeds with funded care and fully reconciled accounts',context=>{
  for(const seed of [1,7,42,73,917,2026]){
    const {state,summary}=recommendedCampaign(seed,'standard');
    context.diagnostic(JSON.stringify({difficulty:'standard',...summary}));
    assert.equal(state.status,'won',`seed ${seed}`);
    assert.ok(summary.weeks>=208&&summary.weeks<780);
    assert.ok(summary.population>=10000);assert.equal(summary.shortfalls,0);
    assert.ok(summary.minimumBalance>=4000);
    assert.ok(!state.fundraisers.some(campaign=>campaign.id==='appeal'));
    assert.ok(state.ledger.some(entry=>entry.category==='Evidence grant final installment'));
    if(seed===73)assert.deepEqual(recommendedCampaign(seed,'standard').summary,summary);
  }
});

test('Challenge remains winnable but requires longer recovery and tighter reserves than Standard',context=>{
  for(const seed of [1,7,42,73,917,2026]){
    const {state,summary}=recommendedCampaign(seed,'challenge');
    context.diagnostic(JSON.stringify({difficulty:'challenge',...summary}));
    assert.equal(state.status,'won',`seed ${seed}`);
    assert.ok(summary.population>=10000);assert.ok(summary.weeks>527);
    assert.ok(summary.minimumBalance<6009);
  }
});

test('guide wait text distinguishes recurring burn from awards and explains population limitations',()=>{
  const {state}=recommendedCampaign(73,'standard');
  const waiting={...state,status:'playing',balanceFC:0,awareness:100,evidence:100};
  waiting.links.forEach(link=>{link.condition=100;link.survival=100;});
  waiting.nextAdversity={type:'drought',week:waiting.totalWeeks+78,patchId:'a'};
  const step=getRecommendedStep(waiting),budget=weeklyBudget(waiting);
  assert.equal(step.kind,'wait');
  assert.match(step.copy,/excluding awards and one-off purchases/);
  assert.match(step.copy,/crowding, isolation and unpaid care/);
  assert.ok(step.copy.includes(`Weekly support ${budget.support} minus bills ${budget.cost} = ${budget.net}`));
});
