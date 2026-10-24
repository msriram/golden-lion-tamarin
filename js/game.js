import {PATCHES,FUNDRAISERS,SERVICES,PROGRAMS,ADVERSITIES,corridorGrowth,habitatCapacity,plantingSeason,createInitialState,applyTool,describeLink,activeLink,matureLink,getMetrics,simulateOneWeek,startFundraiser,toggleService} from './game-core.js';
import {terrainArtwork} from './terrain.js';

const storageKey='tamarinTrailsCampaignV5';
const map=document.querySelector('[data-game-map]');
const dialog=document.querySelector('[data-report-dialog]');
let state=load()||createInitialState();
let tool='inspect',timer=null,terminalShown=false;
function load(){try{const saved=JSON.parse(localStorage.getItem(storageKey));return saved?.version===5?saved:null;}catch{return null;}}
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
    const button=document.createElement('button');button.type='button';button.className=`route-marker ${activeLink(link)?'active':''} ${link.condition<45?'broken':''}`;
    button.style.cssText=`left:${(from.x+to.x)/2}%;top:${(from.y+to.y)/2}%`;
    button.dataset.route=link.id;button.setAttribute('aria-label',describeLink(link));
    button.innerHTML=`<span>${link.name}</span><small>${link.bridgeDue?'Building':link.agreementDue?'Negotiating':link.planted?`${Math.floor(link.age/52)}y · ${Math.round(link.survival)}% trees`:link.built?`${Math.round(link.condition)}% bridge`:link.agreement?'Land agreed':`${number(link.cost)} FC`}</small>`;
    button.addEventListener('click',()=>{document.querySelector('[data-inspector-title]').textContent=link.name;handle(applyTool(state,tool,link.id));document.querySelector('[data-inspector]').textContent=describeLink(state.links.find(entry=>entry.id===link.id));});map.append(button);
  }
  for(const patch of state.patches){
    const recent=patch.lastAdversity&&state.totalWeeks-patch.lastAdversity.week<26;
    const button=document.createElement('button');button.type='button';button.className=`terrain-area forest ${patch.health<40?'degraded':''} ${recent?`hit-${patch.lastAdversity.type}`:''}`;button.style.cssText=`left:${patch.x}%;top:${patch.y}%;width:${11+patch.health*.1}%;height:${16+patch.health*.14}%;opacity:${.55+patch.health/220}`;
    button.setAttribute('aria-label',`${patch.name}: ${patch.population} tamarins, health ${Math.round(patch.health)}%.`);
    button.innerHTML=`<span class="area-name">${patch.name} · ${number(patch.population)}</span>`+Array.from({length:Math.max(1,Math.ceil(patch.health/10))},(_,index)=>`<i class="terrain-tree" style="left:${12+index*31%65}%;top:${8+index*23%62}%"></i>`).join('')+(recent?`<span class="hazard-badge">${ADVERSITIES[patch.lastAdversity.type]}</span>`:'');
    button.addEventListener('click',()=>{document.querySelector('[data-inspector-title]').textContent=patch.name;document.querySelector('[data-inspector]').textContent=`${number(patch.population)} tamarins. Habitat health ${Math.round(patch.health)}%. Capacity ${number(habitatCapacity(state,patch))}; ${Math.round(patch.vaccinated*100)}% vaccinated. Plant near bridges to expand habitat; maintain care to prevent decline.`;});map.append(button);
  }
  const token=document.querySelector('[data-tamarin]');
  const route=state.links.find(activeLink);
  if(route){const from=PATCHES.find(patch=>patch.id===route.from),to=PATCHES.find(patch=>patch.id===route.to);const phase=(state.totalWeeks%16)/8;const progress=phase<=1?phase:2-phase;token.style.left=`${from.x+(to.x-from.x)*progress}%`;token.style.top=`${from.y+(to.y-from.y)*progress}%`;}
  else{token.style.left='13%';token.style.top='28%';}
  if(focus)map.querySelector(`[data-route="${focus}"]`)?.focus({preventScroll:true});
}
function renderFinance(metrics){
  document.querySelector('[data-finance]').innerHTML=`<div><span>Weekly bills</span><strong>${number(metrics.cost)} FC</strong></div><div><span>Recurring support</span><strong>+${number(metrics.support)} FC</strong></div><div><span>Net weekly burn</span><strong>${number(metrics.burn)} FC</strong></div><div class="${metrics.runway<20?'critical':''}"><span>Cash runway</span><strong>${metrics.runway===Infinity?'Covered':`${metrics.runway} weeks`}</strong></div><div><span>Community trust</span><strong>${Math.floor(state.awareness)}/100</strong></div><div><span>Monitoring evidence</span><strong>${Math.floor(state.evidence)}/100</strong></div>`;
  document.querySelector('[data-risk]').textContent=state.shortfallWeeks?`Unpaid operations: ${state.shortfallWeeks} weeks. Habitat is degrading and tamarins are dying. Raise funds immediately.`:metrics.runway<20?`Only ${metrics.runway} weeks of cash. Upcoming grants are not cash in hand. Delay expansion or fundraise now.`:'Maintain a reserve for disease prevention, fire response, and grant delays.';
  for(const button of document.querySelectorAll('[data-service]')){
    const name=button.dataset.service,config=PROGRAMS[name],timer=state.programTimers[name],active=state.services[name];
    const rest=Math.max(0,(timer?.readyAt||0)-state.totalWeeks),commit=Math.max(0,(timer?.commitUntil||0)-state.totalWeeks);
    button.setAttribute('aria-pressed',String(active));button.disabled=state.status!=='playing'||(!active&&rest>0)||(active&&commit>0);
    const status=active?`Running: ${timer.endsAt-state.totalWeeks} weeks left${commit?`; committed ${commit} more`:'; pause available'}`:rest?`Turnaround: ${rest} weeks left`:`Start: ${config.setup} FC setup + ${SERVICES[name]}/week`;
    button.innerHTML=`${config.label}<small>${status}</small><small>${config.limit}</small>`;
  }
  const current=state.fundraisers.find(entry=>!entry.completed);
  document.querySelector('[data-campaign]').textContent=current?current.firstPaid?`Grant: first half received. Final half requires 13 weeks and four new paid monitoring weeks (${Math.min(4,state.reportWork-current.reportBaseline)}/4 complete).`:`${FUNDRAISERS[current.id].label}: ${Math.max(0,current.due-state.totalWeeks)} weeks remaining.`:'Fundraising team available. One campaign at a time.';
  for(const button of document.querySelectorAll('[data-fundraiser]')){
    const id=button.dataset.fundraiser,config=FUNDRAISERS[id],wait=Math.max(0,(state.cooldowns[id]||0)-state.totalWeeks);
    button.disabled=state.status!=='playing'||!!current||wait>0||(id==='appeal'&&state.balanceFC>=1000&&state.shortfallWeeks===0);
    button.querySelector('small').textContent=`${wait?`Cooldown: ${wait} weeks remaining. `:''}${config.cost} FC · ${config.duration} weeks · ${id==='grant'?'4,500 + 4,500 FC':`base ${config.payout} FC`} · ${config.cooldown}-week rest after completion`;
  }
  document.querySelector('[data-season]').textContent=plantingSeason(state)?`Wet-season planting window: ${22-state.totalWeeks%52} weeks remaining (October–February).`:`Dry season: planting opens in ${52-state.totalWeeks%52} weeks. Maintain existing seedlings now.`;
  const warning=state.nextAdversity.week-state.totalWeeks;
  document.querySelector('[data-threat]').textContent=warning<=26?`${ADVERSITIES[state.nextAdversity.type]} risk near ${PATCHES.find(patch=>patch.id===state.nextAdversity.patchId).name}. Response window: ${warning} weeks. Prepare local teams and cash reserves.`:'No immediate threat alert. Disease, construction, fire, drought, and storms can set back recovery. Prevention takes time.';
  document.querySelector('[data-history]').innerHTML=state.annualReports.slice(-5).reverse().map(report=>`<tr><td>${report.year}</td><td>${number(report.income)}</td><td>${number(report.expenses)}</td><td>${number(report.closing)}</td><td>${number(report.population)}</td></tr>`).join('')||'<tr><td colspan="5">Your first report arrives after 52 weeks.</td></tr>';
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
function reset(){if(dialog.open)dialog.close('reset');state=createInitialState();terminalShown=false;localStorage.removeItem(storageKey);tool='inspect';render();clock();message('New challenge. Plan funding before construction.');}
document.querySelector('[data-reset]').addEventListener('click',reset);document.querySelector('[data-report-reset]').addEventListener('click',reset);
dialog.addEventListener('close',()=>{if(state.status==='playing'&&dialog.returnValue!=='reset'){state.paused=false;clock();render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;clock();save();render();}});
render();clock();
