import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const impact=JSON.parse(await readFile(new URL('../data/impact.json',import.meta.url),'utf8'));
test('November bake sale records money received without claiming a completed donation',()=>{
  assert.equal(impact.lastUpdated,'2026-11-01');
  assert.equal(impact.stages.received,200);
  assert.equal(impact.stages.sent,0);assert.equal(impact.stages.acknowledged,0);
  assert.ok(Object.values(impact.fieldOutcomes).every(value=>value===0));
  assert.equal(Math.round(impact.stages.received/impact.goal*100),8);
});
test('bake-sale record preserves event details and planned recipient',()=>{
  const event=impact.events.find(entry=>entry.id==='bake-sale-2026-11-01');
  assert.equal(event.date,'2026-11-01');assert.equal(event.raised,200);
  assert.equal(event.location,'Prospector Park, Folsom');
  assert.equal(event.startTime,'14:00');assert.equal(event.endTime,'17:00');
  assert.equal(event.timeZone,'America/Los_Angeles');
  assert.deepEqual(event.itemsSold,['Cookies','Brownies','Hot chocolate','Fruit cups','Bracelets','Stickers']);
  assert.equal(impact.plannedRecipient.name,'Save the Golden Lion Tamarin');
  assert.equal(impact.plannedRecipient.status,'Transfer planned');
});
