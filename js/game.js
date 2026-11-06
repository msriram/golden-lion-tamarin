import {PATCHES,FUNDRAISERS,SERVICES,PROGRAMS,ADVERSITIES,GRANT_REQUIREMENTS,getDifficulty,fundingAward,weeklyBudget,getPopulationExplanation,corridorGrowth,habitatCapacity,plantingSeason,createInitialState,applyTool,activeLink,getMetrics,getTamarinPositions,speedIntervalMs,simulateOneWeek,startFundraiser,toggleService} from './game-core.js?v=20261106-immersive-1';
import {forestSceneArtwork,routeGeometry} from './forest-scene.js?v=20261106-immersive-1';
import {getTutorialStep,performTutorialStep,getRecommendedStep} from './game-guide.js?v=20261106-immersive-1';
import {createPlayerStore,rankScores} from './game-players.js?v=20261106-immersive-1';
import {onlineConfigured,recordProjectInterest,withdrawProjectInterest,submitOnlineScore,fetchOnlineLeaderboard} from './game-online.js?v=20261106-immersive-1';
import {attachMapViewport} from './map-viewport.js?v=20261106-immersive-1';

let browserStorage;
try{browserStorage=window.localStorage;}catch{}
const players=createPlayerStore(browserStorage);
const map=document.querySelector('[data-game-map]');
let mapView;
const dialog=document.querySelector('[data-report-dialog]');
function prepareCampaign(saved){
  const campaign=saved||createInitialState(73,'explorer');
  campaign.difficulty=campaign.difficulty||(saved?'challenge':'standard');
  campaign.campaignId=campaign.campaignId||crypto.randomUUID();
  delete campaign.onlinePlayerId;
  campaign.paused=true;
  return campaign;
}
let state=prepareCampaign(players.loadCampaign());
let timer=null,terminalShown=false;
let selection=null;
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
  const sponsor=document.querySelector('[data-sponsor-support]');
  sponsor.hidden=state.difficulty!=='explorer';sponsor.textContent='Includes 130 FC/week standing sponsor';
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
function selectRoute(id){
  selection={type:'route',id};highlightRoute(id);renderInspector();positionMapOverlays();
  const link=state.links.find(entry=>entry.id===id);
  message(`${link.name} selected. Choose an action beside the pathway.`);
  revealSelection();
}
function actOnRoute(id,action){
  selection={type:'route',id};const response=applyTool(state,action,id);handle(response);
  if(response.ok){
    const link=state.links.find(entry=>entry.id===id);
    const feedback={inspect:`Inspecting ${link.name}. No funds spent.`,agreement:`Negotiations started for ${link.name}. 600 FC paid; agreement due in 12 weeks.`,bridge:`Construction started on ${link.name}. ${number(link.cost)} FC paid; completion in 16 funded weeks.`,restore:`Native trees planted along ${link.name}. 1,200 FC paid. Keep caring for them as cover expands over four years.`,repair:`${link.name} repaired and reseeded. 500 FC paid; this action is available again in four weeks.`};
    const budget=weeklyBudget(state);
    message(feedback[action]+(action==='inspect'?'':` Current recurring net: ${signed(budget.net)} FC/week. Budget → Details shows future care obligations as projects complete.`),'success');
  }
  highlightRoute(id);positionMapOverlays();
  revealSelection();
}
function renderInspector(){
  const panel=document.querySelector('[data-selection-panel]'),actions=document.querySelector('[data-route-action-grid]');
  panel.hidden=!selection;actions.hidden=selection?.type!=='route';
  document.querySelector('[data-selected-tool]').textContent=selection?.type==='route'?'Pathway actions':'Grove details';
  const title=document.querySelector('[data-inspector-title]'),copy=document.querySelector('[data-inspector]'),status=document.querySelector('[data-inspector-status]');
  status.replaceChildren();
  if(!selection){title.textContent='';copy.textContent='';return;}
  const fields=selection.type==='route'?(()=>{
    const link=state.links.find(entry=>entry.id===selection.id),repairWait=Math.max(0,(link.repairReadyWeek||0)-state.totalWeeks);title.textContent=link.name;
    copy.textContent=link.agreementDue?`Negotiations are underway. Wait ${link.agreementDue-state.totalWeeks} weeks before construction.`:!link.agreement?'Choose Negotiate to seek land access. It costs 600 FC and takes 12 weeks.':link.bridgeDue?'Construction is underway. Keep weekly bills funded until the bridge opens.':!link.built?`Choose Build bridge when ready. This route costs ${number(link.cost)} FC and takes 16 funded weeks.`:!activeLink(link)?'This bridge is closed. Repair it when the four-week crew cooldown is complete.':!link.planted?'Choose Plant cover during the wet season. Trees grow beside the road and expand habitat over four years.':repairWait?`The bridge and seedlings were just cared for. Repair & reseed returns in ${repairWait} weeks.`:'Maintain the bridge and seedlings. Healthy tree cover expands habitat and supports population recovery.';
    document.querySelector('[data-repair-action-copy]').textContent=repairWait?`Ready in ${repairWait} week${repairWait===1?'':'s'}`:'500 FC · 4-week cooldown';
    const crewBusy=state.links.some(entry=>entry.bridgeDue&&entry.id!==link.id);
    const unavailable={inspect:false,agreement:!!link.agreement||!!link.agreementDue||state.awareness<30||state.balanceFC<600,bridge:!link.agreement||!!link.built||!!link.bridgeDue||crewBusy||state.balanceFC<link.cost,restore:!activeLink(link)||!!link.planted||!plantingSeason(state)||state.balanceFC<1200,repair:!link.built||repairWait>0||state.balanceFC<500||(link.condition>=100&&(!link.planted||link.survival>=100))};
    for(const button of actions.querySelectorAll('[data-route-action]')){
      const blocked=state.status!=='playing'||unavailable[button.dataset.routeAction];
      button.setAttribute('aria-disabled',String(blocked));button.classList.toggle('unavailable',blocked);
    }
    return [['Land agreement',link.agreement?'Agreement signed':link.agreementDue?`Negotiating · ${link.agreementDue-state.totalWeeks} weeks left`:'Not negotiated'],['Bridge',link.bridgeDue?`Building · ${Math.max(0,link.bridgeDue-state.totalWeeks)} weeks${link.bridgeDue<=state.totalWeeks?' · waiting for funds':' left'}`:link.built?`${activeLink(link)?'Open':'Closed'} · ${Math.round(link.condition)}% condition`:'Not built'],['Tree cover',link.planted?`${Math.round(link.age/52*10)/10} years · ${Math.round(link.survival)}% survival`:'Not planted']];
  })():(()=>{
    const patch=state.patches.find(entry=>entry.id===selection.id);title.textContent=patch.name;
    copy.textContent=`${number(patch.population)} tamarins; habitat capacity ${number(habitatCapacity(state,patch))}. Click a pathway to inspect it and choose a conservation action.`;
    return [['Population',number(patch.population)],['Habitat health',`${Math.round(patch.health)}%`],['Vaccinated',`${Math.round(patch.vaccinated*100)}%`]];
  })();
  for(const [label,value] of fields){const item=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;item.append(term,detail);status.append(item);}
}
let highlightedRoute=null;
let sceneLayout={x:1,y:1};
function positionMapOverlays(view=mapView?.snapshot()){
  if(!view)return;
  if(sceneLayout.x!==view.layoutX||sceneLayout.y!==view.layoutY){
    sceneLayout={x:view.layoutX,y:view.layoutY};
  }
  if(map.firstElementChild&&(Number(map.dataset.layoutX)!==sceneLayout.x||Number(map.dataset.layoutY)!==sceneLayout.y))renderMap();
  const host=document.querySelector('.map-scroll'),labels=host.querySelector('[data-map-labels]');
  for(const label of labels.children){
    const patch=PATCHES.find(entry=>entry.id===label.dataset.groveLabel);
    const screenX=view.offsetX+patch.x*10*sceneLayout.x*view.scale,screenY=view.offsetY+(patch.y*6.6*sceneLayout.y+75)*view.scale;
    label.style.left=`${screenX}px`;label.style.top=`${screenY}px`;
    label.hidden=screenX<0||screenX>view.width||screenY<0||screenY>view.height;
  }
  const caption=host.querySelector('[data-route-caption]'),route=state.links.find(entry=>entry.id===highlightedRoute);
  caption.hidden=!route||(selection?.type==='route'&&selection.id===route.id);
  if(route){
    const point=routeGeometry(route,sceneLayout).middle;
    caption.style.left=`${Math.max(90,Math.min(view.width-90,view.offsetX+point.x*view.scale))}px`;
    caption.style.top=`${Math.max(20,Math.min(view.height-55,view.offsetY+point.y*view.scale+20))}px`;
    caption.querySelector('strong').textContent=route.name;
    caption.querySelector('small').textContent=route.bridgeDue?`Building · ${route.bridgeRemainingWeeks??route.bridgeDue-state.totalWeeks} weeks`:route.agreementDue?`Negotiating · ${route.agreementDue-state.totalWeeks} weeks`:route.planted?`${Math.floor(route.age/52)} years · ${Math.round(corridorGrowth(route)*100)}% canopy`:route.built?`${Math.round(route.condition)}% bridge condition`:route.agreement?'Permission agreed · ready to build':'Land permission needed';
  }
  const panel=host.querySelector('[data-selection-panel]');
  if(selection&&!panel.hidden){
    let point;
    if(selection.type==='route')point=routeGeometry(state.links.find(entry=>entry.id===selection.id),sceneLayout).middle;
    else{
      const patch=PATCHES.find(entry=>entry.id===selection.id);
      point={x:patch.x*10*sceneLayout.x,y:patch.y*6.6*sceneLayout.y};
    }
    const screenX=view.offsetX+point.x*view.scale,screenY=view.offsetY+point.y*view.scale;
    const showBelow=screenY<Math.min(255,view.height*.42);
    panel.classList.toggle('below-route',showBelow);
    panel.style.left=`${Math.max(245,Math.min(view.width-245,screenX))}px`;
    panel.style.top=`${Math.max(12,Math.min(view.height-78,screenY+(showBelow?24:-22)))}px`;
  }
}
function highlightRoute(id){
  highlightedRoute=id;
  for(const route of map.querySelectorAll('[data-route]'))route.classList.toggle('highlighted',route.dataset.route===id);
  positionMapOverlays();
}
function renderMap(){
  if(mapView?.interacting)return;
  const focus=document.activeElement?.dataset.route,patchFocus=document.activeElement?.dataset.patch;
  map.innerHTML=forestSceneArtwork(state,sceneLayout);
  map.dataset.layoutX=sceneLayout.x;map.dataset.layoutY=sceneLayout.y;
  for(const bridge of map.querySelectorAll('.bridge-motion'))bridge.style.animationDelay=`-${performance.now()/1000%9.6}s`;
  const labels=document.querySelector('[data-map-labels]');
  if(!labels.children.length){
    for(const patch of PATCHES){
      const label=document.createElement('span');label.dataset.groveLabel=patch.id;label.textContent=patch.name;labels.append(label);
    }
  }
  const layer=document.querySelector('[data-tamarin-layer]'),positions=getTamarinPositions(state),existing=new Map([...layer.children].map(token=>[token.dataset.tamarinId,token]));
  for(const position of positions){
    let token=existing.get(position.id);
    if(!token){
      token=document.createElement('div');token.className='tamarin-token';token.dataset.tamarinId=position.id;
      token.innerHTML='<svg viewBox="-32 -22 60 48" aria-hidden="true"><use href="#golden-tamarin"/></svg>';
      layer.append(token);
    }
    existing.delete(position.id);token.dataset.routeId=position.routeId;token.dataset.facing=position.facing;
    token.style.setProperty('--tamarin-travel',`${Math.max(.25,speedIntervalMs(state.speed)/1000*.88)}s`);
    token.style.left=`${position.x}%`;token.style.top=`${position.y}%`;
    const route=state.links.find(entry=>entry.id===position.routeId);
    const from=PATCHES.find(entry=>entry.id===route.from),to=PATCHES.find(entry=>entry.id===route.to);
    const fraction=Math.abs(to.x-from.x)>.1?(position.x-from.x)/(to.x-from.x):(position.y-from.y)/(to.y-from.y);
    token.style.marginTop=`${4*fraction*(1-fraction)*12}px`;
  }
  for(const token of existing.values())token.remove();
  highlightRoute(highlightedRoute);
  if(focus)map.querySelector(`[data-route="${focus}"]`)?.focus({preventScroll:true});
  else if(patchFocus)map.querySelector(`[data-patch="${patchFocus}"]`)?.focus({preventScroll:true});
}
map.addEventListener('pointerover',event=>{
  if(event.pointerType==='touch')return;
  const route=event.target.closest('[data-route]');if(route)highlightRoute(route.dataset.route);
});
map.addEventListener('pointerout',event=>{
  if(event.pointerType==='touch')return;
  const route=event.target.closest('[data-route]');
  if(route&&!route.contains(event.relatedTarget))highlightRoute(selection?.type==='route'?selection.id:null);
});
map.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible'))highlightRoute(event.target.closest('[data-route]')?.dataset.route||null);});
map.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest('[data-route]'))highlightRoute(selection?.type==='route'?selection.id:null);});
function activateMapTarget(event){
  const route=event.target.closest('[data-route]'),patch=event.target.closest('[data-patch]');
  if(route)selectRoute(route.dataset.route);
  else if(patch){
    highlightRoute(null);selection={type:'patch',id:patch.dataset.patch};
    const area=state.patches.find(entry=>entry.id===patch.dataset.patch);
    message(`${area.name}: ${number(area.population)} tamarins · ${Math.round(area.health)}% habitat health. Select a route to negotiate, build, or plant.`);
    render();revealSelection();
  }else{highlightRoute(null);selection=null;renderInspector();}
}
map.addEventListener('click',activateMapTarget);
map.addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-route],[data-patch]')){event.preventDefault();activateMapTarget(event);}
});
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
  document.querySelector('[data-support-formula]').textContent=`Recurring support = floor((max(0, trust − ${support.trustThreshold}) × ${support.trustPerPoint} + ${support.perMatureCorridor} per mature corridor when trust ≥ ${support.corridorTrust} + ${support.sponsorBaseFC} standing sponsor base) × ${budget.incomeMultiplier}). Current trust ${state.awareness.toFixed(2)}; mature corridors ${support.matureCorridors}. Result: ${number(budget.support)} FC/week, including ${number(support.sponsorBaseFC*budget.incomeMultiplier)} sponsor FC. Bills are rounded once on the total; line items allocate that exact bill. Income is rounded down. ${budget.grant.explanation}`;
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
    const statusCopy=`${status}${active?`; ${Math.round(SERVICES[name]*getDifficulty(state).operations)} FC/week`:''}`;
    button.querySelector('[data-command-status]').textContent=statusCopy;
    button.querySelector('[data-command-benefit]').textContent=benefits[name];
    button.querySelector('[data-command-limit]').textContent=config.limit;
    button.title=`${config.label}. ${statusCopy}`;button.setAttribute('aria-label',button.title);
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
    const statusCopy=`${reason}${config.cost} FC now · ${config.duration} weeks · ${id==='grant'?`${number(budget.grant.firstInstallmentFC)} + ${number(budget.grant.finalInstallmentFC)} FC`:`base ${number(award)} FC${id==='appeal'?'':' (trust & turnout affect payout)'}`} · ${config.cooldown}-week rest after completion`;
    button.querySelector('[data-command-status]').textContent=statusCopy;
    button.title=`${config.label}. ${statusCopy}`;button.setAttribute('aria-label',button.title);
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
  const seconds=speedIntervalMs(state.speed)/1000;
  document.querySelector('[data-time-summary]').textContent=state.difficulty==='tutorial'?'Guided time waits for your next decision.':`${state.speed}× · 1 week every ${seconds} ${seconds===1?'second':'seconds'} · ${state.paused?'paused':'running'}`;
  document.querySelector('[data-wildlife]').innerHTML=Object.entries(state.wildlife).map(([name,value])=>`<div class="wildlife-row"><span>${name}</span><strong>${value-100>=0?'+':''}${value-100}%</strong></div>`).join('');
  document.querySelector('[data-event-log]').innerHTML=state.events.map(entry=>`<li class="${entry.tone}"><time>${entry.week} weeks elapsed</time>${entry.message}</li>`).join('');
  renderResources(metrics);renderInspector();renderMap();renderFinance(metrics);renderTutorial();positionMapOverlays();
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
  timer=setInterval(()=>{state=simulateOneWeek(state);weekFeedback();if(state.totalWeeks%52===0&&state.status==='playing'){state.paused=true;clearInterval(timer);render();report(true);}else{render();if(state.status!=='playing')clearInterval(timer);}if(state.totalWeeks%4===0||state.paused)save();},speedIntervalMs(state.speed));
}
for(const button of document.querySelectorAll('[data-route-action]'))button.addEventListener('click',()=>{
  if(selection?.type!=='route')return;
  actOnRoute(selection.id,button.dataset.routeAction);
});
for(const button of document.querySelectorAll('[data-service]'))button.addEventListener('click',()=>handle(toggleService(state,button.dataset.service)));
for(const button of document.querySelectorAll('[data-fundraiser]'))button.addEventListener('click',()=>handle(startFundraiser(state,button.dataset.fundraiser)));
for(const button of document.querySelectorAll('[data-rail-toggle]'))button.addEventListener('click',()=>{
  const rail=button.closest('[data-command-rail]'),opening=!rail.classList.contains('expanded');
  for(const other of document.querySelectorAll('[data-command-rail]')){
    const expanded=opening&&other===rail;other.classList.toggle('expanded',expanded);
    other.querySelector('[data-rail-toggle]').setAttribute('aria-expanded',String(expanded));
  }
});
function closeStatusDrawer(){
  document.querySelector('[data-status-drawer]').hidden=true;
  for(const panel of document.querySelectorAll('[data-status-panel]'))panel.hidden=true;
  for(const button of document.querySelectorAll('[data-status-toggle]'))button.setAttribute('aria-expanded','false');
}
for(const button of document.querySelectorAll('[data-status-toggle]'))button.addEventListener('click',()=>{
  const drawer=document.querySelector('[data-status-drawer]'),name=button.dataset.statusToggle,closing=button.getAttribute('aria-expanded')==='true';
  closeStatusDrawer();
  if(closing)return;
  drawer.hidden=false;document.querySelector(`[data-status-panel="${name}"]`).hidden=false;button.setAttribute('aria-expanded','true');
});
document.querySelector('[data-status-close]').addEventListener('click',closeStatusDrawer);
for(const button of document.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{state.speed=Number(button.dataset.speed);render();clock();});
document.querySelector('[data-pause]').addEventListener('click',()=>{state.paused=!state.paused;render();clock();save();});
document.querySelector('[data-save]').addEventListener('click',()=>{save();if(players.persistent)message(`Campaign saved on this device for ${players.current().nickname}.`);});
function reset(difficulty=state.difficulty){
  if(dialog.open)dialog.close('reset');
  state=prepareCampaign(createInitialState(73,difficulty));document.querySelector('[data-difficulty]').value=state.difficulty;
  selection=null;terminalShown=false;render();clock();save();
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
document.querySelector('[data-inspector-close]').addEventListener('click',()=>{selection=null;highlightRoute(null);render();});
document.querySelector('[data-tutorial-next]').addEventListener('click',()=>{
  const step=getTutorialStep(state);
  if(step.kind==='route')selection={type:'route',id:step.id};
  handle(performTutorialStep(state));clock();
});
dialog.addEventListener('close',()=>{if(state.status==='playing'&&dialog.returnValue==='continue'&&state.difficulty!=='tutorial'){state.paused=false;clock();render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){state.paused=true;clock();save();render();}});
mapView=attachMapViewport(document.querySelector('.map-scroll'),document.querySelector('.map-wrap'),document.querySelector('.map-controls'),{onViewChange:positionMapOverlays});
function openPanel(panel){
  state.paused=true;clock();save();render();
  if(!panel.open)panel.showModal();
}
for(const button of document.querySelectorAll('[data-close-dialog]'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const button of document.querySelectorAll('[data-budget-open]'))button.addEventListener('click',()=>openPanel(document.querySelector('[data-budget-dialog]')));
document.querySelector('[data-fullscreen]').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else message('This browser does not support full screen. The game already fills its window.','error');}
  catch{message('Full screen was blocked by the browser. You can keep playing in this window.','error');}
});
document.addEventListener('fullscreenchange',()=>{document.querySelector('[data-fullscreen]').textContent=document.fullscreenElement?'Exit full screen':'Full screen';requestAnimationFrame(()=>mapView.resize());});
function refreshProfileList(){
  const list=document.querySelector('[data-player-list]');list.replaceChildren();
  for(const profile of players.profiles()){
    const button=document.createElement('button');button.type='button';button.className='game-button';button.textContent=profile.nickname;button.addEventListener('click',()=>switchPlayer(()=>players.select(profile.id)));list.append(button);
  }
}
function switchPlayer(select){
  save();select();
  for(const panel of document.querySelectorAll('dialog[open]'))panel.close('switch');
  state=prepareCampaign(players.loadCampaign());selection=null;terminalShown=false;
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
  players.deleteCurrent();state=prepareCampaign(players.loadCampaign());selection=null;terminalShown=false;document.querySelector('[data-difficulty]').value=state.difficulty;document.querySelector('[data-player-dialog]').close();save();render();clock();
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
render();mapView.resize();clock();save();refreshOnlineControls();
