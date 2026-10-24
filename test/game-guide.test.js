import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,weeklyCost,applyAdversity,getMetrics,startFundraiser,simulateOneWeek} from '../js/game-core.js';
import {getTutorialStep,performTutorialStep} from '../js/game-guide.js';

test('difficulty changes recurring costs and threats without changing population goals',()=>{
  const easy=createInitialState(73,'explorer'),hard=createInitialState(73,'expert');
  assert.ok(weeklyCost(easy)<weeklyCost(hard));
  assert.ok(getMetrics(applyAdversity(easy,'wildfire','a')).population>getMetrics(applyAdversity(hard,'wildfire','a')).population);
  assert.equal(getMetrics(easy).population,5000);assert.equal(getMetrics(hard).population,5000);
});
test('difficulty persists and invalid difficulties fall back to Challenge',()=>{
  assert.equal(createInitialState(73,'explorer').difficulty,'explorer');
  assert.equal(createInitialState(73,'unknown').difficulty,'challenge');
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
