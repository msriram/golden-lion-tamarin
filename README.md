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

## Forest campaign

`game-about.html` contains the introduction, rules, mode multipliers, and a launch link opening a separate tab. `game.html` is the standalone, viewport-filling application, with a user-triggered full-screen toggle. Desktop sidebars scroll independently; smaller screens reflow. Threat watch and funding are on the left, local programs and recovery on the right. Speed controls, mission, and tutorial guidance are beneath the map. The top resource bar is the only funds/calendar summary; Budget → Details opens itemized forecasts, actual settled-week accounts, population factors, a transaction ledger, and annual reports.

Six patches and seven candidate routes support several network choices. Paid outreach, monitoring, nurseries, veterinary visits, fire preparedness, staged grants, cooldowns, upkeep, disease, construction pressure, wildfire, drought, and storms interact. All costs, population targets, biological rates, and event timings are fictional teaching settings, not a census or scientific forecast.

Version-5 campaign data is stored per player under `tamarinTrailsPlayersV1Save:<player-id>`. Guest play can import the earlier `tamarinTrailsCampaignV5` save. All saves load paused; older saves without a difficulty retain Challenge. The new recurring-support balance applies to loaded games too. Local profiles are nicknames, not authenticated accounts; they and local leaderboard results remain in localStorage. Reset replaces only the current run, while the Player panel can delete that profile, save and local scores. If storage is blocked, the game falls back to session memory and warns the player.

New ledger entries identify `action` versus `settlement`, so year-end payments reconcile with annual reports while purchases after a boundary belong to the following week. Older entries retain their original tick labels. A migration accounting cursor includes new purchases in the first settled-week report without replaying historical spending. Bridge construction now tracks 16 fully funded weeks explicitly; partial/unpaid weeks pause work, and legacy deadlines migrate to remaining work.

Funding cooldowns start at completion, rather than at application. Grants pay half at approval and half after a 13-week reporting period and four new paid monitoring weeks. Program setup costs, fixed runs, minimum commitments, and recovery periods are configured in `PROGRAMS`. Nursery care prioritizes the two lowest-survival planting areas. Planting is restricted to the first 22 weeks of each simulated year, which begins in October. These mechanics draw on the sources listed on the Sources page; exact credits, staffing limits, turnaround times, and equal grant installments are scenario choices rather than published AMLD or CEPF operating rules.

Start with 5,000 simulated tamarins; win at 10,000 and lose strictly below 1,000. Crossings are visual only and never required for victory. Complete a bridge to unlock nearby planting. Cover and habitat capacity increase gradually with funded growth; four years and at least 60% survival produce a mature corridor. Population changes weekly with habitat capacity, health, isolation, births, mortality, and dispersal. Unpaid care degrades habitat and accelerates deaths but is not an independent game-over condition. Veterinary visits build vaccination coverage gradually; protection persists, diluted by births. Funded fire teams reduce fire losses, outreach reduces construction damage, and nursery care reaches at most two planting areas. Seeded threats have advance warnings and lasting effects on health, bridges, seedlings, and population. Annual accounts include population; terminal reports can be closed or reset.

Run `node scripts/playtest.mjs` for seeded comparisons of idle, rushing, always-funded-services, and adaptive reserve strategies. Regression tests verify independently played Explorer, Standard and Challenge recoveries across six deterministic seeds, as well as complete guided tutorials. Explorer also has a four-year, one-corridor novice test with no grant or fundraiser required. These are developer policies, not measured student success rates.

Choose a tool, then click a named route on the map; click a grove to inspect its population and habitat. There is no duplicate list of route buttons above the map. Agreement and construction countdowns refresh during play. Selection details overlay the lower map without shifting its targets; all actions also produce persistent feedback beneath it. Opening a utility dialog pauses time. +1 week allows deliberate single-step play outside the tutorial.

The game has no desktop width cap and resizes with fullscreen, window, and orientation changes. Habitat positions adapt to the map viewport’s aspect ratio while individual trees keep their proportions; Fit reveals the entire forest without letterboxing. Drag with a mouse or one finger to pan; use the wheel, trackpad pinch, two-finger touchscreen pinch, or +/− controls to zoom. Shift+wheel pans. When the map viewport has keyboard focus, arrow keys pan, +/− zoom, and Home fits. Gestures do not trigger conservation actions, and map rerenders wait until fingers or pointers are released. Pointer handling follows the [MDN pointer-gesture guidance](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures); touch interception is limited to the map, leaving sidebar/page scrolling available.

The decorative monkey is hidden until the first bridge opens, then appears midway along that route and moves between its two groves as simulated weeks pass. Completion timestamps keep it on that first bridge even when later routes open. It hides if that bridge closes and returns after repair. The animation neither chooses a starting grove nor changes population or observed-crossing counts. Older saves without completion timestamps use their first built route as a fallback.

`weeklyBudget(state)` is the shared forecast API. Expense lines allocate the once-rounded total exactly; support rounds down once. Recurring support is `floor((max(0, trust - 35) * 2.8 + (trust >= 65 ? matureCorridors * 35 : 0)) * incomeMultiplier)`. Maintaining trust and mature habitat therefore creates a sustainable revenue path rather than requiring grants to carry every recurring bill. Awards are one-time transactions, excluded from recurring net and runway. `lastWeek` reconciles opening plus income minus spending to closing funds, including purchases between simulation ticks. `getPopulationExplanation` separates estimated births/deaths, actual natural change and threat deaths; migration does not create population. Grant thresholds come from shared `GRANT_REQUIREMENTS`.

The browser defaults first-time players to Explorer; the engine's unspecified-mode fallback remains Standard for compatibility. Explorer adds a standing sponsor (100 base FC × 1.3 income multiplier = 130 FC/week), cuts bills by 45%, reduces threat damage by 55%, and runs one week per eight seconds at 1×. Its opening support is 140 FC versus 58 FC bills, a visible 82 FC surplus. This support also applies to existing Explorer saves; there is no retroactive cash grant. Standard and harder modes retain their original budgets. `DIFFICULTIES` explicitly defines operations, support/award, birth, threat and sponsorship settings; the overview table renders multipliers from those values. Changing the selector does not alter an ongoing run: use New game. Guided tutorial explains and executes recommended actions or advances up to 13 weeks to the next decision, maintaining normal cooldowns, eligibility, planting seasons, upkeep and biology. Time stays paused between guided decisions. Other modes show optional planning advice but never execute it automatically. No hidden bailouts are added.

`js/forest-scene.js` generates deterministic, layered vector woodland rather than circle markers: irregular patch edges, textured tree crowns, embaúba/jequitibá/ipê-inspired silhouettes, riverbanks, and rope bridges with decking, rails and reduced-motion-aware sway. Native planting changes from seedlings into a widening canopy according to funded growth and survival. Continuous scenery extends outside the logical habitat rectangle to fill wide viewports. Grove labels and hover/tap route captions live outside the camera transform so their text never enlarges with zoom; leaf/branch detail appears at closer zoom. Tracks have non-scaling touch targets and keyboard activation. Species references and illustration limitations are linked on the game introduction page.

Simulation speeds are 8, 4, 2, 1, 0.5 and 0.25 real seconds per week at 1× through 32×.

## Players and optional online scores

The local leaderboard records completed campaigns once per stable UUID and separates difficulties; tutorial is practice. Wins rank by fewest weeks then remaining funds; losses appear after wins. Browser results are unverified.

Supabase stores optional private adult interest records and explicitly shared guest game results—no sign-in, verification code, SMTP, or Auth account. The project URL and publishable key are configured, and the protected tables and narrow write functions are installed and privacy-tested. `supabase/game.sql` is the fresh-install schema; do not run it again over existing tables. See `docs/game-online-setup.md` for administrator contact access and verification results. Public leaderboards cannot read email addresses. Never add a secret/service-role key to the site. Website source changes remain local and unpublished.

Leaving an email is optional and independent of play or score sharing. Both adult confirmation and permission for project outreach are required and unchecked by default. Trimmed/lowercase email deduplicates contact entries; it is not verified identity. Contact records retain the consent copy/version and timestamp and are never linked to scores. No messages are sent. Withdrawal suppresses future outreach and cannot be reversed by another anonymous opt-in; organizers must review unverified requests before follow-up. Public results remain unverified client submissions. Local campaign UUIDs—not emails—identify game runs.

Future project ideas live in the team page's Hope ahead and Bottle lab sections. Proposed activities must be updated with evidence before being marked complete.

The team page also records the organizer-provided August–November 2026 project timeline, identifies Rainforest Rangers as the team and Tamarin Trails as its project, and displays the supplied tabletop CAD preview without asserting physical testing or field deployment. November 7 campaign/outreach and November 15 judges' feedback remain planned. The downloadable campaign and email drafts in `assets/project/november-campaign-outreach-drafts.txt` require adult review; the website sends no messages or donations. The bottle-to-filament inspiration screenshot is not republished without source/reuse information.

## Update the impact tracker

Edit `data/impact.json`. Keep the five stages separate:

1. `pledged`
2. `received`
3. `sent`
4. `acknowledged`
5. independently reported `fieldOutcomes`

Never convert donations into field outcomes without dated reporting from the recipient organization.

## Privacy

There is no analytics or location/camera access. Organizer-supplied team names and photos are public site content. Local game nicknames, saves, and scores stay in the browser. Optional Supabase contact intake accepts only an adult’s own email with explicit outreach permission; these records stay private and are not browser-saved. Finished results are published only by pressing Share result online, using a nickname and no email. The Player panel provides a stop-contact request; full personal-data erasure needs administrator handling. No sign-in or automatic email sending is involved.
