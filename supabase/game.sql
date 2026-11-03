begin;

create table public.project_interest_contacts (
  email text primary key check (email = lower(btrim(email)) and length(email) between 3 and 254),
  adult_confirmed boolean not null check (adult_confirmed),
  outreach_consent boolean not null check (outreach_consent),
  consent_version text not null default '2026-11-02-v1',
  consent_text text not null default 'I am an adult using my own email and would like Rainforest Rangers to contact me about Tamarin Trails conservation updates, activities, and ways to help.',
  source text not null default 'forest-game',
  email_verified boolean not null default false check (not email_verified),
  outreach_status text not null default 'interested' check (outreach_status in ('interested','withdrawn')),
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index project_interest_contacts_created on public.project_interest_contacts(created_at);
alter table public.project_interest_contacts enable row level security;
revoke all on public.project_interest_contacts from public,anon,authenticated;

create table public.game_guest_scores (
  campaign_id uuid primary key,
  nickname text not null check (char_length(nickname) between 2 and 24 and position('@' in nickname) = 0 and nickname !~ '[<>[:cntrl:]]'),
  difficulty text not null check (difficulty in ('tutorial','explorer','standard','challenge','expert')),
  status text not null check (status in ('won','lost-population')),
  weeks integer not null check (weeks between 1 and 52000),
  population integer not null check (population between 0 and 1000000),
  funds bigint not null check (funds between 0 and 1000000000),
  seed bigint not null check (seed between 0 and 4294967295),
  game_version integer not null check (game_version = 5),
  verification text not null default 'unverified' check (verification = 'unverified'),
  created_at timestamptz not null default now(),
  check ((status = 'won' and population >= 10000) or (status = 'lost-population' and population < 1000))
);
create index game_guest_scores_wins on public.game_guest_scores(difficulty,weeks,funds desc,created_at,campaign_id) where status = 'won';
create index game_guest_scores_losses on public.game_guest_scores(difficulty,population desc,funds desc,created_at,campaign_id) where status = 'lost-population';
create index game_guest_scores_created on public.game_guest_scores(created_at);
alter table public.game_guest_scores enable row level security;
revoke all on public.game_guest_scores from public,anon,authenticated;
grant select (campaign_id,nickname,difficulty,status,weeks,population,funds,seed,verification,created_at) on public.game_guest_scores to anon,authenticated;
create policy game_guest_scores_read_public on public.game_guest_scores for select to anon,authenticated using (true);

create function public.record_project_interest(p_email text,p_adult_confirmed boolean,p_outreach_consent boolean,p_website text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(btrim(p_email));
begin
  if coalesce(p_website,'') <> '' then return; end if;
  if p_adult_confirmed is distinct from true or p_outreach_consent is distinct from true then
    raise exception 'Adult confirmation and outreach permission are required.';
  end if;
  if normalized_email is null or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Invalid email address.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(148402,1);
  if (select count(*) from public.project_interest_contacts where created_at > now() - interval '1 hour') >= 100 then
    raise exception using errcode = 'P0001',message = 'Please try again later.';
  end if;
  insert into public.project_interest_contacts(email,adult_confirmed,outreach_consent)
    values(normalized_email,true,true) on conflict (email) do nothing;
end;
$$;

create function public.withdraw_project_interest(p_email text,p_adult_confirmed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(btrim(p_email));
begin
  if p_adult_confirmed is distinct from true then raise exception 'Adult confirmation is required.'; end if;
  if normalized_email is null or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Invalid email address.';
  end if;
  update public.project_interest_contacts set outreach_status = 'withdrawn',withdrawn_at = coalesce(withdrawn_at,now())
    where email = normalized_email;
end;
$$;

create function public.record_guest_score(p_score jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_score is null or jsonb_typeof(p_score) <> 'object' or not (p_score ?& array['campaign_id','nickname','difficulty','status','weeks','population','funds','seed','game_version']) then
    raise exception 'Invalid score.';
  end if;
  if length(p_score::text) > 2000 then raise exception 'Invalid score.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(148402,2);
  if (select count(*) from public.game_guest_scores where created_at > now() - interval '1 hour') >= 1000 then
    raise exception using errcode = 'P0001',message = 'Please try again later.';
  end if;
  insert into public.game_guest_scores(campaign_id,nickname,difficulty,status,weeks,population,funds,seed,game_version)
    values((p_score->>'campaign_id')::uuid,p_score->>'nickname',p_score->>'difficulty',p_score->>'status',
      (p_score->>'weeks')::integer,(p_score->>'population')::integer,(p_score->>'funds')::bigint,(p_score->>'seed')::bigint,(p_score->>'game_version')::integer)
    on conflict (campaign_id) do nothing;
end;
$$;

revoke all on function public.record_project_interest(text,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.withdraw_project_interest(text,boolean) from public,anon,authenticated;
revoke all on function public.record_guest_score(jsonb) from public,anon,authenticated;
grant execute on function public.record_project_interest(text,boolean,boolean,text) to anon,authenticated;
grant execute on function public.withdraw_project_interest(text,boolean) to anon,authenticated;
grant execute on function public.record_guest_score(jsonb) to anon,authenticated;

commit;
