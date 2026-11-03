import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState} from '../js/game-core.js';
import {ONLINE_CONFIG} from '../js/game-online-config.js';
import {configureOnline,onlineConfigured,normalizeContactEmail,recordProjectInterest,withdrawProjectInterest,scoreFromState,submitOnlineScore,fetchOnlineLeaderboard} from '../js/game-online.js';

const campaign='22222222-2222-4222-8222-222222222222';
const url='https://example.supabase.co',key='sb_publishable_test_public_key_only';
function harness(handler=()=>null){
  const calls=[];
  configureOnline({supabaseUrl:url,supabasePublicKey:key,fetch:async(address,settings)=>{
    const call={address,settings,body:settings.body?JSON.parse(settings.body):null};calls.push(call);
    const result=await handler(call);
    return {ok:!result?.error,status:result?.error||200,text:async()=>JSON.stringify(result?.error?{message:'private@example.com'}:result)};
  }});
  return calls;
}
function finished(){
  const state=createInitialState(73,'standard');
  state.campaignId=campaign;state.totalWeeks=500;state.status='won';
  state.patches.forEach(patch=>{patch.population=2000;});
  state.privateEmail='must-not-leak@example.com';state.onlinePlayerId='obsolete-account-id';
  return state;
}
test('configuration contains only public connection values, with no account settings',()=>{
  assert.ok(ONLINE_CONFIG.supabasePublicKey.startsWith('sb_publishable_'));
  assert.equal(ONLINE_CONFIG.supabaseUrl,'https://yzoyxrcdebnupkvrprad.supabase.co');
  assert.deepEqual(Object.keys(ONLINE_CONFIG).sort(),['supabasePublicKey','supabaseUrl']);
});
test('missing or privileged configuration fails closed',async()=>{
  let called=false;
  for(const settings of [{supabaseUrl:'',supabasePublicKey:''},{supabaseUrl:'http://example.com',supabasePublicKey:key},{supabaseUrl:url,supabasePublicKey:'sb_secret_never_use'}]){
    configureOnline({...settings,fetch:()=>{called=true;}});assert.equal(onlineConfigured(),false);
    await assert.rejects(recordProjectInterest({email:'adult@example.com',adultConfirmed:true,outreachConsent:true}),/not configured/);
  }
  assert.equal(called,false);
});
test('email is normalized only for contact deduplication',()=>{
  assert.equal(normalizeContactEmail(' Adult+forest@Example.com '),'adult+forest@example.com');
  for(const value of ['','bad','kid @example.com','<x>@example.com','a'.repeat(255)+'@b.com'])assert.throws(()=>normalizeContactEmail(value));
});
test('explicit adult confirmation and outreach permission are both mandatory',async()=>{
  const calls=harness();
  for(const [adultConfirmed,outreachConsent] of [[false,false],[true,false],[false,true],[true,undefined]]){
    await assert.rejects(recordProjectInterest({email:'adult@example.com',adultConfirmed,outreachConsent}),/optional/);
  }
  assert.equal(calls.length,0);
});
test('interest writes use a narrow RPC with no nickname, score, auth token or cookies',async()=>{
  const calls=harness();
  await recordProjectInterest({email:' Adult@Example.com ',adultConfirmed:true,outreachConsent:true});
  assert.equal(calls[0].address,url+'/rest/v1/rpc/record_project_interest');
  assert.deepEqual(calls[0].body,{p_email:'adult@example.com',p_adult_confirmed:true,p_outreach_consent:true,p_website:''});
  assert.equal(calls[0].settings.credentials,'omit');
  assert.equal(calls[0].settings.headers.Authorization,undefined);
  assert.equal(calls[0].settings.headers.apikey,key);
});
test('repeated interest submissions have identical non-enumerating responses',async()=>{
  harness();
  const values={email:'adult@example.com',adultConfirmed:true,outreachConsent:true};
  assert.equal(await recordProjectInterest(values),undefined);
  assert.equal(await recordProjectInterest(values),undefined);
});
test('contact failures never echo an email or backend payload',async()=>{
  harness(()=>({error:400}));
  await assert.rejects(recordProjectInterest({email:'private@example.com',adultConfirmed:true,outreachConsent:true}),error=>!error.message.includes('private@'));
});
test('withdrawal requires adult confirmation and does not read the contact table',async()=>{
  const calls=harness();
  await assert.rejects(withdrawProjectInterest({email:'adult@example.com',adultConfirmed:false}));
  assert.equal(calls.length,0);
  assert.equal(await withdrawProjectInterest({email:'adult@example.com',adultConfirmed:true}),undefined);
  assert.equal(calls[0].address,url+'/rest/v1/rpc/withdraw_project_interest');
  assert.deepEqual(calls[0].body,{p_email:'adult@example.com',p_adult_confirmed:true});
});
test('guest results can be shared without email, identity, auth or contact consent',async()=>{
  const calls=harness(),score=await submitOnlineScore(finished(),'Forest Friend');
  assert.equal(score.nickname,'Forest Friend');assert.equal(score.verification,'unverified');
  assert.equal(calls[0].address,url+'/rest/v1/rpc/record_guest_score');
  const body=JSON.stringify(calls[0].body);
  assert.ok(!body.includes('email')&&!body.includes('obsolete-account')&&!body.includes('playerId'));
  assert.equal(calls[0].settings.headers.Authorization,undefined);
});
test('result validation enforces terminal population thresholds and safe public nicknames',()=>{
  const state=finished();
  assert.throws(()=>scoreFromState(state,'adult@example.com'));
  state.status='playing';assert.throws(()=>scoreFromState(state,'Forest Friend'));
  state.status='lost-population';assert.throws(()=>scoreFromState(state,'Forest Friend'));
  state.patches.forEach(patch=>{patch.population=100;});
  assert.equal(scoreFromState(state,'Forest Friend').population,600);
  state.campaignId='not-a-uuid';assert.throws(()=>scoreFromState(state,'Forest Friend'));
});
test('leaderboard reads only safe fields and exact difficulty',async()=>{
  const calls=harness(()=>[]);assert.deepEqual(await fetchOnlineLeaderboard('tutorial'),[]);
  assert.equal(calls.length,2);
  for(const call of calls){assert.ok(call.address.includes('/game_guest_scores?'));assert.ok(call.address.includes('difficulty=eq.tutorial'));assert.ok(!call.address.includes('email')&&!call.address.includes('user_id'));}
  await assert.rejects(fetchOnlineLeaderboard('bad'));
  assert.equal(calls.length,2);
});
test('there are no Auth endpoints or browser identity-token storage in the adapter',async()=>{
  const source=await readFile(new URL('../js/game-online.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\/auth\/v1|localStorage|sessionStorage|access_token|refresh_token/);
});
test('SQL keeps contacts private and all guest writes behind narrow functions',async()=>{
  const sql=await readFile(new URL('../supabase/game.sql',import.meta.url),'utf8');
  assert.match(sql,/alter table public.project_interest_contacts enable row level security/);
  assert.match(sql,/revoke all on public.project_interest_contacts from public,anon,authenticated/);
  assert.doesNotMatch(sql,/grant (?:select|insert|update|delete).*project_interest_contacts/);
  assert.match(sql,/on conflict \(email\) do nothing/);
  assert.match(sql,/on conflict \(campaign_id\) do nothing/);
  assert.match(sql,/outreach_status = 'withdrawn'/);
  assert.match(sql,/p_outreach_consent is distinct from true/);
  assert.match(sql,/email_verified boolean not null default false/);
  assert.equal((sql.match(/security definer set search_path = ''/g)||[]).length,3);
  assert.equal((sql.match(/revoke all on function/g)||[]).length,3);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.doesNotMatch(sql,/auth\.users|auth\.uid/);
});
