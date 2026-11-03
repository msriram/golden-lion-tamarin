import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const team=await readFile(new URL('../team.html',import.meta.url),'utf8');
test('team timeline shows seven dated milestones in chronological order',()=>{
  const timeline=team.match(/<ol class="project-timeline">([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(timeline,'team timeline is present');
  const dates=[...timeline.matchAll(/<time datetime="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(dates,['2026-08','2026-09','2026-10-15','2026-10-20','2026-11-01','2026-11-07','2026-11-15']);
  assert.equal((timeline.match(/class="milestone complete"/g)||[]).length,5);
  assert.equal((timeline.match(/class="milestone planned"/g)||[]).length,2);
  assert.match(timeline,/Rainforest Rangers/);
});
test('Rainforest Rangers remains the team with a worldwide mission and Tamarin Trails as its first project',()=>{
  const august=team.match(/<time datetime="2026-08">([\s\S]*?)<\/li>/)?.[1];
  assert.ok(august,'August milestone is present');
  assert.match(august,/<strong>Rainforest Rangers<\/strong> as our team name, and that is still who we are/);
  assert.match(august,/protect rainforests around the world/);
  assert.match(august,/Tamarin Trails is our first conservation project/);
  assert.match(august,/Brazil’s Atlantic Forest/);
  assert.doesNotMatch(team,/Our conservation project later became/);
});
test('design and campaign remain concepts and planned work, not deployed wildlife infrastructure',()=>{
  assert.match(team,/Tabletop model/);assert.match(team,/not a field-ready wildlife bridge/);
  assert.match(team,/id="november-campaign"/);assert.match(team,/Planned launch: November 7, 2026/);
  assert.match(team,/No campaign spending or donation transfer has been recorded/);
  assert.match(team,/assembly-preview.png/);
});
