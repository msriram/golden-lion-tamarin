const modes=new Set(['tutorial','explorer','standard','challenge','expert']);
const prefix='tamarinTrailsPlayersV1';

export function normalizeNickname(value){
  const nickname=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
  if(nickname.length<2||nickname.length>24||nickname.includes('@')||/[<>\u0000-\u001f]/u.test(nickname))throw new Error('Use a nickname of 2–24 characters, not an email address.');
  return nickname;
}

export function rankScores(scores,difficulty){
  return scores.filter(score=>score.difficulty===difficulty).sort((first,second)=>{
    if(first.status!==second.status)return first.status==='won'?-1:1;
    if(first.status==='won')return first.weeks-second.weeks||second.funds-first.funds||first.id.localeCompare(second.id);
    return second.population-first.population||second.weeks-first.weeks||first.id.localeCompare(second.id);
  });
}

export function createPlayerStore(storage){
  const memory=new Map();
  let persistent=true;
  function read(key,fallback){
    try{
      const raw=memory.has(key)?memory.get(key):storage?.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch{persistent=false;return fallback;}
  }
  function write(key,value){
    const raw=JSON.stringify(value);memory.set(key,raw);
    try{storage.setItem(key,raw);}catch{persistent=false;}
  }
  function remove(key){
    memory.set(key,null);
    try{storage.removeItem(key);}catch{persistent=false;}
  }
  const profiles=()=>{const value=read(prefix+'Profiles',[]);return Array.isArray(value)?value.filter(profile=>typeof profile.id==='string'&&typeof profile.nickname==='string'):[];};
  function current(){
    const id=read(prefix+'Current','guest');
    return profiles().find(profile=>profile.id===id)||{id:'guest',nickname:'Guest'};
  }
  function select(id){
    if(id!=='guest'&&!profiles().some(profile=>profile.id===id))throw new Error('Choose an existing player.');
    write(prefix+'Current',id);
    return current();
  }
  function useNickname(value){
    const nickname=normalizeNickname(value),existing=profiles();
    let profile=existing.find(entry=>entry.nickname.toLocaleLowerCase()===nickname.toLocaleLowerCase());
    if(!profile){
      if(existing.length>=20)throw new Error('This device already has 20 profiles. Delete one before adding another.');
      profile={id:globalThis.crypto.randomUUID(),nickname};write(prefix+'Profiles',[...existing,profile]);
    }
    return select(profile.id);
  }
  function saveCampaign(state){write(prefix+'Save:'+current().id,state);}
  function loadCampaign(){
    const saved=read(prefix+'Save:'+current().id,null);
    if(saved?.version===5)return saved;
    if(current().id==='guest'){
      const legacy=read('tamarinTrailsCampaignV5',null);
      if(legacy?.version===5)return legacy;
    }
    return null;
  }
  function scores(){const value=read(prefix+'Scores',[]);return Array.isArray(value)?value.filter(score=>modes.has(score.difficulty)&&['won','lost-population'].includes(score.status)&&typeof score.nickname==='string'&&Number.isFinite(score.weeks)&&Number.isFinite(score.funds)&&Number.isFinite(score.population)):[];}
  function recordScore(state){
    if(!['won','lost-population'].includes(state.status)||!modes.has(state.difficulty)||!state.campaignId)return null;
    const population=state.patches.reduce((sum,patch)=>sum+patch.population,0);
    if(!Number.isFinite(population)||!Number.isFinite(state.balanceFC)||!Number.isInteger(state.totalWeeks)||state.totalWeeks<1)return null;
    if(state.status==='won'?population<10000:population>=1000)return null;
    const profile=current(),score={id:state.campaignId,playerId:profile.id,nickname:profile.nickname,difficulty:state.difficulty,status:state.status,weeks:state.totalWeeks,population,funds:Math.round(state.balanceFC),seed:state.seed};
    const prior=scores();
    if(!prior.some(entry=>entry.id===score.id))write(prefix+'Scores',[score,...prior].slice(0,500));
    return score;
  }
  function deleteCurrent(){
    const profile=current();
    remove(prefix+'Save:'+profile.id);
    if(profile.id==='guest')remove('tamarinTrailsCampaignV5');
    write(prefix+'Profiles',profiles().filter(entry=>entry.id!==profile.id));
    write(prefix+'Scores',scores().filter(entry=>entry.playerId!==profile.id));
    select('guest');
  }
  return {profiles,current,select,useNickname,saveCampaign,loadCampaign,scores,recordScore,deleteCurrent,get persistent(){return persistent;}};
}
