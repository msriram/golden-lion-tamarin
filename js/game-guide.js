import {PROGRAMS,FUNDRAISERS,applyTool,toggleService,startFundraiser,simulateOneWeek,getMetrics,plantingSeason} from './game-core.js';

const routes=['ab','ad','be','ef','bc'];
export function getTutorialStep(state){
  if(state.status!=='playing')return {kind:'done',title:state.status==='won'?'A recovering population!':'Try a fresh conservation plan',copy:state.status==='won'?'You grew the simulated population to 10,000 through habitat restoration and ongoing protection. Try Explorer or Challenge to make these decisions yourself.':'Reset the tutorial and follow the next-step guidance before expanding.',button:'Tutorial finished'};
  const untilThreat=state.nextAdversity.week-state.totalWeeks;
  const desired={
    outreach:state.awareness<(state.services.outreach?98:88),
    monitoring:state.evidence<25||state.fundraisers.some(entry=>entry.id==='grant'&&!entry.completed),
    nursery:state.links.some(link=>link.planted&&(!state.tutorialLessons?.includes('nursery')||link.survival<(state.services.nursery?96:82))),
    health:state.nextAdversity.type==='yellow-fever'&&untilThreat<=39,
    fireWatch:state.nextAdversity.type==='wildfire'&&untilThreat<=13
  };
  const reasons={outreach:'Community trust unlocks land agreements and recurring supporters.',monitoring:'Paid surveys build evidence for grants and complete the reporting needed for the final installment.',nursery:'The nursery cares for the two planting areas with the lowest survival. Seedlings need ongoing care.',health:'A specialist visit gradually vaccinates tamarins. Start before the yellow fever warning becomes urgent.',fireWatch:'A paid response team reduces fire losses. Time its 13-week run to cover the approaching threat.'};
  for(const [id,enabled] of Object.entries(desired)){
    if(state.services[id]!==enabled&&toggleService(state,id).ok)return {kind:'program',id,title:`${enabled?'Start':'Pause'} ${PROGRAMS[id].label.toLowerCase()}`,copy:`${reasons[id]} ${enabled?`This team has a ${PROGRAMS[id].commitment}-week minimum commitment and its own rest period.`:'Pause when the current job is done to conserve funds; the team needs turnaround time before restarting.'}`,button:`${enabled?'Start':'Pause'} program`};
  }
  if(!state.fundraisers.some(entry=>!entry.completed)){
    for(const id of ['grant','scienceFair','artShow','presentation','appeal']){
      if(startFundraiser(state,id).ok)return {kind:'fundraiser',id,title:`Organize ${FUNDRAISERS[id].label.toLowerCase()}`,copy:id==='grant'?'Your monitoring evidence and community trust now qualify. The grant pays half after review; the rest waits for a fresh monitoring report. Bills continue while you wait.':'Fundraising takes time and uses one team. Start now, while reserves still cover weekly bills; each audience needs a cooldown after completion.',button:'Start fundraising'};
    }
  }
  for(const link of state.links){
    if(link.built&&(link.condition<60||(!state.tutorialLessons?.includes('repair')&&link.condition<85)||(link.planted&&link.survival<70))&&state.balanceFC>1000)return {kind:'route',tool:'repair',id:link.id,title:`Care for ${link.name}`,copy:'Repair and replant before the bridge closes or tree survival drops too far. Protect existing habitat before buying a new project.',button:'Repair & replant'};
  }
  const link=routes.map(id=>state.links.find(entry=>entry.id===id)).find(entry=>!entry.planted);
  if(link){
    const reserve=4000;
    if(!link.agreement&&!link.agreementDue&&state.balanceFC>reserve+600&&state.awareness>=30)return {kind:'route',tool:'agreement',id:link.id,title:`Negotiate ${link.name}`,copy:'Ask landowners before building. The agreement costs 600 FC, takes 12 weeks, and adds a recurring obligation. Keep a cash reserve.',button:'Negotiate land access'};
    if(link.agreement&&!link.built&&!link.bridgeDue&&!state.links.some(entry=>entry.bridgeDue)&&state.balanceFC>reserve+link.cost)return {kind:'route',tool:'bridge',id:link.id,title:`Build ${link.name}`,copy:`Land access is signed. Pay ${link.cost.toLocaleString()} FC to start a 16-week construction job. The bridge connects groves, but planting will create more habitat.`,button:'Build bridge'};
    if(link.built&&!link.planted&&plantingSeason(state)&&state.balanceFC>reserve+1200)return {kind:'route',tool:'restore',id:link.id,title:`Grow forest along ${link.name}`,copy:'The bridge is open and the wet-season planting window is here. Plant native trees for 1,200 FC. Cover expands gradually; mature corridors take four funded years.',button:'Plant native trees'};
  }
  const metrics=getMetrics(state);
  const work=state.links.find(entry=>entry.bridgeDue||entry.agreementDue);
  return {kind:'wait',title:work?'Give fieldwork time':'Review recovery and let the forest grow',copy:`${work?`${work.name} is ${work.bridgeDue?'under construction':'being negotiated'}. `:''}${metrics.population.toLocaleString()} tamarins; habitat capacity ${metrics.capacity.toLocaleString()}. Advance to the next decision (up to 13 weeks). Watch cooldowns, grant reporting, seasonal planting, and threats—not just the bridge animation.`,button:'Advance to next decision'};
}

export function performTutorialStep(oldState){
  if(oldState.difficulty!=='tutorial'||oldState.status!=='playing')return {state:oldState,ok:false,message:'Guided steps are available in an active tutorial. Choose Guided tutorial and New game to begin.'};
  const step=getTutorialStep(oldState);
  let result;
  if(step.kind==='program')result=toggleService(oldState,step.id);
  else if(step.kind==='fundraiser')result=startFundraiser(oldState,step.id);
  else if(step.kind==='route')result=applyTool(oldState,step.tool,step.id);
  else{
    let state=oldState,weeks=0;
    do{state=simulateOneWeek({...state,paused:false});weeks+=1;}while(weeks<13&&state.status==='playing'&&getTutorialStep(state).kind==='wait');
    result={state,ok:true,message:`${weeks} ${weeks===1?'week':'weeks'} passed. Population: ${getMetrics(state).population.toLocaleString()}. Review your next conservation decision.`};
  }
  const lesson=step.kind==='route'?step.tool:step.id||step.kind;
  return {...result,state:{...result.state,paused:true,tutorialSteps:(oldState.tutorialSteps||0)+1,tutorialLessons:[...new Set([...(oldState.tutorialLessons||[]),lesson])]}};
}
