import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {forestSceneArtwork,routeGeometry,roadCenterXAt,FOREST_SPECIES} from '../js/forest-scene.js';
import {createInitialState} from '../js/game-core.js';

test('forest map uses deterministic irregular woodland and interactive track paths without label boxes',()=>{
  const state=createInitialState(),before=structuredClone(state),scene=forestSceneArtwork(state);
  assert.equal(scene,forestSceneArtwork(state));assert.deepEqual(state,before);
  assert.equal((scene.match(/class="forest-grove /g)||[]).length,6);
  assert.equal((scene.match(/class="habitat-route /g)||[]).length,7);
  assert.equal((scene.match(/class="grove-target"/g)||[]).length,6);
  assert.ok((scene.match(/class="forest-tree /g)||[]).length>400);
  assert.doesNotMatch(scene,/<text|route-marker|terrain-area|terrain-tree/);
  assert.match(scene,/route-touch-target/);assert.match(scene,/tabindex="0"/);
  assert.deepEqual(FOREST_SPECIES,['Embaúba','Jequitibá','Ipê-amarelo']);
  assert.match(scene,/x="-6000" y="-6000"/);
});
test('bridge decking and ropes appear only after construction starts, and closure is visible',()=>{
  const state=createInitialState(),route=state.links.find(link=>link.id==='cf');
  assert.doesNotMatch(forestSceneArtwork(state),/class="bridge-motion"/);
  route.bridgeDue=16;assert.match(forestSceneArtwork(state),/under-construction/);
  route.bridgeDue=null;route.built=true;route.agreement=true;
  const built=forestSceneArtwork(state),geometry=routeGeometry(route);
  assert.match(built,/class="bridge-motion"/);
  assert.ok(built.includes(`translate(${geometry.start.x} ${geometry.start.y}) rotate`));
  assert.doesNotMatch(built,/undefined|NaN|Infinity/);
  assert.match(forestSceneArtwork(state),/habitat-route built open/);
  route.condition=20;assert.match(forestSceneArtwork(state),/habitat-route built\s+closed/);
  assert.equal(geometry.start.x,810);assert.equal(geometry.end.y,488.4);
});
test('widescreen changes habitat positions and bridge spans without stretching individual trees',()=>{
  const state=createInitialState(),wide=forestSceneArtwork(state,{x:2,y:1});
  assert.match(wide,/viewBox="0 0 2000 660"/);
  assert.match(wide,/data-grove-art="c"/);
  assert.equal(routeGeometry(state.links[0],{x:2,y:1}).end.x,880);
  const normalTrees=[...forestSceneArtwork(state).matchAll(/class="forest-tree "[^>]*scale\(([^)]+)\)/g)].map(match=>match[1]);
  const wideTrees=[...wide.matchAll(/class="forest-tree "[^>]*scale\(([^)]+)\)/g)].map(match=>match[1]);
  assert.deepEqual(wideTrees,normalTrees);
});
test('restored woodland changes from seedlings to wider mixed native-tree cover as funded growth advances',()=>{
  const state=createInitialState(),route=state.links[0];route.planted=true;
  const seedling=forestSceneArtwork(state);assert.match(seedling,/data-growth="0.000"/);
  assert.equal((seedling.match(/href="#tree-sapling"/g)||[]).length,62);
  route.age=104;const young=forestSceneArtwork(state);assert.match(young,/data-growth="0.500"/);
  route.age=208;const mature=forestSceneArtwork(state);assert.match(mature,/data-growth="1.000"/);
  assert.notEqual(young,mature);assert.doesNotMatch(mature,/href="#tree-sapling"/);
  route.survival=40;assert.match(forestSceneArtwork(state),/data-growth="0.400"/);
});
test('restoration trees stay beside the road and the landscape has restrained ambient motion',()=>{
  const state=createInitialState(),route=state.links[0];route.planted=true;
  const scene=forestSceneArtwork(state),trees=[...scene.matchAll(/data-plant-x="([^"]+)" data-plant-y="([^"]+)"/g)];
  assert.equal(trees.length,62);
  for(const [,positionX,positionY] of trees)assert.ok(Math.abs(Number(positionX)-roadCenterXAt(Number(positionY)))>=23.9);
  for(const feature of ['distant-hills','water-shimmer','bird-flock','road-vehicle','tree-sway'])assert.match(scene,new RegExp(feature));
});
test('map labels stay outside the scaled world; detail layers, hit areas and motion settings are explicit',async()=>{
  const styles=await readFile(new URL('../game-shell.css',import.meta.url),'utf8');
  const html=await readFile(new URL('../game.html',import.meta.url),'utf8');
  assert.match(html,/<\/div><\/div><div class="map-labels"/);
  assert.match(styles,/\.map-labels span[^}]*font:600 11px/);
  assert.match(styles,/\.forest-scene \{ overflow:visible/);
  assert.match(styles,/\.map-closeup \.forest-scene \.tree-detail/);
  assert.match(styles,/\.route-touch-target[^}]*stroke-width:32[^}]*vector-effect:non-scaling-stroke/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});
