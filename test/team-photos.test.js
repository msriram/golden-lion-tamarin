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

test('robotics gallery includes all three supplied photos with accessible descriptions',async()=>{
  const html=await readFile(new URL('../team.html',import.meta.url),'utf8');
  const gallery=html.match(/<div class="robotics-gallery">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(gallery,'robotics gallery exists');
  assert.match(html,/href="#robotics"/);
  assert.match(html,/id="robotics" aria-labelledby="robotics-title"/);
  const photos=[...gallery.matchAll(/<img src="([^"]+)" width="1600" height="1200" alt="([^"]+)" loading="lazy">/g)];
  assert.deepEqual(photos.map(photo=>photo[1]),['assets/team/robotics-team.jpg','assets/team/robotics-teamwork.jpg','assets/team/robotics-builds.jpg']);
  for(const photo of photos){
    assert.ok(photo[2].length>30);
    assert.ok((await stat(new URL(`../${photo[1]}`,import.meta.url))).size>1000);
  }
});
