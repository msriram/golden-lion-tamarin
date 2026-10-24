# Tamarin Trails — Growing forest, connecting families

A static, accessible conservation website created for a fourth-grade FIRST LEGO League team at Theodore Judah Elementary in Folsom, California.

## Run locally

```bash
npm run serve
```

Open `http://localhost:4173`.

## Check the project

```bash
npm run check
```

The project uses no third-party runtime dependencies. GitHub Pages serves the files directly from the repository through the included workflow.

The conservation campaign uses version 5 local saves under `tamarinTrailsCampaignV5`. Earlier saves remain separate. Six patches and seven candidate routes support several network choices. Paid outreach, monitoring, nurseries, veterinary visits, fire preparedness, staged grants, cooldowns, upkeep, disease, construction pressure, wildfire, drought, and storms interact. All costs, population targets, biological rates, and event timings are fictional game balance values, not a census or scientific forecast.

Funding cooldowns start at completion, rather than at application. Grants pay half at approval and half after a 13-week reporting period and four new paid monitoring weeks. Program setup costs, fixed runs, minimum commitments, and recovery periods are configured in `PROGRAMS`. Nursery care prioritizes the two lowest-survival planting areas. Planting is restricted to the first 22 weeks of each simulated year, which begins in October. These mechanics draw on the sources listed on the Sources page; exact credits, staffing limits, turnaround times, and equal grant installments are scenario choices rather than published AMLD or CEPF operating rules.

Start with 5,000 simulated tamarins; win at 10,000 and lose strictly below 1,000. Crossings are visual only and never required for victory. Complete a bridge to unlock nearby planting. Cover and habitat capacity increase gradually with funded growth; four years and at least 60% survival produce a mature corridor. Population changes weekly with habitat capacity, health, isolation, births, mortality, and dispersal. Unpaid care degrades habitat and accelerates deaths but is not an independent game-over condition. Veterinary visits build vaccination coverage gradually; protection persists, diluted by births. Funded fire teams reduce fire losses, outreach reduces construction damage, and nursery care reaches at most two planting areas. Seeded threats have advance warnings and lasting effects on health, bridges, seedlings, and population. Annual accounts include population; terminal reports can be closed or reset.

Run `node scripts/playtest.mjs` for seeded comparisons of idle, rushing, always-funded-services, and adaptive reserve strategies. The regression tests verify a winning adaptive policy across three seeds; these are developer playtests, not measured student success rates.

Future project ideas live in the team page's Hope ahead and Bottle lab sections. Proposed activities must be updated with evidence before being marked complete.

## Update the impact tracker

Edit `data/impact.json`. Keep the five stages separate:

1. `pledged`
2. `received`
3. `sent`
4. `acknowledged`
5. independently reported `fieldOutcomes`

Never convert donations into field outcomes without dated reporting from the recipient organization.

## Privacy

The public site does not collect names, email addresses, photos, locations, or game telemetry. Game progress stays in the visitor's browser using `localStorage`.
