export const TREE_MATURITY_WEEKS = 208;
export const PATCHES = [
  { id:'a', name:'West reserve', x:13, y:28, population:6 },
  { id:'b', name:'Hill grove', x:44, y:20, population:6 },
  { id:'c', name:'Coastal forest', x:81, y:28, population:6 },
  { id:'d', name:'River refuge', x:17, y:70, population:6 },
  { id:'e', name:'Farm woodland', x:48, y:65, population:0 },
  { id:'f', name:'East sanctuary', x:84, y:74, population:0 }
];
export const LINKS = [
  { id:'ab', from:'a', to:'b', name:'Ridge route', cost:2100 },
  { id:'bc', from:'b', to:'c', name:'Highway route', cost:3400 },
  { id:'ad', from:'a', to:'d', name:'West stream route', cost:1800 },
  { id:'be', from:'b', to:'e', name:'Farm approach', cost:2200 },
  { id:'de', from:'d', to:'e', name:'River corridor', cost:2400 },
  { id:'ef', from:'e', to:'f', name:'South connection', cost:2600 },
  { id:'cf', from:'c', to:'f', name:'Coastal connection', cost:2000 }
];
export const FUNDRAISERS = {
  presentation:{ label:'School outreach', cost:200, duration:8, payout:800, cooldown:26 },
  artShow:{ label:'Community art show', cost:650, duration:16, payout:2000, cooldown:52 },
  scienceFair:{ label:'Science festival', cost:1000, duration:20, payout:3200, cooldown:78 },
  grant:{ label:'Evidence grant', cost:350, duration:16, payout:9000, cooldown:52 },
  appeal:{ label:'Emergency appeal', cost:0, duration:6, payout:650, cooldown:104 }
};
export const SERVICES = { outreach:45, monitoring:32, nursery:40 };
const clone = state => structuredClone(state);
const bound = value => Math.max(0,Math.min(100,value));
function event(state,message,tone='note') {
  state.events.unshift({ id:state.eventCounter++,week:state.totalWeeks,message,tone });
  state.events=state.events.slice(0,30);
}
function random(state) {
  state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;
  return state.rng/4294967296;
}
function transaction(state,amount,category) {
  state.balanceFC+=amount;
  if(amount>0) state.yearlyIncomeFC+=amount;
  else state.yearlyExpensesFC-=amount;
  state.ledger.push({week:state.totalWeeks,amount,category});
}
function pay(state,cost,category) {
  if(state.balanceFC<cost) return false;
  transaction(state,-cost,category);
  return true;
}
export function createInitialState(seed=73) {
  return {
    version:3,rng:seed,seed,totalWeeks:0,paused:true,speed:1,status:'playing',
    balanceFC:12000,previousYearEndBalanceFC:12000,yearlyIncomeFC:0,yearlyExpensesFC:0,
    decliningBalanceYears:0,shortfallWeeks:0,sustainableYears:0,awareness:38,evidence:0,
    patches:PATCHES.map(patch=>({...patch,health:78})),
    links:LINKS.map(link=>({...link,agreement:false,agreementDue:null,bridgeDue:null,built:false,condition:100,planted:false,age:0,survival:100,crossings:0})),
    services:{outreach:false,monitoring:false,nursery:false},fundraisers:[],cooldowns:{},
    annualReports:[],ledger:[],events:[],eventCounter:0,crossingCount:0,monkeyCount:24,
    wildlife:{canopy:100,ground:100,birds:100,amphibians:100,pollinators:100}
  };
}
export function activeLink(link) { return link.built&&link.condition>=45&&link.agreement; }
export function matureLink(link) { return activeLink(link)&&link.planted&&link.age>=TREE_MATURITY_WEEKS&&link.survival>=60; }
export function reachable(state,start,matureOnly=false) {
  const seen=new Set([start]);
  for(let pass=0;pass<state.patches.length;pass+=1) {
    for(const link of state.links) {
      if(!(matureOnly?matureLink(link):activeLink(link))) continue;
      if(seen.has(link.from)||seen.has(link.to)) {seen.add(link.from);seen.add(link.to);}
    }
  }
  return seen;
}
export function weeklyCost(state) {
  return 105+state.links.filter(link=>link.agreement).length*9+state.links.filter(link=>link.built).length*15+state.links.filter(link=>link.planted).length*16+Object.entries(SERVICES).reduce((sum,[name,cost])=>sum+(state.services[name]?cost:0),0);
}
export function weeklySupport(state) {
  return Math.floor(Math.max(0,state.awareness-35)*1.4+(state.awareness>=65?state.links.filter(matureLink).length*35:0));
}
export function getMetrics(state) {
  const largest=Math.max(...state.patches.map(patch=>reachable(state,patch.id).size));
  const mature=state.links.filter(matureLink).length;
  const cost=weeklyCost(state),support=weeklySupport(state);
  const population=state.patches.reduce((sum,patch)=>sum+patch.population,0);
  return {year:Math.floor(state.totalWeeks/52)+1,week:state.totalWeeks%52+1,largest,mature,
    restored:state.links.filter(link=>link.planted).length,forestPercent:32+mature*5,
    health:Math.round(state.patches.reduce((sum,patch)=>sum+patch.health,0)/6),population,
    families:state.patches.filter(patch=>patch.population>=4).length,
    cost,support,burn:cost-support,runway:cost>support?Math.floor(state.balanceFC/(cost-support)):Infinity};
}
const result=(state,ok,message)=>({state,ok,message});
export function describeLink(link) {
  return `${link.name}: agreement ${link.agreement?'active':link.agreementDue?'negotiating':'needed'}; bridge ${link.built?`${Math.round(link.condition)}% condition`:link.bridgeDue?'building':`${link.cost} FC`}; ${link.planted?`trees ${Math.floor(link.age/52)} years old, ${Math.round(link.survival)}% survival`:'planting 1,200 FC after bridge completion'}. Care ${9+(link.built?15:0)+(link.planted?16:0)} FC/week. ${link.crossings} observed crossings.`;
}
export function applyTool(oldState,tool,id) {
  if(oldState.status!=='playing') return result(oldState,false,'Reset the campaign to start again.');
  const state=clone(oldState),link=state.links.find(entry=>entry.id===id);
  if(!link) return result(oldState,false,'Choose a named route between groves.');
  if(tool==='inspect') return result(state,true,describeLink(link));
  if(tool==='agreement') {
    if(link.agreement||link.agreementDue) return result(oldState,false,'This agreement is active or being negotiated.');
    if(state.awareness<30) return result(oldState,false,'Community trust must reach 30 before negotiations. Fund outreach first.');
    if(!pay(state,600,'Land negotiation')) return result(oldState,false,'Need 600 FC for this agreement.');
    link.agreementDue=state.totalWeeks+12;
  } else if(tool==='bridge') {
    if(!link.agreement) return result(oldState,false,'Complete a land agreement before construction.');
    if(link.built||link.bridgeDue) return result(oldState,false,'This crossing is built or in progress.');
    if(state.links.some(entry=>entry.bridgeDue)) return result(oldState,false,'Your construction crew is busy.');
    if(!pay(state,link.cost,'Bridge construction')) return result(oldState,false,`Need ${link.cost} FC. Keep enough for weekly bills.`);
    link.bridgeDue=state.totalWeeks+16;
  } else if(tool==='restore') {
    if(!activeLink(link)) return result(oldState,false,'Complete and maintain this bridge before adding tree cover.');
    if(link.planted) return result(oldState,false,'This corridor is already planted.');
    if(!pay(state,1200,'Native planting')) return result(oldState,false,'Need 1,200 FC for planting.');
    link.planted=true;
  } else if(tool==='repair') {
    if(!link.built) return result(oldState,false,'There is no bridge here to repair.');
    if(!pay(state,500,'Bridge repair')) return result(oldState,false,'Need 500 FC for repair and replanting.');
    link.condition=100;if(link.planted)link.survival=Math.min(100,link.survival+25);
  } else return result(oldState,false,'Choose a route tool.');
  event(state,`${tool}: ${link.name}. Balance ${Math.round(state.balanceFC)} FC.`,'build');
  return result(state,true,describeLink(link));
}
export function toggleService(oldState,name) {
  if(!(name in SERVICES)||oldState.status!=='playing')return result(oldState,false,'Program unavailable.');
  const state=clone(oldState);state.services[name]=!state.services[name];
  event(state,`${name} ${state.services[name]?'funded':'paused'} (${SERVICES[name]} FC/week).`,'community');
  return result(state,true,`${name} ${state.services[name]?'enabled':'paused'}.`);
}
export function startFundraiser(oldState,id) {
  const config=FUNDRAISERS[id];
  if(!config||oldState.status!=='playing')return result(oldState,false,'Campaign unavailable.');
  if(oldState.fundraisers.some(entry=>!entry.completed))return result(oldState,false,'The fundraising team is busy.');
  if((oldState.cooldowns[id]||0)>oldState.totalWeeks)return result(oldState,false,`Available again in ${oldState.cooldowns[id]-oldState.totalWeeks} weeks.`);
  if(id==='grant'&&(oldState.evidence<20||oldState.awareness<45))return result(oldState,false,'Grant requires 20 monitoring evidence and 45 community trust.');
  const state=clone(oldState);
  if(!pay(state,config.cost,config.label))return result(oldState,false,`Need ${config.cost} FC to prepare this campaign.`);
  state.cooldowns[id]=state.totalWeeks+config.cooldown;
  state.fundraisers.push({id,due:state.totalWeeks+config.duration,completed:false});
  event(state,`${config.label} underway. Results in ${config.duration} weeks.`,'community');
  return result(state,true,`${config.label} started. Bills continue during preparation.`);
}
function settleYear(state) {
  for(const patch of state.patches) {
    const connected=reachable(state,patch.id).size;
    const donor=state.patches.find(other=>other.id!==patch.id&&reachable(state,patch.id).has(other.id)&&other.population>=8);
    if(patch.population===0&&connected>=3&&donor) {
      donor.population-=4;patch.population=4;event(state,`Four dispersers moved from ${donor.name} to ${patch.name}.`,'wildlife');
    } else if(patch.population>0) {
      const births=patch.health>=65&&connected>=2&&random(state)>.25?2:0;
      const losses=patch.health<45?2:random(state)<.3?1:0;
      patch.population=Math.max(0,Math.min(10,patch.population+births-losses));
    }
  }
  const metrics=getMetrics(state),stable=state.balanceFC>=state.previousYearEndBalanceFC;
  state.decliningBalanceYears=stable?0:state.decliningBalanceYears+1;
  const eligible=state.totalWeeks>=416&&metrics.largest>=5&&metrics.mature>=4&&metrics.population>=32&&metrics.families>=4&&metrics.health>=70&&state.awareness>=65&&stable&&state.shortfallWeeks===0&&state.crossingCount>=20;
  state.sustainableYears=eligible?state.sustainableYears+1:0;
  state.annualReports.push({year:state.totalWeeks/52,opening:state.previousYearEndBalanceFC,income:state.yearlyIncomeFC,expenses:state.yearlyExpensesFC,closing:state.balanceFC,population:metrics.population,health:metrics.health,mature:metrics.mature,sustainable:eligible});
  state.previousYearEndBalanceFC=state.balanceFC;state.yearlyIncomeFC=0;state.yearlyExpensesFC=0;
  event(state,`Year ${state.totalWeeks/52}: ${Math.round(state.balanceFC)} FC, ${metrics.population} tamarins. Stability ${state.sustainableYears}/3.`,'goal');
  if(state.sustainableYears>=3)state.status='won';
  else if(state.decliningBalanceYears>=10)state.status='lost-funding';
}
export function simulateOneWeek(oldState) {
  if(oldState.paused||oldState.status!=='playing')return oldState;
  const state=clone(oldState);state.totalWeeks+=1;
  for(const campaign of state.fundraisers) {
    if(campaign.completed||campaign.due>state.totalWeeks)continue;
    campaign.completed=true;const config=FUNDRAISERS[campaign.id];
    const approved=campaign.id!=='grant'||(state.evidence>=20&&state.awareness>=45);
    const payout=approved?Math.round(config.payout*(campaign.id==='grant'||campaign.id==='appeal'?1:(.7+state.awareness/200)*(.85+random(state)*.3))):0;
    transaction(state,payout,config.label);
    event(state,`${config.label}: ${payout?`+${payout} FC received`:'declined: eligibility fell during review'}.`,payout?'income':'warning');
  }
  transaction(state,weeklySupport(state),'Recurring supporters');
  const funded=pay(state,weeklyCost(state),'Weekly operations');
  state.shortfallWeeks=funded?0:state.shortfallWeeks+1;
  if(!funded&&state.balanceFC>0)transaction(state,-state.balanceFC,'Partial operations payment');
  state.awareness=bound(state.awareness+(funded && state.services.outreach ? .65 : -.3));
  if(funded&&state.services.monitoring)state.evidence=Math.min(100,state.evidence+.5);
  for(const link of state.links) {
    if(link.agreementDue&&link.agreementDue<=state.totalWeeks){link.agreement=true;link.agreementDue=null;event(state,`${link.name}: agreement signed.`,'community');}
    if(funded&&link.bridgeDue&&link.bridgeDue<=state.totalWeeks){link.bridgeDue=null;link.built=true;event(state,`${link.name}: bridge opened.`,'build');}
    if(link.built)link.condition=bound(link.condition-(funded ? .06 : 2.5));
    if(link.planted){if(funded)link.age+=1;link.survival=bound(link.survival+(funded && state.services.nursery ? .25 : funded ? -.015 : -1.1));}
    if(activeLink(link)&&state.totalWeeks%13===0&&state.services.monitoring&&funded&&random(state)>.35){link.crossings+=1;state.crossingCount+=1;}
  }
  for(const patch of state.patches){const habitat=state.links.filter(link=>(link.from===patch.id||link.to===patch.id)&&matureLink(link)).length;patch.health=bound(patch.health+(funded ? habitat ? .14 : -.015 : -.7));}
  if(state.totalWeeks%78===0){
    const link=state.links[Math.floor(random(state)*state.links.length)],storm=random(state)>.5;
    if(storm&&link.built)link.condition=bound(link.condition-24);
    if(!storm){for(const patch of state.patches)patch.health=bound(patch.health-5);if(link.planted)link.survival=bound(link.survival-(state.services.nursery&&funded?4:16));}
    event(state,storm?`Storm near ${link.name}. Inspect bridge condition.`:'Dry season: stressed habitat and young plantings need care.','warning');
  }
  const metrics=getMetrics(state);state.monkeyCount=metrics.population;
  state.wildlife={canopy:Math.round(70+metrics.health*.3+metrics.mature*3),ground:100+metrics.mature*2,birds:100+metrics.mature*4,amphibians:Math.round(65+metrics.health*.4),pollinators:100+metrics.restored*3};
  if(state.totalWeeks%52===0)settleYear(state);
  if(state.shortfallWeeks>=26)state.status='lost-solvency';
  if(state.patches.every(patch=>patch.population===0))state.status='lost-extinction';
  state.monkeyCount=state.patches.reduce((sum,patch)=>sum+patch.population,0);
  if(state.status!=='playing')state.paused=true;
  return state;
}
export function setPaused(state,paused){return {...state,paused};}
export function setSpeed(state,speed){return {...state,speed:[1,2,4,8].includes(speed)?speed:1};}
