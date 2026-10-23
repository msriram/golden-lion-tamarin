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

The terrain game uses version 2 local saves under `tamarinTrailsGameV2`. Earlier grid-game saves remain separate. Complete both tree bridges to unlock planting; this is an educational progression rule. The end report can be closed or reset directly.

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
