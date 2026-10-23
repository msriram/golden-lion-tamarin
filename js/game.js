import {PATCHES,FUNDRAISERS,SERVICES,createInitialState,applyTool,describeLink,activeLink,matureLink,getMetrics,simulateOneWeek,startFundraiser,toggleService} from './game-core.js';
import {terrainArtwork} from './terrain.js';

const storageKey='tamarinTrailsCampaignV3';
const map=document.querySelector('[data-game-map]');
const dialog=document.querySelector('[data-report-dialog]');
let state=load()||createInitialState();
let tool='inspect',timer=null,terminalShown=false;
function load(){try{const saved=JSON.parse(localStorage.getItem(storageKey));return saved?.version===3?saved:null;}catch{return null;}}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{message('Browser storage is full. This session can continue, but could not be saved.','error');}}
function message(copy,tone=''){const target=document.querySelector('[data-game-message]');target.textContent=copy;target.className=`game-message ${tone}`;}
const number=value=>Math.round(value).toLocaleString();
function handle(result){state=result.state;message(result.message,result.ok?'success':'error');save();render();}
function renderMap(){
  const focus=document.activeElement?.dataset.route;
  map.innerHTML=terrainArtwork();
  const svg=map.querySelector('svg');
  for(const link of state.links){
    const from=PATCHES.find(patch=>patch.id===link.from),to=PATCHES.find(patch=>patch.id===link.to);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    for(const [key,value] of Object.entries({x1:from.x*10,y1:from.y*6.6,x2:to.x*10,y2:to.y*6.6,stroke:matureLink(link)?'#49763b':activeLink(link)?'#a5732c':'#8d8e6d','stroke-width':matureLink(link)?26:link.built?8:3,'stroke-dasharray':link.built?'0':'8 9'}))line.setAttribute(key,value);
    svg.append(line);
    const button=document.createElement('button');button.type='button';button.className=`route-marker ${activeLink(link)?'active':''} ${link.condition<45?'broken':''}`;
    button.style.cssText=`left:${(from.x+to.x)/2}%;top:${(from.y+to.y)/2}%`;
    button.dataset.route=link.id;button.setAttribute('aria-label',describeLink(link));
    button.innerHTML=`<span>${link.name}</span><small>${link.bridgeDue?'Building':link.agreementDue?'Negotiating':link.planted?`${Math.floor(link.age/52)}y · ${Math.round(link.survival)}% trees`:link.built?`${Math.round(link.condition)}% bridge`:link.agreement?'Land agreed':`${number(link.cost)} FC`}</small>`;
    button.addEventListener('click',()=>{document.querySelector('[data-inspector-title]').textContent=link.name;handle(applyTool(state,tool,link.id));document.querySelector('[data-inspector]').textContent=describeLink(state.links.find(entry=>entry.id===link.id));});map.append(button);
  }
  for(const patch of state.patches){
    const button=document.createElement('button');button.type='button';button.className='terrain-area forest';button.style.cssText=`left:${patch.x}%;top:${patch.y}%;width:19%;height:27%;opacity:${.55+patch.health/220}`;
    button.setAttribute('aria-label',`${patch.name}: ${patch.population} tamarins, health ${Math.round(patch.health)}%.`);
    button.innerHTML=`<span class="area-name">${patch.name} · ${patch.population}</span>`+Array.from({length:9},(_,index)=>`<i class="terrain-tree" style="left:${12+index*31%65}%;top:${8+index*23%62}%"></i>`).join('');
    button.addEventListener('click',()=>{document.querySelector('[data-inspector-title]').textContent=patch.name;document.querySelector('[data-inspector]').textContent=`${patch.population} tamarins. Habitat health ${Math.round(patch.health)}%. Select a route between groves to negotiate, build, plant, or repair.`;});map.append(button);
  }
  const token=document.querySelector('[data-tamarin]');
  const route=state.links.find(activeLink);
  if(route){const from=PATCHES.find(patch=>patch.id===route.from),to=PATCHES.find(patch=>patch.id===route.to);const phase=(state.totalWeeks%16)/8;const progress=phase<=1?phase:2-phase;token.style.left=`${from.x+(to.x-from.x)*progress}%`;token.style.top=`${from.y+(to.y-from.y)*progress}%`;}
  else{token.style.left='13%';token.style.top='28%';}
  if(focus)map.querySelector(`[data-route="${focus}"]`)?.focus({preventScroll:true});
}
function renderFinance(metrics){
  document.querySelector('[data-finance]').innerHTML=`<div><span>Weekly bills</span><strong>${number(metrics.cost)} FC</strong></div><div><span>Recurring support</span><strong>+${number(metrics.support)} FC</strong></div><div><span>Net weekly burn</span><strong>${number(metrics.burn)} FC</strong></div><div class="${metrics.runway<20?'critical':''}"><span>Cash runway</span><strong>${metrics.runway===Infinity?'Covered':`${metrics.runway} weeks`}</strong></div><div><span>Community trust</span><strong>${Math.floor(state.awareness)}/100</strong></div><div><span>Monitoring evidence</span><strong>${Math.floor(state.evidence)}/100</strong></div>`;
  document.querySelector('[data-risk]').textContent=state.shortfallWeeks?`Unpaid operations: ${state.shortfallWeeks}/26 weeks. Bridge condition and habitat are deteriorating. Raise funds immediately.`:metrics.runway<20?`Only ${metrics.runway} weeks of cash. Upcoming grants are not cash in hand. Delay expansion or fundraise now.`:`${state.decliningBalanceYears}/10 declining years. Maintain a cash reserve for storms and grant delays.`;
  for(const button of document.querySelectorAll('[data-service]')){button.setAttribute('aria-pressed',String(state.services[button.dataset.service]));button.disabled=state.status!=='playing';}
  const current=state.fundraisers.find(entry=>!entry.completed);
  document.querySelector('[data-campaign]').textContent=current?`${FUNDRAISERS[current.id].label}: ${Math.max(0,current.due-state.totalWeeks)} weeks remaining.`:'Fundraising team available. One campaign at a time.';
  for(const button of document.querySelectorAll('[data-fundraiser]')){const id=button.dataset.fundraiser,config=FUNDRAISERS[id];const wait=Math.max(0,(state.cooldowns[id]||0)-state.totalWeeks);button.disabled=state.status!=='playing'||!!current||wait>0;button.querySelector('small').textContent=wait?`Audience cooldown: ${wait} weeks`:`${config.cost} FC · ${config.duration} weeks · ${id==='grant'?'9,000 FC if eligible':`base ${config.payout} FC`}`;}
  document.querySelector('[data-history]').innerHTML=state.annualReports.slice(-5).reverse().map(report=>`<tr><td>${report.year}</td><td>${number(report.income)}</td><td>${number(report.expenses)}</td><td>${number(report.closing)}</td><td>${report.sustainable?'Stable':'Rebuilding'}</td></tr>`).join('')||'<tr><td colspan="5">Your first report arrives after 52 weeks.</td></tr>';
}
function render(){
  const metrics=getMetrics(state);
  for(const [name,value] of Object.entries({funds:`${number(state.balanceFC)} FC`,calendar:`Y${metrics.year} · W${metrics.week}`,tamarins:metrics.population,forest:`${metrics.forestPercent}%`,crossings:state.crossingCount}))document.querySelector(`[data-hud="${name}"]`).textContent=value;
  const goals={network:metrics.largest>=5,forest:metrics.mature>=4,population:metrics.population>=32&&metrics.families>=4,health:metrics.health>=70,community:state.awareness>=65,stability:state.sustainableYears>=3};
  const labels={network:`Connected forest: ${metrics.largest}/5 groves`,forest:`Mature corridors: ${metrics.mature}/4`,population:`Tamarins: ${metrics.population}/32 · families ${metrics.families}/4`,health:`Habitat health: ${metrics.health}/70`,community:`Community trust: ${Math.floor(state.awareness)}/65`,stability:`Stable years after Year 8: ${state.sustainableYears}/3`};
  for(const [id,done] of Object.entries(goals)){const element=document.querySelector(`[data-objective="${id}"]`);element.textContent=labels[id];element.classList.toggle('complete',done);}
  document.querySelector('[data-route-status]').textContent=`${metrics.largest}/6 connected`;
  document.querySelector('[data-pause]').textContent=state.paused?'Start':'Pause';document.querySelector('[data-pause]').disabled=state.status!=='playing';
  document.querySelectorAll('[data-speed]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===state.speed)));
  document.querySelectorAll('[data-tool]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.tool===tool));button.disabled=state.status!=='playing';});
  document.querySelector('[data-wildlife]').innerHTML=Object.entries(state.wildlife).map(([name,value])=>`<div class="wildlife-row"><span>${name}</span><strong>${value-100>=0?'+':''}${value-100}%</strong></div>`).join('');
  document.querySelector('[data-event-log]').innerHTML=state.events.map(entry=>`<li class="${entry.tone}"><time>Y${Math.floor(entry.week/52)+1} W${entry.week%52+1}</time>${entry.message}</li>`).join('');
  renderMap();renderFinance(metrics);
  if(state.status!=='playing'&&!terminalShown){terminalShown=true;report();}
}
function report(annual=false){
  const metrics=getMetrics(state),won=state.status==='won',ended=state.status!=='playing';
  const reasons={'lost-solvency':'Operations went unpaid for 26 consecutive weeks. Without wages, upkeep, and local support, the program could no longer function.','lost-funding':'Closing funds declined for ten consecutive years. The funding plan never became sustainable.','lost-extinction':'The last family disappeared from this fictional local landscape. This does not mean global species extinction.'};
  document.querySelector('[data-report-stamp]').textContent=ended?won?'Recovery sustained':'Campaign ended':'Annual review';
  document.querySelector('[data-report-title]').textContent=ended?won?'A forest with a future':'The program needs a new plan':`Year ${metrics.year-1} report`;
  document.querySelector('[data-report-copy]').textContent=ended?won?'You sustained habitat, community support, and finances for three qualifying years.':reasons[state.status]:`${state.sustainableYears}/3 stable years; ${state.decliningBalanceYears}/10 declining fund years. Compare income and bills before expanding.`;
  for(const [name,value] of Object.entries({funds:`${number(state.balanceFC)} FC`,forest:`${metrics.forestPercent}%`,crossings:state.crossingCount,tamarins:metrics.population}))document.querySelector(`[data-report="${name}"]`).textContent=value;
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
function reset(){if(dialog.open)dialog.close('reset');state=createInitialState();terminalShown=false;localStorage.removeItem(storageKey);tool='inspect';render();clock();message('New challenge. Plan funding before construction.');}
document.querySelector('[data-reset]').addEventListener('click',reset);document.querySelector('[data-report-reset]').addEventListener('click',reset);
dialog.addEventListener('close',()=>{if(state.status==='playing'&&dialog.returnValue!=='reset'){state.paused=false;clock();render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;clock();save();render();}});
render();clock();
