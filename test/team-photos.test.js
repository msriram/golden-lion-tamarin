import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

test('outreach gallery uses the four organizer-labelled photos in supplied order',async()=>{
  const html=await readFile(new URL('../team.html',import.meta.url),'utf8');
  const gallery=html.match(/<div class="outreach-gallery">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(gallery,'outreach gallery exists');
  assert.deepEqual([...gallery.matchAll(/<figcaption>([^<]+)<\/figcaption>/g)].map(match=>match[1]),['Arjun','Anay','Sara','Aadhya']);
  const paths=[...gallery.matchAll(/src="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(paths.length,4);
  for(const path of paths)assert.ok((await stat(new URL(`../${path}`,import.meta.url))).size>1000);
  assert.match(html,/Akash Maddukuri/);
});
