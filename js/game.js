import {PATCHES,FUNDRAISERS,SERVICES,PROGRAMS,ADVERSITIES,GRANT_REQUIREMENTS,getDifficulty,fundingAward,corridorGrowth,habitatCapacity,plantingSeason,createInitialState,applyTool,describeLink,activeLink,getMetrics,simulateOneWeek,startFundraiser,toggleService} from './game-core.js';
import {terrainArtwork} from './terrain.js';
import {getTutorialStep,performTutorialStep} from './game-guide.js';

const storageKey='tamarinTrailsCampaignV5';
const map=document.querySelector('[data-game-map]');
const dialog=document.querySelector('[data-report-dialog]');
let state=load()||createInitialState();
let tool='inspect',timer=null,terminalShown=false;
let selection=null;
const toolNames={inspect:'Inspect',agreement:'Negotiate',bridge:'Build bridge',restore:'Plant cover',repair:'Repair & replant'};
document.querySelector('[data-difficulty]').value=state.difficulty||'challenge';
function load(){try{const saved=JSON.parse(localStorage.getItem(storageKey));return saved?.version===5?saved:null;}catch{return null;}}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{message('Browser storage is full. This session can continue, but could not be saved.','error');}}
function message(copy,tone=''){const target=document.querySelector('[data-game-message]');target.textContent=copy;target.className=`game-message ${tone}`;}
const number=value=>Math.round(value).toLocaleString();
function handle(result){state=result.state;message(result.message,result.ok?'success':'error');save();render();}
function revealSelection(){
  const panel=document.querySelector('[data-selection-panel]'),bounds=panel.getBoundingClientRect();
  const barBottom=document.querySelector('[data-resource-bar]').getBoundingClientRect().bottom;
  if(bounds.top<barBottom||bounds.top>innerHeight-120)panel.scrollIntoView({block:'start',behavior:'instant'});
}
function renderResources(metrics){
  const values={funds:`${number(state.balanceFC)} FC`,trust:`${Math.floor(state.awareness)} / 100`,evidence:`${Math.floor(state.evidence)} / 100`,tamarins:number(metrics.population),forest:`${metrics.forestPercent}%`,runway:metrics.runway===Infinity?'Covered':`${metrics.runway} weeks`};
  for(const [name,value] of Object.entries(values))document.querySelector(`[data-resource="${name}"]`).textContent=value;
  document.querySelector('[data-resource-balance]').textContent=`${metrics.burn>0?'−':'+'}${number(Math.abs(metrics.burn))} FC/week · Y${metrics.year} W${metrics.week}`;
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
    message(feedback[tool],'success');
  }
  revealSelection();
}
function renderInspector(){
  document.querySelector('[data-selected-tool]').textContent=`Tool: ${toolNames[tool]}`;
  const title=document.querySelector('[data-inspector-title]'),copy=document.querySelector('[data-inspector]'),status=document.querySelector('[data-inspector-status]'),routes=document.querySelector('[data-inspector-routes]');
  status.replaceChildren();
  for(const link of state.links){
    let button=routes.querySelector(`[data-inspector-route="${link.id}"]`);
    if(!button){
      button=document.createElement('button');button.type='button';button.dataset.inspectorRoute=link.id;
      button.addEventListener('click',()=>actOnRoute(link.id));routes.append(button);
    }
    const label=`${toolNames[tool]}: ${link.name}`;
    if(button.textContent!==label)button.textContent=label;
    button.setAttribute('aria-pressed',String(selection?.type==='route'&&selection.id===link.id));
    button.disabled=state.status!=='playing';
  }
  if(!selection){title.textContent='Choose a route or forest grove';copy.textContent='Click a named route to inspect it or use your selected tool. Click a forest grove to see its population and available routes.';return;}
  const fields=selection.type==='route'?(()=>{
    const link=state.links.find(entry=>entry.id===selection.id);title.textContent=link.name;
    copy.textContent=link.agreementDue?`Negotiations are underway. Wait ${link.agreementDue-state.totalWeeks} weeks before construction.`:!link.agreement?'Next: negotiate land access. It costs 600 FC and takes 12 weeks.':link.bridgeDue?'Construction is underway. Keep weekly bills funded until the bridge opens.':!link.built?`Next: build this bridge for ${number(link.cost)} FC. One crew is available; construction takes 16 funded weeks.`:!activeLink(link)?'This bridge is closed. Use Repair & replant to restore its condition.':!link.planted?'Next: plant native tree cover in the wet season for 1,200 FC. Trees expand habitat as they grow.':'Maintain the bridge and seedlings. Healthy tree cover expands habitat and supports population recovery.';
    return [['Land agreement',link.agreement?'Agreement signed':link.agreementDue?`Negotiating · ${link.agreementDue-state.totalWeeks} weeks left`:'Not negotiated'],['Bridge',link.bridgeDue?`Building · ${Math.max(0,link.bridgeDue-state.totalWeeks)} weeks${link.bridgeDue<=state.totalWeeks?' · waiting for funds':' left'}`:link.built?`${activeLink(link)?'Open':'Closed'} · ${Math.round(link.condition)}% condition`:'Not built'],['Tree cover',link.planted?`${Math.round(link.age/52*10)/10} years · ${Math.round(link.survival)}% survival`:'Not planted']];
  })():(()=>{
    const patch=state.patches.find(entry=>entry.id===selection.id);title.textContent=patch.name;
    copy.textContent=`${number(patch.population)} tamarins; habitat capacity ${number(habitatCapacity(state,patch))}. ${tool==='inspect'?'Inspect any route below for land, bridge, and planting details.':`Choose a route below to ${toolNames[tool].toLowerCase()}.`}`;
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
  document.querySelector('[data-finance]').innerHTML=`<div><span>Weekly bills</span><strong>${number(metrics.cost)} FC</strong></div><div><span>Recurring support</span><strong>+${number(metrics.support)} FC</strong></div><div><span>Net weekly burn</span><strong>${number(metrics.burn)} FC</strong></div><div class="${metrics.runway<20?'critical':''}"><span>Cash runway</span><strong>${metrics.runway===Infinity?'Covered':`${metrics.runway} weeks`}</strong></div><div><span>Community trust</span><strong>${Math.floor(state.awareness)}/100</strong></div><div><span>Monitoring evidence</span><strong>${Math.floor(state.evidence)}/100</strong></div>`;
  document.querySelector('[data-risk]').textContent=state.shortfallWeeks?`Unpaid operations: ${state.shortfallWeeks} weeks. Habitat is degrading and tamarins are dying. Raise funds immediately.`:metrics.runway<20?`Only ${metrics.runway} weeks of cash. Upcoming grants are not cash in hand. Delay expansion or fundraise now.`:'Maintain a reserve for disease prevention, fire response, and grant delays.';
  for(const button of document.querySelectorAll('[data-service]')){
    const name=button.dataset.service,config=PROGRAMS[name],timer=state.programTimers[name],active=state.services[name];
    const rest=Math.max(0,(timer?.readyAt||0)-state.totalWeeks),commit=Math.max(0,(timer?.commitUntil||0)-state.totalWeeks);
    button.setAttribute('aria-pressed',String(active));button.disabled=state.status!=='playing'||(!active&&rest>0)||(active&&commit>0);
    const status=active?`Running: ${timer.endsAt-state.totalWeeks} weeks left${commit?`; committed ${commit} more`:'; pause available'}`:rest?`Turnaround: ${rest} weeks left`:`Start: ${config.setup} FC setup + ${Math.round(SERVICES[name]*getDifficulty(state).operations)}/week`;
    button.innerHTML=`${config.label}<small>${status}</small><small>${config.limit}</small>`;
  }
  const current=state.fundraisers.find(entry=>!entry.completed);
  document.querySelector('[data-campaign]').textContent=current?current.firstPaid?`Grant: first half received. Final half requires 13 weeks and four new paid monitoring weeks (${Math.min(4,state.reportWork-current.reportBaseline)}/4 complete).`:`${FUNDRAISERS[current.id].label}: ${Math.max(0,current.due-state.totalWeeks)} weeks remaining.`:'Fundraising team available. One campaign at a time.';
  for(const button of document.querySelectorAll('[data-fundraiser]')){
    const id=button.dataset.fundraiser,config=FUNDRAISERS[id],wait=Math.max(0,(state.cooldowns[id]||0)-state.totalWeeks);
    const lacksGrantRequirements=id==='grant'&&(state.evidence<GRANT_REQUIREMENTS.evidence||state.awareness<GRANT_REQUIREMENTS.trust);
    button.disabled=state.status!=='playing'||!!current||wait>0||state.balanceFC<config.cost||lacksGrantRequirements||(id==='appeal'&&state.balanceFC>=1000&&state.shortfallWeeks===0);
    if(id==='grant')document.querySelector('[data-grant-availability]').textContent=state.status!=='playing'?'Campaign ended':current?'Fundraising team busy':wait?`Renewal cooldown: ${wait} weeks`:lacksGrantRequirements?'Not ready · build the missing resources':state.balanceFC<config.cost?'Not ready · need application credits':'Ready to apply';
    const award=fundingAward(state,id);
    button.querySelector('small').textContent=`${wait?`Cooldown: ${wait} weeks remaining. `:''}${config.cost} FC · ${config.duration} weeks · ${id==='grant'?`${number(award/2)} + ${number(award/2)} FC`:`base ${number(award)} FC`} · ${config.cooldown}-week rest after completion`;
  }
  document.querySelector('[data-season]').textContent=plantingSeason(state)?`Wet-season planting window: ${22-state.totalWeeks%52} weeks remaining (October–February).`:`Dry season: planting opens in ${52-state.totalWeeks%52} weeks. Maintain existing seedlings now.`;
  const warning=state.nextAdversity.week-state.totalWeeks;
  document.querySelector('[data-threat]').textContent=warning<=26?`${ADVERSITIES[state.nextAdversity.type]} risk near ${PATCHES.find(patch=>patch.id===state.nextAdversity.patchId).name}. Response window: ${warning} weeks. Prepare local teams and cash reserves.`:'No immediate threat alert. Disease, construction, fire, drought, and storms can set back recovery. Prevention takes time.';
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
  for(const [name,value] of Object.entries({funds:`${number(state.balanceFC)} FC`,calendar:`Y${metrics.year} · W${metrics.week}`,tamarins:number(metrics.population),forest:`${metrics.forestPercent}%`,capacity:number(metrics.capacity)}))document.querySelector(`[data-hud="${name}"]`).textContent=value;
  const goals={network:metrics.largest===6,forest:metrics.mature>=5,population:metrics.population>=10000,health:metrics.health>=70,community:state.awareness>=65,stability:metrics.capacity>=10000};
  const labels={network:`Connected habitat: ${metrics.largest}/6 groves`,forest:`Mature corridors: ${metrics.mature}`,population:`Population: ${number(metrics.population)} / 10,000`,health:`Habitat health: ${metrics.health}%`,community:`Community trust: ${Math.floor(state.awareness)}%`,stability:`Habitat capacity: ${number(metrics.capacity)}`};
  const progress=document.querySelector('[data-population-progress]');progress.value=metrics.population;
  document.querySelector('[data-population-change]').textContent=`${metrics.population>=5000?'+':''}${number(metrics.population-5000)} since the campaign began`;
  for(const [id,done] of Object.entries(goals)){const element=document.querySelector(`[data-objective="${id}"]`);element.textContent=labels[id];element.classList.toggle('complete',done);}
  document.querySelector('[data-route-status]').textContent=`${metrics.largest}/6 connected`;
  document.querySelector('[data-pause]').textContent=state.difficulty==='tutorial'?'Guided time':state.paused?'Start':'Pause';document.querySelector('[data-pause]').disabled=state.status!=='playing'||state.difficulty==='tutorial';
  document.querySelectorAll('[data-speed]').forEach(button=>{button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===state.speed));button.disabled=state.difficulty==='tutorial';});
  const rate=getDifficulty(state).operations,weekly=value=>`${rate===1?'':'≈'}${Math.round(value*rate)}`;
  const toolCosts={agreement:`600 FC · 12 weeks · +${weekly(9)}/week`,bridge:`1,800–3,400 FC · +${weekly(15)}/week`,restore:`1,200 FC · 4 years · +${weekly(16)}/week`};
  document.querySelectorAll('[data-tool]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.tool===tool));button.disabled=state.status!=='playing';if(toolCosts[button.dataset.tool])button.querySelector('small').textContent=toolCosts[button.dataset.tool];});
  document.querySelector('[data-wildlife]').innerHTML=Object.entries(state.wildlife).map(([name,value])=>`<div class="wildlife-row"><span>${name}</span><strong>${value-100>=0?'+':''}${value-100}%</strong></div>`).join('');
  document.querySelector('[data-event-log]').innerHTML=state.events.map(entry=>`<li class="${entry.tone}"><time>Y${Math.floor(entry.week/52)+1} W${entry.week%52+1}</time>${entry.message}</li>`).join('');
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
  if(!dialog.open)dialog.showModal();
}
function clock(){
  clearInterval(timer);if(state.paused||state.status!=='playing')return;
  timer=setInterval(()=>{state=simulateOneWeek(state);if(state.totalWeeks%52===0&&state.status==='playing'){state.paused=true;clearInterval(timer);render();report(true);}else{render();if(state.status!=='playing')clearInterval(timer);}if(state.totalWeeks%4===0||state.paused)save();},1000/state.speed);
}
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{tool=button.dataset.tool;message(`${button.querySelector('small')?.textContent||tool}. Select a named route on the map.`);render();});
for(const button of document.querySelectorAll('[data-service]'))button.addEventListener('click',()=>handle(toggleService(state,button.dataset.service)));
for(const button of document.querySelectorAll('[data-fundraiser]'))button.addEventListener('click',()=>handle(startFundraiser(state,button.dataset.fundraiser)));
for(const button of document.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{state.speed=Number(button.dataset.speed);render();clock();});
document.querySelector('[data-pause]').addEventListener('click',()=>{state.paused=!state.paused;render();clock();save();});
document.querySelector('[data-save]').addEventListener('click',()=>{save();message('Campaign saved on this device.');});
function reset(difficulty=state.difficulty||'challenge'){if(dialog.open)dialog.close('reset');state=createInitialState(73,difficulty);document.querySelector('[data-difficulty]').value=state.difficulty;selection=null;terminalShown=false;localStorage.removeItem(storageKey);tool='inspect';render();clock();save();message(state.difficulty==='tutorial'?'Follow the highlighted next step. Guided time advances only when you are ready.':'New campaign. Choose a tool and a route; plan funding before construction.');}
document.querySelector('[data-reset]').addEventListener('click',()=>reset());document.querySelector('[data-report-reset]').addEventListener('click',()=>reset());
document.querySelector('[data-new-game]').addEventListener('click',()=>reset(document.querySelector('[data-difficulty]').value));
document.querySelector('[data-tutorial-next]').addEventListener('click',()=>{
  const step=getTutorialStep(state);
  if(step.kind==='route'){selection={type:'route',id:step.id};tool=step.tool;}
  handle(performTutorialStep(state));clock();
});
map.addEventListener('click',event=>{if(!event.target.closest('[data-route], [data-patch]')){message(`Choose a named route to ${toolNames[tool].toLowerCase()}, or a forest grove to see its connected routes.`);revealSelection();}});
dialog.addEventListener('close',()=>{if(state.status==='playing'&&dialog.returnValue!=='reset'){state.paused=false;clock();render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;clock();save();render();}});
const resourceBar=document.querySelector('[data-resource-bar]'),siteHeader=document.querySelector('.site-header');
function sizeResourceBar(){
  document.documentElement.style.setProperty('--game-header-height',`${siteHeader.getBoundingClientRect().height}px`);
  document.documentElement.style.setProperty('--game-resource-height',`${resourceBar.getBoundingClientRect().height}px`);
}
const resourceObserver=new ResizeObserver(sizeResourceBar);resourceObserver.observe(resourceBar);resourceObserver.observe(siteHeader);
render();sizeResourceBar();clock();
