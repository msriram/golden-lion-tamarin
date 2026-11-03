import {ONLINE_CONFIG} from './game-online-config.js?v=20261103-money-flow-2';
import {normalizeNickname} from './game-players.js?v=20261103-money-flow-2';

const modes=new Set(['tutorial','explorer','standard','challenge','expert']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields='campaign_id,nickname,difficulty,status,weeks,population,funds,seed,verification,created_at';
export const CONTACT_CONSENT_VERSION='2026-11-02-v1';
let options={...ONLINE_CONFIG};

export function configureOnline(overrides={}){
  options={...ONLINE_CONFIG,...overrides};
  return onlineConfigured();
}
export function onlineConfigured(){
  try{
    const url=new URL(options.supabaseUrl),key=options.supabasePublicKey;
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return false;
    if(typeof key!=='string'||key!==key.trim())return false;
    if(key.startsWith('sb_publishable_'))return key.length>20;
    const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return key.split('.').length===3&&payload.role==='anon';
  }catch{return false;}
}
async function request(path,{method='GET',body}={}){
  if(!onlineConfigured())throw new Error('Online features are not configured. Guest play still works.');
  const response=await (options.fetch||globalThis.fetch)(options.supabaseUrl.replace(/\/$/,'')+path,{
    method,headers:{apikey:options.supabasePublicKey,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'
  });
  if(!response.ok){
    const error=new Error(response.status===429?'Too many requests. Please try again later.':'Could not save or load online data. Please try again later.');
    error.status=response.status;throw error;
  }
  const text=await response.text();
  return text?JSON.parse(text):null;
}
export function normalizeContactEmail(value){
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new Error('Enter your adult email address.');
  return email;
}
export async function recordProjectInterest({email,adultConfirmed,outreachConsent,website=''}){
  if(adultConfirmed!==true||outreachConsent!==true)throw new Error('Confirm you are an adult and choose to receive project updates. Sharing an email is optional.');
  await request('/rest/v1/rpc/record_project_interest',{method:'POST',body:{
    p_email:normalizeContactEmail(email),p_adult_confirmed:true,p_outreach_consent:true,p_website:String(website).slice(0,200)
  }});
}
export async function withdrawProjectInterest({email,adultConfirmed}){
  if(adultConfirmed!==true)throw new Error('Confirm this is your adult email address.');
  await request('/rest/v1/rpc/withdraw_project_interest',{method:'POST',body:{p_email:normalizeContactEmail(email),p_adult_confirmed:true}});
}
function integer(value,min,max,label){
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('Invalid '+label+'.');
  return value;
}
export function scoreFromState(state,nickname){
  if(!state||state.version!==5||!uuid.test(state.campaignId)||!modes.has(state.difficulty))throw new Error('Invalid campaign.');
  if(!['won','lost-population'].includes(state.status))throw new Error('Finish the campaign before sharing a result.');
  if(!Array.isArray(state.patches)||state.patches.length!==6||new Set(state.patches.map(patch=>patch?.id)).size!==6||state.patches.some(patch=>!['a','b','c','d','e','f'].includes(patch?.id)))throw new Error('Invalid habitat data.');
  const population=state.patches.reduce((sum,patch)=>sum+integer(patch.population,0,1000000,'population'),0);
  integer(population,0,1000000,'population');
  if(state.status==='won'?population<10000:population>=1000)throw new Error('Population does not match the outcome.');
  return {campaign_id:state.campaignId,nickname:normalizeNickname(nickname),difficulty:state.difficulty,status:state.status,
    weeks:integer(state.totalWeeks,1,52000,'weeks'),population,funds:integer(state.balanceFC,0,1000000000,'credits'),seed:integer(state.seed,0,4294967295,'seed'),game_version:5};
}
export async function submitOnlineScore(state,nickname){
  const score=scoreFromState(state,nickname);
  await request('/rest/v1/rpc/record_guest_score',{method:'POST',body:{p_score:score}});
  return {...uiScore(score),verification:'unverified'};
}
function uiScore(row){
  return {id:row.campaign_id,nickname:row.nickname,difficulty:row.difficulty,status:row.status,weeks:row.weeks,population:row.population,funds:row.funds,seed:row.seed,verification:'unverified'};
}
export async function fetchOnlineLeaderboard(difficulty){
  if(!modes.has(difficulty))throw new Error('Invalid difficulty.');
  const base='/rest/v1/game_guest_scores?select='+fields+'&difficulty=eq.'+difficulty+'&limit=50';
  const [wins,losses]=await Promise.all([
    request(base+'&status=eq.won&order=weeks.asc,funds.desc,created_at.asc,campaign_id.asc'),
    request(base+'&status=eq.lost-population&order=population.desc,funds.desc,created_at.asc,campaign_id.asc')
  ]);
  if(!Array.isArray(wins)||!Array.isArray(losses))throw new Error('Invalid leaderboard response.');
  return [...wins,...losses].slice(0,50).map(uiScore);
}
