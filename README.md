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

The conservation campaign uses version 4 local saves under `tamarinTrailsCampaignV4`. Earlier saves remain separate. Six patches and seven candidate routes support several network choices. Construction crews, paid outreach, monitoring, nurseries, delayed grants, audience cooldowns, weekly operations, bridge condition, seedling survival, storms, and dry seasons interact. All costs and biological rates are fictional game balance values.

Funding cooldowns start at completion, rather than at application. Grants pay half at approval and half after a 13-week reporting period and four new paid monitoring weeks. Program setup costs, fixed runs, minimum commitments, and recovery periods are configured in `PROGRAMS`. Nursery care prioritizes the two lowest-survival planting areas. Planting is restricted to the first 22 weeks of each simulated year, which begins in October. These mechanics draw on the sources listed on the Sources page; exact credits, staffing limits, turnaround times, and equal grant installments are scenario choices rather than published AMLD or CEPF operating rules.

Complete a route's bridge to unlock its planting. Four years of funded growth and at least 60% survival produce mature cover. Win by sustaining all ecological and financial targets for three annual reviews from Year 8 onward. Loss conditions are 26 consecutive unpaid weeks, ten consecutive declining year-end balances, or disappearance of all local families. End reports can be closed or reset.

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
