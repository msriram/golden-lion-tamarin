import {createInitialState,simulateOneWeek,startFundraiser,applyTool,toggleService,getMetrics} from '../js/game-core.js';

export function runCampaign(seed=73,policy='careful') {
  let state=createInitialState(seed);
  const targets=['ab','ad','be','ef'];
  for(let week=0;week<1560&&state.status==='playing';week+=1){
    if(policy==='careful'||policy==='expert'){
      if(policy==='expert'){
        const desired={outreach:state.awareness<(state.services.outreach?98:88),monitoring:state.evidence<25||state.crossingCount<24||state.fundraisers.some(entry=>entry.id==='grant'&&!entry.completed),nursery:state.links.some(link=>link.planted&&link.survival<(state.services.nursery?96:82))};
        for(const [name,enabled] of Object.entries(desired))if(state.services[name]!==enabled)state=toggleService(state,name).state;
      }else{
        for(const name of ['outreach','monitoring'])if(!state.services[name])state=toggleService(state,name).state;
        if(state.links.some(link=>link.planted)&&!state.services.nursery)state=toggleService(state,'nursery').state;
      }
      if(!state.fundraisers.some(entry=>!entry.completed)){
        for(const id of ['grant','scienceFair','artShow','presentation',...(state.balanceFC<700?['appeal']:[])]){
          const response=startFundraiser(state,id);if(response.ok){state=response.state;break;}
        }
      }
      for(const link of state.links){
        if(link.built&&(link.condition<60||(link.planted&&link.survival<70))&&state.balanceFC>1000)state=applyTool(state,'repair',link.id).state;
      }
      const planned=policy==='expert'?targets.filter(id=>!state.links.find(link=>link.id===id).planted).slice(0,1):targets;
      for(const id of planned){
        const link=state.links.find(entry=>entry.id===id);
        const reserve=policy==='expert'?5500:4000;
        if(!link.agreement&&!link.agreementDue&&state.balanceFC>reserve+600)state=applyTool(state,'agreement',id).state;
        else if(link.agreement&&!link.built&&!link.bridgeDue&&state.balanceFC>reserve+link.cost)state=applyTool(state,'bridge',id).state;
        else if(link.built&&!link.planted&&state.balanceFC>reserve+1200)state=applyTool(state,'restore',id).state;
      }
    } else if(policy==='rush') {
      for(const name of ['outreach','monitoring','nursery'])if(!state.services[name])state=toggleService(state,name).state;
      for(const link of state.links){
        if(!link.agreement&&!link.agreementDue)state=applyTool(state,'agreement',link.id).state;
        if(link.agreement&&!link.built)state=applyTool(state,'bridge',link.id).state;
        if(link.built&&!link.planted)state=applyTool(state,'restore',link.id).state;
      }
    }
    state.paused=false;state=simulateOneWeek(state);
  }
  return state;
}

if(process.argv[1]?.endsWith('/playtest.mjs')){
  for(const policy of ['idle','rush','careful','expert'])for(const seed of [73,42,917]){
    const state=runCampaign(seed,policy);
    console.log(JSON.stringify({policy,seed,status:state.status,weeks:state.totalWeeks,balance:state.balanceFC,...getMetrics(state),trust:Math.round(state.awareness),stability:state.sustainableYears}));
  }
}
