import {PATCHES,FUNDRAISERS,SERVICES,PROGRAMS,ADVERSITIES,GRANT_REQUIREMENTS,getDifficulty,fundingAward,weeklyBudget,getPopulationExplanation,corridorGrowth,habitatCapacity,plantingSeason,createInitialState,applyTool,describeLink,activeLink,getMetrics,simulateOneWeek,startFundraiser,toggleService} from './game-core.js';
import {terrainArtwork} from './terrain.js';
import {getTutorialStep,performTutorialStep,getRecommendedStep} from './game-guide.js';
import {createPlayerStore,rankScores} from './game-players.js';
import {onlineConfigured,recordProjectInterest,withdrawProjectInterest,submitOnlineScore,fetchOnlineLeaderboard} from './game-online.js';

let browserStorage;
try{browserStorage=window.localStorage;}catch{}
const players=createPlayerStore(browserStorage);
const map=document.querySelector('[data-game-map]');
const dialog=document.querySelector('[data-report-dialog]');
function prepareCampaign(saved){
  const campaign=saved||createInitialState();
  campaign.difficulty=campaign.difficulty||(saved?'challenge':'standard');
  campaign.campaignId=campaign.campaignId||crypto.randomUUID();
  delete campaign.onlinePlayerId;
  campaign.paused=true;
  return campaign;
}
let state=prepareCampaign(players.loadCampaign());
let tool='inspect',timer=null,terminalShown=false;
let selection=null;
const toolNames={inspect:'Inspect',agreement:'Negotiate',bridge:'Build bridge',restore:'Plant cover',repair:'Repair & replant'};
document.querySelector('[data-difficulty]').value=state.difficulty;
function save(){players.saveCampaign(state);if(!players.persistent)message('Browser storage is unavailable. Progress and scores last only for this session.','error');}
function message(copy,tone=''){const target=document.querySelector('[data-game-message]');target.textContent=copy;target.className=`game-message ${tone}`;}
const number=value=>Math.round(value).toLocaleString();
function ledgerDate(entry){
  if(!['action','settlement'].includes(entry.phase))return `Tick ${entry.week} · legacy`;
  const completed=entry.phase==='settlement'?Math.max(0,entry.week-1):entry.week;
  return `Y${Math.floor(completed/52)+1} W${completed%52+1} · ${entry.phase==='settlement'?'settled':'before settlement'}`;
}
function tableRows(target,rows,columns,empty){
  target.replaceChildren();
  if(!rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=columns;cell.textContent=empty;row.append(cell);target.append(row);return;}
  for(const cells of rows){const row=document.createElement('tr');for(const value of cells){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}target.append(row);}
}
function handle(result){
  const previous=state.balanceFC,previousWeek=state.totalWeeks,ledgerStart=state.ledger.length;state=result.state;
  const spent=previous-state.balanceFC,budget=weeklyBudget(state);
  const elapsed=state.totalWeeks-previousWeek,entries=state.ledger.slice(ledgerStart),income=entries.reduce((sum,entry)=>sum+Math.max(0,entry.amount),0),expenses=entries.reduce((sum,entry)=>sum-Math.min(0,entry.amount),0);
  const explanation=elapsed>0?` Across ${elapsed} weeks: income +${number(income)} − spending ${number(expenses)} = ${signed(-spent)} FC. Budget → Details shows the transactions.`:result.ok&&spent>0?` Paid ${number(spent)} FC now. Recurring support ${number(budget.support)} − bills ${number(budget.cost)} = ${signed(budget.net)} FC/week; awards separate.`:'';
  message(result.message+explanation,result.ok?'success':'error');
  save();render();
}
const signed=value=>`${value>=0?'+':'−'}${number(Math.abs(value))}`;
function revealSelection(){
  const panel=document.querySelector('[data-selection-panel]');
  if(!panel.hidden&&innerWidth<=900)panel.scrollIntoView({block:'nearest',behavior:'instant'});
}
function renderResources(metrics){
  const values={funds:`${number(state.balanceFC)} FC`,calendar:`Y${metrics.year} · W${metrics.week}`,weekly:`${signed(-metrics.burn)} FC`,trust:`${Math.floor(state.awareness)} / 100`,evidence:`${Math.floor(state.evidence)} / 100`,tamarins:number(metrics.population),forest:`${metrics.forestPercent}%`,runway:metrics.runway===Infinity?'Covered':`${metrics.runway} weeks`};
  for(const [name,value] of Object.entries(values))document.querySelector(`[data-resource="${name}"]`).textContent=value;
  document.querySelector('[data-resource-balance]').textContent=state.lastWeek?`Last settled week: ${signed(state.lastWeek.netFC)} FC`:'Opening reserve · awards arrive later';
  document.querySelector('[data-weekly-summary]').textContent=`+${number(metrics.support)} support − ${number(metrics.cost)} bills`;
  document.querySelector('[data-calendar-season]').textContent=plantingSeason(state)?'Wet season · planting open':'Dry season · care for trees';
  document.querySelector('[data-resource-capacity]').textContent=`Habitat capacity: ${number(metrics.capacity)}`;
  document.querySelector('[data-resource-health]').textContent=`Habitat health: ${metrics.health}%`;
  for(const [id,value,target,action] of [['trust',state.awareness,GRANT_REQUIREMENTS.trust,'outreach builds trust'],['evidence',state.evidence,GRANT_REQUIREMENTS.evidence,'fund field monitoring']]){
    const met=value>=target;document.querySelector(`[data-resource-kind="${id}"]`).classList.toggle('requirement-met',met);
    document.querySelector(`[data-resource-${id}]`).textContent=`${met?'✓ Grant target met':`Grant needs ${target}`} · ${action}`;
  }
  for(const [id,value,target,label] of [['evidence',state.evidence,GRANT_REQUIREMENTS.evidence,'Evidence'],['trust',state.awareness,GRANT_REQUIREMENTS.trust,'Trust'],['fee',state.balanceFC,FUNDRAISERS.grant.cost,'Credits']]){
    const element=document.querySelector(`[data-grant-${id}]`),met=value>=target;
    element.textContent=`${met?'✓':'○'} ${label}: ${Math.floor(value)} / ${target}`;element.classList.toggle('met',met);
  }
}
function actOnRoute(id){
  selection={type:'route',id};const response=applyTool(state,tool,id);handle(response);
  if(response.ok){
    const link=state.links.find(entry=>entry.id===id);
    const feedback={inspect:`Inspecting ${link.name}. No funds spent.`,agreement:`Negotiations started for ${link.name}. 600 FC paid; agreement due in 12 weeks.`,bridge:`Construction started on ${link.name}. ${number(link.cost)} FC paid; completion in 16 funded weeks.`,restore:`Native trees planted along ${link.name}. 1,200 FC paid. Keep caring for them as cover expands over four years.`,repair:`${link.name} repaired. 500 FC paid; bridge condition restored to 100%.`};
    const budget=weeklyBudget(state);
    message(feedback[tool]+(tool==='inspect'?'':` Current recurring net: ${signed(budget.net)} FC/week. Budget → Details shows future care obligations as projects complete.`),'success');
  }
  revealSelection();
}
function renderInspector(){
  document.querySelector('[data-selection-panel]').hidden=!selection;
  document.querySelector('[data-selected-tool]').textContent=`Tool: ${toolNames[tool]}`;
  const title=document.querySelector('[data-inspector-title]'),copy=document.querySelector('[data-inspector]'),status=document.querySelector('[data-inspector-status]');
  status.replaceChildren();
  if(!selection){title.textContent='';copy.textContent='';return;}
  const fields=selection.type==='route'?(()=>{
    const link=state.links.find(entry=>entry.id===selection.id);title.textContent=link.name;
    copy.textContent=link.agreementDue?`Negotiations are underway. Wait ${link.agreementDue-state.totalWeeks} weeks before construction.`:!link.agreement?'Next: negotiate land access. It costs 600 FC and takes 12 weeks.':link.bridgeDue?'Construction is underway. Keep weekly bills funded until the bridge opens.':!link.built?`Next: build this bridge for ${number(link.cost)} FC. One crew is available; construction takes 16 funded weeks.`:!activeLink(link)?'This bridge is closed. Use Repair & replant to restore its condition.':!link.planted?'Next: plant native tree cover in the wet season for 1,200 FC. Trees expand habitat as they grow.':'Maintain the bridge and seedlings. Healthy tree cover expands habitat and supports population recovery.';
    return [['Land agreement',link.agreement?'Agreement signed':link.agreementDue?`Negotiating · ${link.agreementDue-state.totalWeeks} weeks left`:'Not negotiated'],['Bridge',link.bridgeDue?`Building · ${Math.max(0,link.bridgeDue-state.totalWeeks)} weeks${link.bridgeDue<=state.totalWeeks?' · waiting for funds':' left'}`:link.built?`${activeLink(link)?'Open':'Closed'} · ${Math.round(link.condition)}% condition`:'Not built'],['Tree cover',link.planted?`${Math.round(link.age/52*10)/10} years · ${Math.round(link.survival)}% survival`:'Not planted']];
  })():(()=>{
    const patch=state.patches.find(entry=>entry.id===selection.id);title.textContent=patch.name;
    copy.textContent=`${number(patch.population)} tamarins; habitat capacity ${number(habitatCapacity(state,patch))}. ${tool==='inspect'?'Click a named route on the map for land, bridge, and planting details.':`Click a named route on the map to ${toolNames[tool].toLowerCase()}.`}`;
    return [['Population',number(patch.population)],['Habitat health',`${Math.round(patch.health)}%`],['Vaccinated',`${Math.round(patch.vaccinated*100)}%`]];
  })();
  for(const [label,value] of fields){const item=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;item.append(term,detail);status.append(item);}
}
function renderMap(){
  const focus=document.activeElement?.dataset.route;
  const patchFocus=document.activeElement?.dataset.patch;
  map.innerHTML=terrainArtwork();
  const svg=map.querySelector('svg');
  for(const link of state.links){
    const from=PATCHES.find(patch=>patch.id===link.from),to=PATCHES.find(patch=>patch.id===link.to);
    if(link.planted){
      const growth=corridorGrowth(link),cover=document.createElementNS('http://www.w3.org/2000/svg','path');
      const middleX=(from.x+to.x)*5,middleY=(from.y+to.y)*3.3;
      cover.setAttribute('d',`M ${from.x*10} ${from.y*6.6} Q ${middleX} ${middleY-24} ${to.x*10} ${to.y*6.6}`);
      cover.setAttribute('stroke',link.survival<60?'#94946c':'#58864a');cover.setAttribute('stroke-width',String(5+growth*68));cover.setAttribute('stroke-linecap','round');cover.setAttribute('fill','none');cover.setAttribute('opacity',String(.2+link.survival/200));cover.classList.add('corridor-canopy');svg.append(cover);
      for(let index=1;index<=13;index+=1){
        const position=index/14,tree=document.createElementNS('http://www.w3.org/2000/svg','circle');
        tree.setAttribute('cx',String((from.x+(to.x-from.x)*position)*10));tree.setAttribute('cy',String((from.y+(to.y-from.y)*position)*6.6-8-Math.sin(position*Math.PI)*12));
        tree.setAttribute('r',String((2+growth*9)*(index%3===0?.8:1)));tree.setAttribute('fill',link.survival<60?'#a39160':'#325b3b');tree.classList.add('corridor-tree');svg.append(tree);
      }
    }
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    for(const [key,value] of Object.entries({x1:from.x*10,y1:from.y*6.6,x2:to.x*10,y2:to.y*6.6,stroke:activeLink(link)?'#a5732c':link.built?'#8f574a':'#8d8e6d','stroke-width':link.built?7:3,'stroke-dasharray':link.built?'0':'8 9'}))line.setAttribute(key,value);
    svg.append(line);
    const button=document.createElement('button');button.type='button';button.className=`route-marker ${activeLink(link)?'active':''} ${link.condition<45?'broken':''} ${selection?.type==='route'&&selection.id===link.id?'selected':''}`;
    button.style.cssText=`left:${(from.x+to.x)/2}%;top:${(from.y+to.y)/2}%`;
    button.dataset.route=link.id;button.setAttribute('aria-label',describeLink(link));
    button.setAttribute('aria-pressed',String(selection?.type==='route'&&selection.id===link.id));
    button.innerHTML=`<span>${link.name}</span><small>${link.bridgeDue?'Building':link.agreementDue?`Negotiating · ${link.agreementDue-state.totalWeeks}w`:link.planted?`${Math.floor(link.age/52)}y · ${Math.round(link.survival)}% trees`:link.built?`${Math.round(link.condition)}% bridge`:link.agreement?'Agreement signed':`${number(link.cost)} FC`}</small>`;
    button.addEventListener('click',()=>actOnRoute(link.id));map.append(button);
  }
  for(const patch of state.patches){
    const recent=patch.lastAdversity&&state.totalWeeks-patch.lastAdversity.week<26;
    const button=document.createElement('button');button.type='button';button.className=`terrain-area forest ${patch.health<40?'degraded':''} ${recent?`hit-${patch.lastAdversity.type}`:''}`;button.style.cssText=`left:${patch.x}%;top:${patch.y}%;width:${11+patch.health*.1}%;height:${16+patch.health*.14}%;opacity:${.55+patch.health/220}`;
    button.setAttribute('aria-label',`${patch.name}: ${patch.population} tamarins, health ${Math.round(patch.health)}%.`);
    button.dataset.patch=patch.id;button.classList.toggle('selected',selection?.type==='patch'&&selection.id===patch.id);
    button.innerHTML=`<span class="area-name">${patch.name} · ${number(patch.population)}</span>`+Array.from({length:Math.max(1,Math.ceil(patch.health/10))},(_,index)=>`<i class="terrain-tree" style="left:${12+index*31%65}%;top:${8+index*23%62}%"></i>`).join('')+(recent?`<span class="hazard-badge">${ADVERSITIES[patch.lastAdversity.type]}</span>`:'');
    button.addEventListener('click',()=>{selection={type:'patch',id:patch.id};message(`${patch.name} selected. ${tool==='inspect'?'Population and habitat details are shown below.':'Choose a named route to use '+toolNames[tool]+'.'}`);render();revealSelection();});map.append(button);
  }
  const token=document.querySelector('[data-tamarin]');
  const route=state.links.find(activeLink);
  if(route){const from=PATCHES.find(patch=>patch.id===route.from),to=PATCHES.find(patch=>patch.id===route.to);const phase=(state.totalWeeks%16)/8;const progress=phase<=1?phase:2-phase;token.style.left=`${from.x+(to.x-from.x)*progress}%`;token.style.top=`${from.y+(to.y-from.y)*progress}%`;}
  else{token.style.left='13%';token.style.top='28%';}
  if(focus)map.querySelector(`[data-route="${focus}"]`)?.focus({preventScroll:true});
  else if(patchFocus)map.querySelector(`[data-patch="${patchFocus}"]`)?.focus({preventScroll:true});
}
function renderFinance(metrics){
  const budget=weeklyBudget(state);
  const advice=getRecommendedStep(state);
  document.querySelector('[data-advisor]').textContent=`${advice.title}. ${advice.copy}`;
  const model=getPopulationExplanation(state);
  document.querySelector('[data-population-model]').textContent=model.explanation;
  tableRows(document.querySelector('[data-population-model-rows]'),model.patches.map(patch=>[patch.name,`${number(patch.population)} / ${number(patch.capacity)}`,patch.expectedBirths.toFixed(1),patch.expectedDeaths.toFixed(1),`${(patch.birthRate*100).toFixed(3)}% / ${(patch.deathRate*100).toFixed(3)}%`]),5,'');
  const breakdown=document.createElement('dl');breakdown.className='budget-lines';
  for(const item of [...budget.items,{label:'Weekly bills (rounded total)',amount:budget.cost,total:true},{label:'Recurring supporters',amount:-budget.support,total:true},{label:'Net weekly cost',amount:budget.burn,total:true}]){
    const row=document.createElement('div'),label=document.createElement('dt'),amount=document.createElement('dd');
    row.classList.toggle('budget-total',!!item.total);label.textContent=`${item.label}${item.base!==undefined?` · ${item.base} × ${budget.operationsMultiplier}`:''}`;amount.textContent=`${number(item.amount)} FC`;row.append(label,amount);breakdown.append(row);
  }
  document.querySelector('[data-budget-breakdown]').replaceChildren(breakdown);
  const support=budget.supportInputs;
  document.querySelector('[data-support-formula]').textContent=`Recurring support = floor((max(0, trust − ${support.trustThreshold}) × ${support.trustPerPoint} + ${support.perMatureCorridor} per mature corridor when trust ≥ ${support.corridorTrust}) × ${budget.incomeMultiplier}). Current trust ${state.awareness.toFixed(2)}; mature corridors ${support.matureCorridors}. Result: ${number(budget.support)} FC/week. Bills are rounded once on the total; line items allocate that exact bill. Income is rounded down. ${budget.grant.explanation}`;
  const last=state.lastWeek;
  document.querySelector('[data-last-week]').textContent=last?`Week ${last.week}: opening ${number(last.openingBalanceFC)} + income ${number(last.incomeFC)} − spending ${number(last.expensesFC)} = closing ${number(last.closingBalanceFC)} FC (net ${signed(last.netFC)}). ${last.funded?'Operations fully paid.':`Operations shortfall: paid ${number(last.operationsPaidFC)} of ${number(last.operationsDueFC)} FC.`} Includes actions since the preceding settled week. ${last.categories.map(item=>`${item.category}: +${number(item.incomeFC)} / −${number(item.expensesFC)} FC`).join('; ')}.`:'No completed week yet. Any setup or route purchases already appear below.';
  tableRows(document.querySelector('[data-ledger]'),state.ledger.slice(-40).reverse().map(entry=>[ledgerDate(entry),entry.category,signed(entry.amount)]),3,'No transactions yet.');
  document.querySelector('[data-risk]').textContent=state.shortfallWeeks?`Unpaid operations: ${state.shortfallWeeks} weeks. Habitat is degrading and tamarins are dying. Raise funds immediately.`:metrics.runway<20?`Only ${metrics.runway} weeks of cash. Upcoming grants are not cash in hand. Delay expansion or fundraise now.`:'Maintain a reserve for disease prevention, fire response, and grant delays.';
  for(const button of document.querySelectorAll('[data-service]')){
    const name=button.dataset.service,config=PROGRAMS[name],timer=state.programTimers[name],active=state.services[name];
    const rest=Math.max(0,(timer?.readyAt||0)-state.totalWeeks),commit=Math.max(0,(timer?.commitUntil||0)-state.totalWeeks);
    button.setAttribute('aria-pressed',String(active));button.disabled=state.status!=='playing'||(!active&&rest>0)||(active&&commit>0);
    const status=active?`Running: ${timer.endsAt-state.totalWeeks} weeks left${commit?`; committed ${commit} more`:'; pause available'}`:rest?`Turnaround: ${rest} weeks left`:`Start: ${config.setup} FC setup + ${Math.round(SERVICES[name]*getDifficulty(state).operations)}/week`;
    const benefits={outreach:'Paid weeks: +0.95 trust; without outreach, trust falls 0.25/week. Trust brings recurring supporters and reduces construction damage.',monitoring:'Paid weeks: +0.9 evidence, +1 reporting week. New grant reports need 4 paid weeks after the first installment.',nursery:'Paid care improves survival by 0.35 points/week in the two lowest-survival plantings.',health:'Paid weeks add vaccination gradually (1.2 percentage points, diluted by births); protection remains afterward.',fireWatch:'Reduces fire deaths and damage only while the response team is funded.'};
    button.innerHTML=`${config.label}<small>${status}${active?`; ${Math.round(SERVICES[name]*getDifficulty(state).operations)} FC/week`:''}</small><small>${benefits[name]}</small><small>${config.limit}</small>`;
  }
  const current=state.fundraisers.find(entry=>!entry.completed);
  document.querySelector('[data-campaign]').textContent=current?current.firstPaid?`Grant: first half received. Final half requires 13 weeks and four new paid monitoring weeks (${Math.min(4,state.reportWork-current.reportBaseline)}/4 complete).`:`${FUNDRAISERS[current.id].label}: ${Math.max(0,current.due-state.totalWeeks)} weeks remaining.`:'Fundraising team available. One campaign at a time.';
  for(const button of document.querySelectorAll('[data-fundraiser]')){
    const id=button.dataset.fundraiser,config=FUNDRAISERS[id],wait=Math.max(0,(state.cooldowns[id]||0)-state.totalWeeks);
    const lacksGrantRequirements=id==='grant'&&(state.evidence<GRANT_REQUIREMENTS.evidence||state.awareness<GRANT_REQUIREMENTS.trust);
    button.disabled=state.status!=='playing'||!!current||wait>0||state.balanceFC<config.cost||lacksGrantRequirements||(id==='appeal'&&state.balanceFC>=1000&&state.shortfallWeeks===0);
    if(id==='grant')document.querySelector('[data-grant-availability]').textContent=state.status!=='playing'?'Campaign ended':current?'Fundraising team busy':wait?`Renewal cooldown: ${wait} weeks`:lacksGrantRequirements?'Not ready · build the missing resources':state.balanceFC<config.cost?'Not ready · need application credits':'Ready to apply';
    const award=fundingAward(state,id);
    const reason=current?'Team busy. ':wait?`Cooldown: ${wait} weeks. `:state.balanceFC<config.cost?'Not enough setup credits. ':id==='appeal'&&state.balanceFC>=1000&&state.shortfallWeeks===0?'Only in a cash crisis below 1,000 FC. ':'';
    button.querySelector('small').textContent=`${reason}${config.cost} FC now · ${config.duration} weeks · ${id==='grant'?`${number(budget.grant.firstInstallmentFC)} + ${number(budget.grant.finalInstallmentFC)} FC`:`base ${number(award)} FC${id==='appeal'?'':' (trust & turnout affect payout)'}`} · ${config.cooldown}-week rest after completion`;
  }
  document.querySelector('[data-season]').textContent=plantingSeason(state)?`Wet-season planting window: ${22-state.totalWeeks%52} weeks remaining (October–February).`:`Dry season: planting opens in ${52-state.totalWeeks%52} weeks. Maintain existing seedlings now.`;
  const warning=state.nextAdversity.week-state.totalWeeks;
  const prevention={'yellow-fever':'Start veterinary visits early: vaccination builds over several weeks.',wildfire:'Time a funded 13-week fire team run to cover the event.',construction:'Paid outreach reduces clearing damage.',drought:'Nursery care protects at most two planting areas.',storm:'Keep a repair reserve and inspect damaged bridges.'};
  document.querySelector('[data-threat]').textContent=`${ADVERSITIES[state.nextAdversity.type]} near ${PATCHES.find(patch=>patch.id===state.nextAdversity.patchId).name} in ${warning} weeks. ${prevention[state.nextAdversity.type]} This is the next scheduled game event, not a real-world forecast.`;
  document.querySelector('[data-history]').innerHTML=state.annualReports.slice(-5).reverse().map(report=>`<tr><td>${report.year}</td><td>${number(report.income)}</td><td>${number(report.expenses)}</td><td>${number(report.closing)}</td><td>${number(report.population)}</td></tr>`).join('')||'<tr><td colspan="5">Your first report arrives after 52 weeks.</td></tr>';
  document.querySelector('[data-difficulty-copy]').textContent=`${getDifficulty(state).label}: ${getDifficulty(state).description}`;
}
function renderTutorial(){
  const panel=document.querySelector('[data-tutorial]');panel.hidden=state.difficulty!=='tutorial';
  document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));
  if(panel.hidden)return;
  const step=getTutorialStep(state);
  document.querySelector('[data-tutorial-title]').textContent=step.title;
  document.querySelector('[data-tutorial-copy]').textContent=step.copy;
  const next=document.querySelector('[data-tutorial-next]');next.textContent=step.button;next.disabled=step.kind==='done';
  const target=step.kind==='program'?`[data-service="${step.id}"]`:step.kind==='fundraiser'?`[data-fundraiser="${step.id}"]`:step.kind==='route'?`[data-route="${step.id}"]`:null;
  if(target)document.querySelector(target)?.classList.add('tutorial-target');
}
function render(){
  const metrics=getMetrics(state);
  document.querySelector('[data-player-open]').textContent=`Player: ${players.current().nickname}`;
  const goals={network:metrics.largest===6,forest:metrics.mature>=5,population:metrics.population>=10000,health:metrics.health>=70,community:state.awareness>=65,stability:metrics.capacity>=10000};
  const labels={network:`Connected habitat: ${metrics.largest}/6 groves`,forest:`Mature corridors: ${metrics.mature}`,population:`Population: ${number(metrics.population)} / 10,000`,health:`Habitat health: ${metrics.health}%`,community:`Community trust: ${Math.floor(state.awareness)}%`,stability:`Habitat capacity: ${number(metrics.capacity)}`};
  const progress=document.querySelector('[data-population-progress]');progress.value=metrics.population;
  document.querySelector('[data-population-change]').textContent=`${metrics.population>=5000?'+':''}${number(metrics.population-5000)} since the campaign began`;
  const population=getPopulationExplanation(state),lastPopulation=population.lastWeek;
  document.querySelector('[data-population-reason]').textContent=lastPopulation?`Last week: ${signed(lastPopulation.naturalChange)} natural change, ${number(lastPopulation.adversityDeaths)} threat deaths = ${signed(lastPopulation.change)} tamarins. Next-week estimate: ${population.expectedBirths.toFixed(1)} births − ${population.expectedDeaths.toFixed(1)} deaths before threats. ${population.funded?'Care can be paid.':'Insufficient reserves for care.'}`:`Current-condition estimate: ${population.expectedBirths.toFixed(1)} births − ${population.expectedDeaths.toFixed(1)} deaths/week before threats. Habitat capacity, isolation and care determine recovery.`;
  for(const [id,done] of Object.entries(goals)){const element=document.querySelector(`[data-objective="${id}"]`);element.textContent=labels[id];element.classList.toggle('complete',done);}
  document.querySelector('[data-route-status]').textContent=`${metrics.largest}/6 connected`;
  document.querySelector('[data-pause]').textContent=state.difficulty==='tutorial'?'Guided time':state.paused?'Start':'Pause';document.querySelector('[data-pause]').disabled=state.status!=='playing'||state.difficulty==='tutorial';
  document.querySelectorAll('[data-speed]').forEach(button=>{button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===state.speed));button.disabled=state.difficulty==='tutorial';});
  document.querySelector('[data-step]').disabled=state.status!=='playing'||state.difficulty==='tutorial';
  document.querySelector('[data-time-summary]').textContent=state.difficulty==='tutorial'?'Guided time waits for your next decision.':`${state.speed} simulated ${state.speed===1?'week':'weeks'}/second · ${state.paused?'paused':'running'}`;
  const rate=getDifficulty(state).operations,weekly=value=>`${rate===1?'':'≈'}${Math.round(value*rate)}`;
  const toolCosts={agreement:`600 FC · 12 weeks · +${weekly(9)}/week`,bridge:`1,800–3,400 FC · +${weekly(15)}/week`,restore:`1,200 FC · 4 years · +${weekly(16)}/week`};
  document.querySelectorAll('[data-tool]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.tool===tool));button.disabled=state.status!=='playing';if(toolCosts[button.dataset.tool])button.querySelector('small').textContent=toolCosts[button.dataset.tool];});
  document.querySelector('[data-wildlife]').innerHTML=Object.entries(state.wildlife).map(([name,value])=>`<div class="wildlife-row"><span>${name}</span><strong>${value-100>=0?'+':''}${value-100}%</strong></div>`).join('');
  document.querySelector('[data-event-log]').innerHTML=state.events.map(entry=>`<li class="${entry.tone}"><time>${entry.week} weeks elapsed</time>${entry.message}</li>`).join('');
  renderResources(metrics);renderMap();renderFinance(metrics);renderInspector();renderTutorial();
  if(state.status!=='playing'&&!terminalShown){terminalShown=true;report();}
}
function report(annual=false){
  const metrics=getMetrics(state),won=state.status==='won',ended=state.status!=='playing';
  const reasons={'lost-population':'The simulated population fell below 1,000. Habitat loss, disease, and gaps in care overwhelmed recovery. Reset to try a different conservation plan.'};
  document.querySelector('[data-report-stamp]').textContent=ended?won?'Recovery sustained':'Campaign ended':'Annual review';
  document.querySelector('[data-report-title]').textContent=ended?won?'A forest with a future':'The program needs a new plan':`Year ${metrics.year-1} report`;
  document.querySelector('[data-report-copy]').textContent=ended?won?'The population has recovered to at least 10,000 tamarins. Bridges helped connect habitat; expanding forest and ongoing protection made recovery possible.':reasons[state.status]:`${number(metrics.population)} tamarins, ${number(metrics.population-5000)} compared with the starting population. Habitat supports about ${number(metrics.capacity)}. Plan protection and funding before expanding.`;
  for(const [name,value] of Object.entries({funds:`${number(state.balanceFC)} FC`,forest:`${metrics.forestPercent}%`,capacity:number(metrics.capacity),tamarins:number(metrics.population)}))document.querySelector(`[data-report="${name}"]`).textContent=value;
  document.querySelector('[data-report-continue]').textContent=ended?'Close report':'Continue the campaign';document.querySelector('[data-report-reset]').hidden=!ended;
  document.querySelector('[data-report-leaderboard]').hidden=!ended;
  document.querySelector('[data-report-share]').hidden=!ended;
  document.querySelector('[data-report-share]').disabled=!onlineConfigured();
  document.querySelector('[data-report-share]').textContent='Share result online';
  if(ended){
    const score=players.recordScore(state);
    document.querySelector('[data-score-message]').textContent=score?`${state.difficulty==='tutorial'?'Practice result':'Result'} saved to this device for ${players.current().nickname}. ${players.persistent?'':'Storage is blocked: this session only.'}`:'';
  }else document.querySelector('[data-score-message]').textContent='';
  if(!dialog.open){dialog.returnValue='';dialog.showModal();}
}
function weekFeedback(){
  const last=state.lastWeek;if(!last)return;
  message(`Week ${state.totalWeeks}: income +${number(last.incomeFC)} − spending ${number(last.expensesFC)} = ${signed(last.netFC)} FC. Population ${signed(last.population.change)}${last.population.adversityDeaths?` (${number(last.population.adversityDeaths)} threat deaths)`:''}. ${last.funded?'Care paid.':'UNPAID CARE: habitat is degrading.'} Budget → Details shows every transaction.`,last.funded?'':'error');
}
function clock(){
  clearInterval(timer);if(state.paused||state.status!=='playing')return;
  timer=setInterval(()=>{state=simulateOneWeek(state);weekFeedback();if(state.totalWeeks%52===0&&state.status==='playing'){state.paused=true;clearInterval(timer);render();report(true);}else{render();if(state.status!=='playing')clearInterval(timer);}if(state.totalWeeks%4===0||state.paused)save();},1000/state.speed);
}
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{tool=button.dataset.tool;message(`${button.querySelector('small')?.textContent||tool}. Select a named route on the map.`);render();});
for(const button of document.querySelectorAll('[data-service]'))button.addEventListener('click',()=>handle(toggleService(state,button.dataset.service)));
for(const button of document.querySelectorAll('[data-fundraiser]'))button.addEventListener('click',()=>handle(startFundraiser(state,button.dataset.fundraiser)));
for(const button of document.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{state.speed=Number(button.dataset.speed);render();clock();});
document.querySelector('[data-pause]').addEventListener('click',()=>{state.paused=!state.paused;render();clock();save();});
document.querySelector('[data-save]').addEventListener('click',()=>{save();if(players.persistent)message(`Campaign saved on this device for ${players.current().nickname}.`);});
function reset(difficulty=state.difficulty){
  if(dialog.open)dialog.close('reset');
  state=prepareCampaign(createInitialState(73,difficulty));document.querySelector('[data-difficulty]').value=state.difficulty;
  selection=null;terminalShown=false;tool='inspect';render();clock();save();
  message(state.difficulty==='tutorial'?'Follow the highlighted next step. Guided time advances only when you are ready.':`New ${getDifficulty(state).label} campaign. Start outreach and monitoring, plan fundraising, and keep reserves before building.`);
}
function requestReset(difficulty=state.difficulty){
  if(state.status==='playing'&&(state.totalWeeks>0||state.ledger.length)&&!window.confirm('Replace this player’s current campaign? Completed leaderboard results are kept.'))return;
  reset(difficulty);
}
document.querySelector('[data-reset]').addEventListener('click',()=>requestReset());document.querySelector('[data-report-reset]').addEventListener('click',()=>reset());
document.querySelector('[data-new-game]').addEventListener('click',()=>requestReset(document.querySelector('[data-difficulty]').value));
document.querySelector('[data-difficulty]').addEventListener('change',()=>message(`${document.querySelector('[data-difficulty]').selectedOptions[0].textContent} selected. Press New game to apply; the current campaign stays ${getDifficulty(state).label}.`));
document.querySelector('[data-step]').addEventListener('click',()=>{state=simulateOneWeek({...state,paused:false});state.paused=true;clock();weekFeedback();save();render();});
document.querySelector('[data-inspector-close]').addEventListener('click',()=>{selection=null;render();});
document.querySelector('[data-tutorial-next]').addEventListener('click',()=>{
  const step=getTutorialStep(state);
  if(step.kind==='route'){selection={type:'route',id:step.id};tool=step.tool;}
  handle(performTutorialStep(state));clock();
});
map.addEventListener('click',event=>{if(!event.target.closest('[data-route], [data-patch]')){message(`Choose a named route to ${toolNames[tool].toLowerCase()}, or a forest grove to see its connected routes.`);revealSelection();}});
dialog.addEventListener('close',()=>{if(state.status==='playing'&&dialog.returnValue==='continue'&&state.difficulty!=='tutorial'){state.paused=false;clock();render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;clock();save();render();}});
const mapHost=document.querySelector('.map-scroll');
function fitMap(){const bounds=mapHost.getBoundingClientRect();document.querySelector('.map-wrap').style.width=`${Math.max(0,Math.floor(Math.min(bounds.width,bounds.height*1000/660)))}px`;}
const mapObserver=new ResizeObserver(fitMap);mapObserver.observe(mapHost);
function openPanel(panel){
  state.paused=true;clock();save();render();
  if(!panel.open)panel.showModal();
}
for(const button of document.querySelectorAll('[data-close-dialog]'))button.addEventListener('click',()=>button.closest('dialog').close());
document.querySelector('[data-budget-open]').addEventListener('click',()=>openPanel(document.querySelector('[data-budget-dialog]')));
document.querySelector('[data-fullscreen]').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else message('This browser does not support full screen. The game already fills its window.','error');}
  catch{message('Full screen was blocked by the browser. You can keep playing in this window.','error');}
});
document.addEventListener('fullscreenchange',()=>{document.querySelector('[data-fullscreen]').textContent=document.fullscreenElement?'Exit full screen':'Full screen';fitMap();});
function refreshProfileList(){
  const list=document.querySelector('[data-player-list]');list.replaceChildren();
  for(const profile of players.profiles()){
    const button=document.createElement('button');button.type='button';button.className='game-button';button.textContent=profile.nickname;button.addEventListener('click',()=>switchPlayer(()=>players.select(profile.id)));list.append(button);
  }
}
function switchPlayer(select){
  save();select();
  for(const panel of document.querySelectorAll('dialog[open]'))panel.close('switch');
  state=prepareCampaign(players.loadCampaign());selection=null;tool='inspect';terminalShown=false;
  document.querySelector('[data-difficulty]').value=state.difficulty;
  document.querySelector('[data-player-dialog]').close();clock();save();render();
  message(`${players.current().nickname}’s campaign. Progress is kept separately on this device.`);
}
document.querySelector('[data-player-open]').addEventListener('click',()=>{refreshProfileList();refreshOnlineControls();openPanel(document.querySelector('[data-player-dialog]'));});
document.querySelector('[data-player-form]').addEventListener('submit',event=>{
  event.preventDefault();
  try{switchPlayer(()=>players.useNickname(document.querySelector('#player-name').value));document.querySelector('[data-player-feedback]').textContent='';}
  catch(error){document.querySelector('[data-player-feedback]').textContent=error.message;}
});
document.querySelector('[data-guest]').addEventListener('click',()=>switchPlayer(()=>players.select('guest')));
document.querySelector('[data-clear-player]').addEventListener('click',()=>{
  if(!window.confirm('Delete this local profile, its campaign save, and its leaderboard scores?'))return;
  players.deleteCurrent();state=prepareCampaign(players.loadCampaign());selection=null;tool='inspect';terminalShown=false;document.querySelector('[data-difficulty]').value=state.difficulty;document.querySelector('[data-player-dialog]').close();save();render();clock();
});
function renderLeaderboard(){
  const mode=document.querySelector('[data-leaderboard-mode]').value,scores=rankScores(players.scores(),mode);
  let rank=0;
  tableRows(document.querySelector('[data-leaderboard-rows]'),scores.map(score=>[score.status==='won'&&mode!=='tutorial'?++rank:'—',score.nickname,score.status==='won'?'Recovered':'Campaign ended',score.weeks,number(score.population),number(score.funds)]),6,'No completed campaigns in this mode yet.');
  document.querySelector('[data-leaderboard-empty]').textContent='Complete a campaign to add a result. Tutorial practice never competes with unassisted play.';
}
function openLeaderboard(){document.querySelector('[data-leaderboard-mode]').value=state.difficulty;openPanel(document.querySelector('[data-leaderboard-dialog]'));refreshLeaderboard();}
document.querySelector('[data-leaderboard-open]').addEventListener('click',openLeaderboard);
document.querySelector('[data-report-leaderboard]').addEventListener('click',()=>{dialog.close('leaderboard');openLeaderboard();});
document.querySelector('[data-leaderboard-mode]').addEventListener('change',refreshLeaderboard);
document.querySelector('[data-leaderboard-scope]').addEventListener('change',refreshLeaderboard);
let leaderboardRequest=0,submittingScore=false;
async function refreshLeaderboard(){
  const request=++leaderboardRequest,scope=document.querySelector('[data-leaderboard-scope]').value;
  if(scope==='device'){renderLeaderboard();return;}
  const mode=document.querySelector('[data-leaderboard-mode]').value;
  tableRows(document.querySelector('[data-leaderboard-rows]'),[],6,'Loading online results…');
  document.querySelector('[data-leaderboard-empty]').textContent='Online · Unverified client scores. Email addresses are never shown.';
  try{
    const scores=await fetchOnlineLeaderboard(mode);
    if(request!==leaderboardRequest)return;
    let rank=0;
    tableRows(document.querySelector('[data-leaderboard-rows]'),scores.map(score=>[score.status==='won'&&mode!=='tutorial'?++rank:'—',score.nickname,score.status==='won'?'Recovered':'Campaign ended',score.weeks,number(score.population),number(score.funds)]),6,'No online results in this mode yet.');
  }catch{if(request===leaderboardRequest)tableRows(document.querySelector('[data-leaderboard-rows]'),[],6,'Online leaderboard unavailable. Try again later or switch to This device.');}
}
async function syncCompletedScore(){
  if(state.status==='playing'||submittingScore)return;
  const campaign=structuredClone(state),nickname=players.current().nickname,button=document.querySelector('[data-report-share]');
  submittingScore=true;button.disabled=true;button.textContent='Sharing…';
  try{
    await submitOnlineScore(campaign,nickname);
    if(state.campaignId===campaign.campaignId){
      document.querySelector('[data-score-message]').textContent='Result shared publicly as '+nickname+'. No email or account is linked to this unverified result.';
      button.textContent='Result shared';
    }
  }catch{
    if(state.campaignId===campaign.campaignId){
      document.querySelector('[data-score-message]').textContent='Could not share online. Your local result is safe; try again later.';
      button.disabled=false;button.textContent='Retry sharing result';
    }
  }finally{submittingScore=false;}
}
function refreshOnlineControls(){
  const enabled=onlineConfigured();
  document.querySelector('[data-interest-form] button').disabled=!enabled;
  document.querySelector('[data-withdraw-form] button').disabled=!enabled;
  document.querySelector('[data-online-status]').textContent=enabled?'No sign-in needed. Sharing an email is optional, and no verification messages are sent.':'Online records are not configured yet. Guest play still works without an email.';
  document.querySelector('[data-online-scope-option]').disabled=!enabled;
}
document.querySelector('[data-interest-form]').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button'),feedback=document.querySelector('[data-interest-feedback]');
  if(!form.reportValidity())return;
  const values={email:form.elements.email.value,adultConfirmed:form.elements.adultConfirmed.checked,outreachConsent:form.elements.outreachConsent.checked,website:form.elements.website.value};
  button.disabled=true;feedback.textContent='Saving your preference…';
  try{
    await recordProjectInterest(values);form.reset();
    feedback.textContent='Thank you. Your request was received. No email or verification code was sent. Previously withdrawn addresses stay opted out.';
  }catch(error){feedback.textContent=error.message;}
  finally{button.disabled=false;}
});
document.querySelector('[data-withdraw-form]').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button'),feedback=document.querySelector('[data-withdraw-feedback]');
  if(!form.reportValidity())return;
  const values={email:form.elements.email.value,adultConfirmed:form.elements.adultConfirmed.checked};
  button.disabled=true;feedback.textContent='Saving your preference…';
  try{
    await withdrawProjectInterest(values);form.reset();
    feedback.textContent='Request received. If that email is on our list, future outreach is disabled. A private suppression record is retained to honor the request.';
  }catch(error){feedback.textContent=error.message;}
  finally{button.disabled=false;}
});
document.querySelector('[data-report-share]').addEventListener('click',syncCompletedScore);
render();fitMap();clock();save();refreshOnlineControls();
