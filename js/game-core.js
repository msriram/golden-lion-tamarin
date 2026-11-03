export const TREE_MATURITY_WEEKS = 208;
export const GRANT_REQUIREMENTS = {evidence:20,trust:45};
export const SUPPORT_RATES = {trustThreshold:35,trustPerPoint:2.8,corridorTrust:65,perMatureCorridor:35};
export const SPEED_INTERVALS_MS = Object.freeze({1:8000,2:4000,4:2000,8:1000,16:500,32:250});
export const DIFFICULTIES = {
  tutorial:{label:'Guided tutorial',operations:.55,income:1.4,threat:.4,growth:1.4,description:'Step-by-step guidance: 45% lower weekly bills, 40% higher recurring support and awards, 40% faster births, and 60% weaker threat damage.'},
  explorer:{label:'Explorer',operations:.55,income:1.3,threat:.45,growth:1.25,sponsorWeeklyFC:100,description:'A welcoming first campaign: 45% lower weekly bills, 30% higher recurring support and awards, 25% faster births, and 55% weaker threat damage. A standing sponsor contributes 130 FC every week, included in support. Basic operations start cash-positive; expanding too fast still costs money.'},
  standard:{label:'Standard',operations:.85,income:1.1,threat:.85,growth:1.1,description:'Recommended intermediate: 15% lower weekly bills, 10% higher recurring support and awards, 10% faster births, and 15% weaker threat damage. Fund outreach and monitoring, reserve cash through grant review and reporting, then expand one corridor at a time.'},
  challenge:{label:'Challenge',operations:1,income:1,threat:1,growth:1,description:'Baseline bills, support, awards, births, and threat damage. Recurring supporters reward maintained trust and mature corridors; grants bridge the early deficit, not unlimited expansion. Keep reserves and time protection carefully.'},
  expert:{label:'Expert',operations:1.15,income:.9,threat:1.3,growth:.9,description:'15% higher weekly bills, 10% lower recurring support and awards, 10% slower births, and 30% stronger threat damage. Protection and reserve management are essential.'}
};
export function getDifficulty(state){return DIFFICULTIES[state.difficulty]||DIFFICULTIES.standard;}
export function fundingAward(state,id){return Math.round(FUNDRAISERS[id].payout*getDifficulty(state).income);}
export const PATCHES = [
  { id:'a', name:'West reserve', x:13, y:28, population:1100 },
  { id:'b', name:'Hill grove', x:44, y:20, population:950 },
  { id:'c', name:'Coastal forest', x:81, y:28, population:1000 },
  { id:'d', name:'River refuge', x:17, y:70, population:950 },
  { id:'e', name:'Farm woodland', x:48, y:65, population:550 },
  { id:'f', name:'East sanctuary', x:84, y:74, population:450 }
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
export const SERVICES = { outreach:45, monitoring:32, nursery:40, health:38, fireWatch:24 };
export const PROGRAMS = {
  outreach: { label:'Community outreach', setup:100, duration:12, cooldown:8, commitment:6, limit:'12-week campaign; 8 weeks for follow-up and community availability.' },
  monitoring: { label:'Field monitoring', setup:80, duration:13, cooldown:4, commitment:8, limit:'13-week survey; 4 weeks for equipment and data preparation.' },
  nursery: { label:'Nursery care', setup:120, duration:26, cooldown:4, commitment:13, limit:'26-week contract; capacity for two planting areas; 4-week restocking.' },
  health: { label:'Wildlife veterinary team', setup:220, duration:26, cooldown:13, commitment:13, limit:'26-week specialist visit; gradually vaccinates surviving tamarins; 13-week turnaround. Protection stays after the visit.' },
  fireWatch: { label:'Fire preparedness', setup:120, duration:13, cooldown:8, commitment:8, limit:'13-week patrol and response team; reduces fire damage while paid; 8-week turnaround.' }
};
export function plantingSeason(state) { return state.totalWeeks % 52 < 22; }
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
function transaction(state,amount,category,phase='action') {
  if(!state.lastWeek&&state.accountingCursor===undefined)state.accountingCursor=state.totalWeeks===0?0:state.ledger.length;
  state.balanceFC+=amount;
  if(amount>0) state.yearlyIncomeFC+=amount;
  else state.yearlyExpensesFC-=amount;
  state.ledger.push({week:state.totalWeeks,amount,category,phase});
}
function pay(state,cost,category,phase='action') {
  if(state.balanceFC<cost) return false;
  transaction(state,-cost,category,phase);
  return true;
}
export function createInitialState(seed=73,difficulty='standard') {
  return {
    version:5,difficulty:DIFFICULTIES[difficulty]?difficulty:'standard',rng:seed,seed,totalWeeks:0,paused:true,speed:1,status:'playing',
    balanceFC:12000,previousYearEndBalanceFC:12000,yearlyIncomeFC:0,yearlyExpensesFC:0,
    decliningBalanceYears:0,shortfallWeeks:0,sustainableYears:0,awareness:38,evidence:0,
    patches:PATCHES.map(patch=>({...patch,health:78,vaccinated:0,populationRemainder:0,lastAdversity:null})),
    links:LINKS.map(link=>({...link,agreement:false,agreementDue:null,bridgeDue:null,bridgeRemainingWeeks:null,built:false,condition:100,planted:false,age:0,survival:100,crossings:0})),
    services:{outreach:false,monitoring:false,nursery:false,health:false,fireWatch:false},programTimers:{},reportWork:0,fundraisers:[],cooldowns:{},
    annualReports:[],ledger:[],lastWeek:null,events:[],eventCounter:0,crossingCount:0,monkeyCount:5000,
    lastFunded:true,adversityHistory:[],nextAdversity:{type:'yellow-fever',week:78,patchId:'a'},
    wildlife:{canopy:100,ground:100,birds:100,amphibians:100,pollinators:100}
  };
}
export function activeLink(link) { return link.built&&link.condition>=45&&link.agreement; }
export function getTamarinPosition(state){
  const route=state.links.filter(link=>link.built).sort((first,second)=>(first.bridgeOpenedWeek??-1)-(second.bridgeOpenedWeek??-1))[0];
  if(!route||!activeLink(route))return null;
  const from=PATCHES.find(patch=>patch.id===route.from),to=PATCHES.find(patch=>patch.id===route.to);
  const elapsed=Math.max(0,state.totalWeeks-(route.bridgeOpenedWeek??0));
  const phase=((elapsed+4)%16)/8,progress=phase<=1?phase:2-phase;
  return {routeId:route.id,x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress};
}
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
function operationLines(state) {
  return [
    {category:'Base operations',baseFC:105},
    {category:'Land agreements',baseFC:state.links.filter(link=>link.agreement).length*9},
    {category:'Bridge upkeep',baseFC:state.links.filter(link=>link.built).length*15},
    {category:'Planting care',baseFC:state.links.filter(link=>link.planted).length*16},
    ...Object.entries(SERVICES).map(([name,cost])=>({category:PROGRAMS[name].label,baseFC:state.services[name]?cost:0}))
  ];
}
function supportLines(state) {
  return [
    {category:'Community trust',baseFC:Math.max(0,state.awareness-SUPPORT_RATES.trustThreshold)*SUPPORT_RATES.trustPerPoint},
    {category:'Mature corridors',baseFC:state.awareness>=SUPPORT_RATES.corridorTrust?state.links.filter(matureLink).length*SUPPORT_RATES.perMatureCorridor:0},
    {category:'Standing Explorer sponsor',baseFC:getDifficulty(state).sponsorWeeklyFC||0}
  ];
}
export function weeklyCost(state) {return Math.round(operationLines(state).reduce((sum,line)=>sum+line.baseFC,0)*getDifficulty(state).operations);}
export function weeklySupport(state) {return Math.floor(supportLines(state).reduce((sum,line)=>sum+line.baseFC,0)*getDifficulty(state).income);}
export function weeklyBudget(state) {
  const difficulty=getDifficulty(state),costFC=weeklyCost(state),supportFC=weeklySupport(state);
  const expenses=operationLines(state).map(line=>({...line,scaledFC:line.baseFC*difficulty.operations}));
  const income=supportLines(state).map(line=>({...line,scaledFC:line.baseFC*difficulty.income}));
  let cumulativeBase=0,allocatedFC=0;
  const items=expenses.map(line=>{
    cumulativeBase+=line.baseFC;
    const cumulativeFC=Math.round(cumulativeBase*difficulty.operations),amount=cumulativeFC-allocatedFC;
    allocatedFC=cumulativeFC;
    return {label:line.category,base:line.baseFC,amount};
  });
  const grant=state.fundraisers.find(campaign=>campaign.id==='grant'&&!campaign.completed);
  const awardFC=fundingAward(state,'grant'),firstInstallmentFC=Math.round(awardFC/2);
  return {
    items,
    cost:costFC,support:supportFC,net:supportFC-costFC,burn:costFC-supportFC,
    operationsMultiplier:difficulty.operations,incomeMultiplier:difficulty.income,
    rounding:'Operations round once on the total; item amounts allocate that integer bill cumulatively. Support floors once on the total. Raw scaled lines and rounding adjustments are available separately.',
    supportInputs:{...SUPPORT_RATES,trust:state.awareness,matureCorridors:state.links.filter(matureLink).length,sponsorBaseFC:income[2].baseFC,
      trustBaseFC:income[0].baseFC,corridorBaseFC:income[1].baseFC,
      explanation:'floor((max(0, trust - 35) × 2.8 + (trust >= 65 ? mature corridors × 35 : 0) + standing sponsor base) × income multiplier)'},
    difficulty:{id:DIFFICULTIES[state.difficulty]?state.difficulty:'standard',...difficulty},
    expenses,income,costFC,supportFC,netFC:supportFC-costFC,burnFC:costFC-supportFC,
    expenseRoundingFC:costFC-expenses.reduce((sum,line)=>sum+line.scaledFC,0),
    incomeRoundingFC:supportFC-income.reduce((sum,line)=>sum+line.scaledFC,0),
    runwayWeeks:costFC>supportFC?Math.floor(state.balanceFC/(costFC-supportFC)):Infinity,
    grant:{awardFC,firstInstallmentFC,finalInstallmentFC:awardFC-firstInstallmentFC,
      reviewWeeks:FUNDRAISERS.grant.duration,reportDelayWeeks:13,reportWeeksRequired:4,
      cooldownWeeks:FUNDRAISERS.grant.cooldown,minimumCycleWeeks:FUNDRAISERS.grant.duration+13+FUNDRAISERS.grant.cooldown,
      eligible:state.evidence>=GRANT_REQUIREMENTS.evidence&&state.awareness>=GRANT_REQUIREMENTS.trust,
      phase:grant?(grant.firstPaid?'reporting':'review'):'idle',
      dueWeek:grant?.due??null,reportWeeksDone:grant?.firstPaid?Math.min(4,state.reportWork-grant.reportBaseline):0,
      readyWeek:grant?null:state.cooldowns.grant||0,
      explanation:'Awards are not recurring support. Half pays after 16-week review if still eligible; the remainder waits at least 13 more weeks and four NEW paid monitoring weeks after the first payment. Reporting occupies the fundraising team; the 52-week renewal cooldown starts only after the final payment. No automatic cash rescue.'}
  };
}
export const weeklyBudgetBreakdown = weeklyBudget;
export function corridorGrowth(link) {
  return link.planted?Math.min(1,link.age/TREE_MATURITY_WEEKS)*link.survival/100:0;
}
export function habitatCapacity(state,patch) {
  const restored=state.links.filter(link=>link.from===patch.id||link.to===patch.id).reduce((sum,link)=>sum+corridorGrowth(link),0);
  return Math.round((1500+restored*1500)*patch.health/100);
}
export function getMetrics(state) {
  const largest=Math.max(...state.patches.map(patch=>reachable(state,patch.id).size));
  const mature=state.links.filter(matureLink).length;
  const cost=weeklyCost(state),support=weeklySupport(state);
  const population=state.patches.reduce((sum,patch)=>sum+patch.population,0);
  return {year:Math.floor(state.totalWeeks/52)+1,week:state.totalWeeks%52+1,largest,mature,
    restored:state.links.filter(link=>link.planted).length,forestPercent:Math.round(state.patches.reduce((sum,patch)=>sum+patch.health,0)/6/78*32+state.links.reduce((sum,link)=>sum+corridorGrowth(link)*5,0)),
    capacity:state.patches.reduce((sum,patch)=>sum+habitatCapacity(state,patch),0),
    health:Math.round(state.patches.reduce((sum,patch)=>sum+patch.health,0)/6),population,
    families:state.patches.filter(patch=>patch.population>=4).length,
    populationChange:state.lastWeek?.population?.change??0,
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
    link.bridgeRemainingWeeks=16;
  } else if(tool==='restore') {
    if(!activeLink(link)) return result(oldState,false,'Complete and maintain this bridge before adding tree cover.');
    if(link.planted) return result(oldState,false,'This corridor is already planted.');
    if(!plantingSeason(state)) return result(oldState,false,`Plant in the next wet season, in ${52-state.totalWeeks%52} weeks. The campaign starts in October.`);
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
  const config=PROGRAMS[name],timer=oldState.programTimers[name];
  if(oldState.services[name]&&oldState.totalWeeks<timer.commitUntil)return result(oldState,false,`Contract committed for ${timer.commitUntil-oldState.totalWeeks} more weeks.`);
  if(!oldState.services[name]&&timer?.readyAt>oldState.totalWeeks)return result(oldState,false,`${config.label} available again in ${timer.readyAt-oldState.totalWeeks} weeks.`);
  const state=clone(oldState);
  if(state.services[name]){
    state.services[name]=false;state.programTimers[name].readyAt=state.totalWeeks+config.cooldown;
    event(state,`${config.label} paused; ${config.cooldown}-week turnaround.`,'community');
    return result(state,true,`${config.label} paused. Its team is in turnaround.`);
  }
  if(!pay(state,config.setup,`${config.label} mobilization`))return result(oldState,false,`Need ${config.setup} FC to mobilize ${config.label}.`);
  state.services[name]=true;
  state.programTimers[name]={endsAt:state.totalWeeks+config.duration,commitUntil:state.totalWeeks+config.commitment,readyAt:0};
  event(state,`${config.label} starts a ${config.duration}-week run. ${SERVICES[name]} FC/week; then ${config.cooldown} weeks turnaround.`,'community');
  return result(state,true,`${config.label} running. Minimum commitment ${config.commitment} weeks.`);
}
export function startFundraiser(oldState,id) {
  const config=FUNDRAISERS[id];
  if(!config||oldState.status!=='playing')return result(oldState,false,'Campaign unavailable.');
  if(oldState.fundraisers.some(entry=>!entry.completed))return result(oldState,false,'The fundraising team is busy.');
  if((oldState.cooldowns[id]||0)>oldState.totalWeeks)return result(oldState,false,`Available again in ${oldState.cooldowns[id]-oldState.totalWeeks} weeks.`);
  if(id==='appeal'&&oldState.balanceFC>=1000&&oldState.shortfallWeeks===0)return result(oldState,false,'Emergency appeals are reserved for a cash crisis below 1,000 FC.');
  if(id==='grant'&&(oldState.evidence<GRANT_REQUIREMENTS.evidence||oldState.awareness<GRANT_REQUIREMENTS.trust))return result(oldState,false,`Grant requires ${GRANT_REQUIREMENTS.evidence} monitoring evidence and ${GRANT_REQUIREMENTS.trust} community trust.`);
  const state=clone(oldState);
  if(!pay(state,config.cost,config.label))return result(oldState,false,`Need ${config.cost} FC to prepare this campaign.`);
  state.cooldowns[id]=state.totalWeeks+config.duration+config.cooldown;
  state.fundraisers.push({id,due:state.totalWeeks+config.duration,completed:false});
  event(state,`${config.label} underway. Results in ${config.duration} weeks.`,'community');
  return result(state,true,`${config.label} started. Bills continue during preparation.`);
}
function settleYear(state) {
  const metrics=getMetrics(state),stable=state.balanceFC>=state.previousYearEndBalanceFC;
  state.decliningBalanceYears=stable?0:state.decliningBalanceYears+1;
  state.annualReports.push({year:state.totalWeeks/52,opening:state.previousYearEndBalanceFC,income:state.yearlyIncomeFC,expenses:state.yearlyExpensesFC,closing:state.balanceFC,population:metrics.population,health:metrics.health,mature:metrics.mature});
  state.previousYearEndBalanceFC=state.balanceFC;state.yearlyIncomeFC=0;state.yearlyExpensesFC=0;
  event(state,`Year ${state.totalWeeks/52}: ${Math.round(state.balanceFC)} FC, ${metrics.population.toLocaleString()} tamarins; habitat capacity ${metrics.capacity.toLocaleString()}.`,'goal');
}
export const ADVERSITIES = { 'yellow-fever':'Yellow fever',wildfire:'Wildfire',construction:'Construction pressure',drought:'Drought',storm:'Severe storm' };
function damageLandscape(state,type,patchId) {
  const patch=state.patches.find(entry=>entry.id===patchId);
  if(!patch||!ADVERSITIES[type])return;
  const before=state.patches.reduce((sum,entry)=>sum+entry.population,0);
  const paid=name=>state.lastFunded&&state.services[name];
  const nurseryAreas=paid('nursery')?state.links.filter(link=>link.planted).sort((first,second)=>first.survival-second.survival).slice(0,2):[];
  const severity=(.85+random(state)*.3)*getDifficulty(state).threat;
  const affected=type==='yellow-fever'?state.patches.filter(entry=>entry.id===patch.id||entry.id===state.patches[(state.patches.indexOf(patch)+1)%6].id):type==='drought'?state.patches:[patch];
  for(const area of affected){
    const loss=type==='yellow-fever'?.35*(1-area.vaccinated*.9):type==='wildfire'?(paid('fireWatch')?.045:.18):type==='construction'?(paid('outreach')?.015:.07):type==='drought'?.025:.01;
    area.population=Math.max(0,area.population-Math.ceil(area.population*loss*severity));
    const damage=type==='wildfire'?(paid('fireWatch')?7:25):type==='construction'?(paid('outreach')?5:18):type==='drought'?8:type==='storm'?5:0;
    area.health=bound(area.health-damage*severity);area.lastAdversity={type,week:state.totalWeeks};
  }
  for(const link of state.links.filter(entry=>affected.some(area=>area.id===entry.from||area.id===entry.to))){
    if(link.built&&['wildfire','construction','storm'].includes(type))link.condition=bound(link.condition-(type==='storm'?30:paid('fireWatch')&&type==='wildfire'?8:20)*severity);
    if(link.planted&&type!=='yellow-fever')link.survival=bound(link.survival-(type==='wildfire'?paid('fireWatch')?8:32:type==='construction'?paid('outreach')?6:24:nurseryAreas.includes(link)?5:16)*severity);
  }
  const deaths=before-state.patches.reduce((sum,area)=>sum+area.population,0);
  state.adversityHistory.push({type,patchId,week:state.totalWeeks,deaths});
  event(state,`${ADVERSITIES[type]}: ${patch.name}${affected.length>1?' and nearby habitat':''}. ${deaths.toLocaleString()} tamarins lost.${type==='yellow-fever'?' Vaccination reduces disease losses.':type==='wildfire'?' Canopy and nearby plantings damaged.':type==='construction'?' Habitat cleared; community negotiations reduce the impact.':' Inspect habitat and route condition.'}`,'warning');
}
export function applyAdversity(oldState,type,patchId) {
  if(oldState.status!=='playing')return oldState;
  const state=clone(oldState);damageLandscape(state,type,patchId);return state;
}
function populationFactors(state,patch,funded) {
  const capacity=habitatCapacity(state,patch),connected=reachable(state,patch.id).size;
  const crowding=patch.population/Math.max(1,capacity),isolationMultiplier=connected>1?1:.55;
  const birthRate=funded&&patch.health>=50?.0045*getDifficulty(state).growth*Math.max(0,1-crowding)*isolationMultiplier:0;
  const mortality={baseline:.00035,isolation:connected===1?.00035:0,poorHealth:Math.max(0,65-patch.health)*.000025,unfunded:funded?0:.004,overCapacity:Math.max(0,crowding-1)*.006};
  const deathRate=Math.min(.06,Object.values(mortality).reduce((sum,rate)=>sum+rate,0));
  return {id:patch.id,name:patch.name,population:patch.population,capacity,health:patch.health,connected,
    funded,crowding,isolationMultiplier,growthMultiplier:getDifficulty(state).growth,birthRate,deathRate,mortality,
    expectedBirths:patch.population*birthRate,expectedDeaths:patch.population*deathRate,
    expectedNaturalChange:patch.population*(birthRate-deathRate),remainder:patch.populationRemainder};
}
export function getPopulationExplanation(state) {
  const funded=state.balanceFC+weeklySupport(state)>=weeklyCost(state);
  const patches=state.patches.map(patch=>populationFactors(state,patch,funded));
  return {funded,patches,population:patches.reduce((sum,patch)=>sum+patch.population,0),
    capacity:patches.reduce((sum,patch)=>sum+patch.capacity,0),
    expectedBirths:patches.reduce((sum,patch)=>sum+patch.expectedBirths,0),
    expectedDeaths:patches.reduce((sum,patch)=>sum+patch.expectedDeaths,0),
    expectedNaturalChange:patches.reduce((sum,patch)=>sum+patch.expectedNaturalChange,0),
    lastWeek:state.lastWeek?.population??null,
    explanation:'Current-condition estimate, not a promise: paid operations and health >= 50 permit births; crowding limits recovery and isolated groves multiply births by 0.55. Low health, isolation, overcrowding and unpaid operations add mortality. Fractional net changes carry between weeks; migration redistributes without creating tamarins. Threat deaths are separate from natural change. Growing planted cover raises capacity gradually; mature cover improves health. Upcoming awards, damage and habitat changes are excluded from this estimate.'};
}
function updatePopulation(state,funded) {
  const changes=[];
  for(const patch of state.patches){
    const factors=populationFactors(state,patch,funded),{birthRate,deathRate}=factors;
    const change=patch.population*(birthRate-deathRate)+patch.populationRemainder;
    const whole=Math.trunc(change);patch.population=Math.max(0,patch.population+whole);patch.populationRemainder=change-whole;
    changes.push({...factors,naturalChange:whole,migration:0});
    patch.vaccinated=Math.max(0,Math.min(.95,patch.vaccinated*(1-Math.max(0,birthRate))+(funded&&state.services.health?.012:0)));
  }
  for(const link of state.links.filter(activeLink)){
    const from=state.patches.find(patch=>patch.id===link.from),to=state.patches.find(patch=>patch.id===link.to);
    const difference=from.population/Math.max(1,habitatCapacity(state,from))-to.population/Math.max(1,habitatCapacity(state,to));
    const donor=difference>0?from:to,receiver=difference>0?to:from;
    const migrants=Math.min(donor.population,Math.floor(Math.abs(difference)*donor.population*.01));
    donor.population-=migrants;receiver.population+=migrants;
    changes.find(patch=>patch.id===donor.id).migration-=migrants;
    changes.find(patch=>patch.id===receiver.id).migration+=migrants;
  }
  return changes;
}
export function simulateOneWeek(oldState) {
  if(oldState.paused||oldState.status!=='playing')return oldState;
  const state=clone(oldState);
  const ledgerStart=oldState.lastWeek?.ledgerEnd??oldState.accountingCursor??(oldState.totalWeeks===0?0:oldState.ledger.length);
  const openingBalanceFC=oldState.balanceFC-oldState.ledger.slice(ledgerStart).reduce((sum,entry)=>sum+entry.amount,0);
  const openingPopulation=state.patches.reduce((sum,patch)=>sum+patch.population,0),adversityStart=state.adversityHistory.length;
  state.totalWeeks+=1;
  for(const campaign of state.fundraisers) {
    if(campaign.completed||campaign.due>state.totalWeeks)continue;
    const config=FUNDRAISERS[campaign.id];
    if(campaign.id==='grant'&&campaign.firstPaid){
      if(state.reportWork-campaign.reportBaseline<4){campaign.due=state.totalWeeks+1;continue;}
      transaction(state,fundingAward(state,campaign.id)-Math.round(fundingAward(state,campaign.id)/2),'Evidence grant final installment','settlement');campaign.completed=true;
      state.cooldowns.grant=state.totalWeeks+config.cooldown;
      event(state,`Grant report accepted. Final installment received; renewal available in ${config.cooldown} weeks.`,'income');continue;
    }
    campaign.completed=true;
    const approved=campaign.id!=='grant'||(state.evidence>=GRANT_REQUIREMENTS.evidence&&state.awareness>=GRANT_REQUIREMENTS.trust);
    const payout=approved?Math.round(fundingAward(state,campaign.id)*(campaign.id==='grant' ? .5 : campaign.id==='appeal'?1:(.7+state.awareness/200)*(.85+random(state)*.3))):0;
    if(campaign.id==='grant'&&approved){campaign.firstPaid=true;campaign.completed=false;campaign.reportBaseline=state.reportWork;campaign.due=state.totalWeeks+13;}
    else state.cooldowns[campaign.id]=state.totalWeeks+config.cooldown;
    transaction(state,payout,config.label,'settlement');
    event(state,`${config.label}: ${payout?`+${payout} FC received`:'declined: eligibility fell during review'}.${campaign.id==='grant'&&approved?' Half remains: wait at least 13 weeks and complete four new paid monitoring weeks. Fundraising team stays busy until reporting finishes.':''}`,payout?'income':'warning');
  }
  const budget=weeklyBudget(state);
  transaction(state,weeklySupport(state),'Recurring supporters','settlement');
  const funded=pay(state,weeklyCost(state),'Weekly operations','settlement');
  state.lastFunded=funded;
  state.shortfallWeeks=funded?0:state.shortfallWeeks+1;
  if(!funded){
    if(state.balanceFC>0)transaction(state,-state.balanceFC,'Partial operations payment','settlement');
    if(state.shortfallWeeks===1)event(state,`Weekly bills need ${budget.cost} FC; available cash including ${budget.support} FC recurring support was insufficient. Operations are not fully funded: care and births stop, mortality rises. Pending awards are not cash.`,'warning');
  }
  state.awareness=bound(state.awareness+(funded && state.services.outreach ? .95 : -.25));
  if(funded&&state.services.monitoring){state.evidence=Math.min(100,state.evidence+.9);state.reportWork+=1;}
  const nurseryAreas=state.services.nursery&&funded?state.links.filter(link=>link.planted).sort((first,second)=>first.survival-second.survival).slice(0,2):[];
  for(const link of state.links) {
    if(link.agreementDue&&link.agreementDue<=state.totalWeeks){link.agreement=true;link.agreementDue=null;event(state,`${link.name}: agreement signed.`,'community');}
    if(link.bridgeDue!==null&&!link.built){
      const remaining=link.bridgeRemainingWeeks??Math.max(0,link.bridgeDue-oldState.totalWeeks);
      link.bridgeRemainingWeeks=Math.max(0,remaining-(funded?1:0));
      link.bridgeDue=state.totalWeeks+link.bridgeRemainingWeeks;
      if(funded&&link.bridgeRemainingWeeks===0){link.bridgeDue=null;link.bridgeRemainingWeeks=null;link.built=true;link.bridgeOpenedWeek=state.totalWeeks;event(state,`${link.name}: bridge opened.`,'build');}
    }
    if(link.built)link.condition=bound(link.condition-(funded ? .06 : 2.5));
    if(link.planted){if(funded)link.age+=1;link.survival=bound(link.survival+(nurseryAreas.includes(link) ? .35 : funded ? -.015 : -1.1));}
    if(activeLink(link)&&state.totalWeeks%13===0&&state.services.monitoring&&funded&&random(state)>.35){link.crossings+=1;state.crossingCount+=1;}
  }
  for(const patch of state.patches){const habitat=state.links.filter(link=>(link.from===patch.id||link.to===patch.id)&&matureLink(link)).length;patch.health=bound(patch.health+(funded ? habitat*.16-.025+(state.services.outreach?.025:0) : -.7));}
  if(state.totalWeeks===state.nextAdversity.week-13)event(state,`${ADVERSITIES[state.nextAdversity.type]} warning near ${PATCHES.find(patch=>patch.id===state.nextAdversity.patchId).name}: prepare within 13 weeks.`,'warning');
  if(state.totalWeeks>=state.nextAdversity.week){
    damageLandscape(state,state.nextAdversity.type,state.nextAdversity.patchId);
    const sequence=['yellow-fever','construction','wildfire','drought','storm'];
    state.nextAdversity={type:sequence[(sequence.indexOf(state.nextAdversity.type)+1)%sequence.length],week:state.totalWeeks+78+Math.floor(random(state)*52),patchId:PATCHES[Math.floor(random(state)*6)].id};
  }
  const populationPatches=updatePopulation(state,funded);
  const ledger=state.ledger.slice(ledgerStart).map(entry=>({...entry}));
  const incomeFC=ledger.reduce((sum,entry)=>sum+Math.max(0,entry.amount),0),expensesFC=ledger.reduce((sum,entry)=>sum-Math.min(0,entry.amount),0);
  const categories=[...new Set(ledger.map(entry=>entry.category))].map(category=>({category,
    incomeFC:ledger.filter(entry=>entry.category===category).reduce((sum,entry)=>sum+Math.max(0,entry.amount),0),
    expensesFC:ledger.filter(entry=>entry.category===category).reduce((sum,entry)=>sum-Math.min(0,entry.amount),0)}));
  const closingPopulation=state.patches.reduce((sum,patch)=>sum+patch.population,0);
  state.lastWeek={week:state.totalWeeks,openingBalanceFC,closingBalanceFC:state.balanceFC,incomeFC,expensesFC,netFC:incomeFC-expensesFC,
    ledgerStart,ledgerEnd:state.ledger.length,ledger,categories,budget,operationsDueFC:budget.cost,operationsPaidFC:funded?budget.cost:ledger.filter(entry=>entry.category==='Partial operations payment').reduce((sum,entry)=>sum-entry.amount,0),funded,
    population:{opening:openingPopulation,closing:closingPopulation,change:closingPopulation-openingPopulation,
      adversityDeaths:state.adversityHistory.slice(adversityStart).reduce((sum,entry)=>sum+entry.deaths,0),
      naturalChange:populationPatches.reduce((sum,patch)=>sum+patch.naturalChange,0),patches:populationPatches}};
  delete state.accountingCursor;
  const metrics=getMetrics(state);state.monkeyCount=metrics.population;
  state.wildlife={canopy:Math.round(70+metrics.health*.3+metrics.mature*3),ground:100+metrics.mature*2,birds:100+metrics.mature*4,amphibians:Math.round(65+metrics.health*.4),pollinators:100+metrics.restored*3};
  if(state.totalWeeks%52===0)settleYear(state);
  const population=state.patches.reduce((sum,patch)=>sum+patch.population,0);
  if(population<1000)state.status='lost-population';
  else if(population>=10000)state.status='won';
  for(const [name,config] of Object.entries(PROGRAMS)){
    if(state.services[name]&&state.programTimers[name].endsAt<=state.totalWeeks){
      state.services[name]=false;state.programTimers[name].readyAt=state.totalWeeks+config.cooldown;
      event(state,`${config.label} run finished. Team available in ${config.cooldown} weeks.`,'community');
    }
  }
  state.monkeyCount=state.patches.reduce((sum,patch)=>sum+patch.population,0);
  if(state.status!=='playing')state.paused=true;
  return state;
}
export function setPaused(state,paused){return {...state,paused};}
export function speedIntervalMs(speed){return SPEED_INTERVALS_MS[speed]||SPEED_INTERVALS_MS[1];}
export function setSpeed(state,speed){return {...state,speed:SPEED_INTERVALS_MS[speed]?speed:1};}
