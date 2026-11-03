import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapCamera,attachMapViewport} from '../js/map-viewport.js';

test('map fills wide or tall viewports without stretching and Fit reveals every edge',()=>{
  for(const [width,height] of [[1400,500],[450,800],[800,528]]){
    const camera=createMapCamera();
    const filled=camera.resize(width,height);
    assert.ok(filled.scale*1000>=width&&filled.scale*660>=height);
    const fitted=camera.fit();
    assert.ok(fitted.scale*1000<=width+.001&&fitted.scale*660<=height+.001);
    assert.equal(fitted.zoom,1);
  }
});
test('zoom stays anchored to the pointer and panning cannot lose the forest',()=>{
  const camera=createMapCamera();camera.resize(1000,660);
  const zoomed=camera.zoom(2,300,200);
  assert.equal((300-zoomed.offsetX)/zoomed.scale,300);
  assert.equal((200-zoomed.offsetY)/zoomed.scale,200);
  const moved=camera.pan(-100000,-100000);
  assert.equal(moved.offsetX,1000-1000*moved.scale);
  assert.equal(moved.offsetY,660-660*moved.scale);
  const clamped=camera.pan(100000,100000);
  assert.equal(clamped.offsetX,0);assert.equal(clamped.offsetY,0);
  assert.equal(camera.zoom(.00001).zoom,1);
  assert.equal(camera.zoom(100000).scale,4);
});
test('fullscreen and orientation resize preserve zoom and the viewed forest center',()=>{
  const camera=createMapCamera();camera.resize(1000,660);camera.zoom(2);
  const resized=camera.resize(2000,1320);
  assert.equal(resized.zoom,2);
  assert.equal((1000-resized.offsetX)/resized.scale,500);
  assert.equal((660-resized.offsetY)/resized.scale,330);
  const rotated=camera.resize(600,1000);
  assert.equal(rotated.zoom,2);
  assert.ok(Number.isFinite(rotated.offsetX)&&Number.isFinite(rotated.offsetY));
  assert.deepEqual(camera.resize(0,0),rotated);
});

function surface(){
  const listeners=new Map();
  return {clientWidth:1000,clientHeight:660,style:{},textContent:'',classList:{toggle(){}},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0}),
    addEventListener(name,handler){listeners.set(name,handler);},
    emit(name,values={}){const event={preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...values};listeners.get(name)?.(event);return event;}};
}
test('pointer gestures support taps, drag suppression, two-finger zoom, cancel and wheel',()=>{
  const previousWindow=globalThis.window,previousObserver=globalThis.ResizeObserver;
  globalThis.window=surface();globalThis.ResizeObserver=class {observe(){}};
  try{
    const host=surface(),world=surface(),controls=surface();
    const buttons=new Map(['[data-map-zoom]','[data-map-zoom-in]','[data-map-zoom-out]','[data-map-fit]'].map(selector=>[selector,surface()]));
    controls.querySelector=selector=>buttons.get(selector);
    const view=attachMapViewport(host,world,controls),initial=world.style.transform;
    host.emit('pointerdown',{pointerId:1,pointerType:'touch',clientX:300,clientY:300});
    window.emit('pointerup',{pointerId:1});
    assert.equal(host.emit('click',{detail:1}).stopped,undefined);
    host.emit('wheel',{deltaY:-250,deltaMode:0,clientX:500,clientY:330});
    assert.notEqual(world.style.transform,initial);
    host.emit('pointerdown',{pointerId:1,pointerType:'touch',clientX:300,clientY:300});
    host.emit('pointermove',{pointerId:1,clientX:370,clientY:350});
    assert.equal(view.interacting,true);
    window.emit('pointerup',{pointerId:1});
    assert.equal(host.emit('click',{detail:1}).stopped,true);
    assert.equal(host.emit('click',{detail:0}).stopped,undefined);
    const before=Number.parseInt(buttons.get('[data-map-zoom]').textContent);
    host.emit('pointerdown',{pointerId:1,pointerType:'touch',clientX:400,clientY:300});
    host.emit('pointerdown',{pointerId:2,pointerType:'touch',clientX:600,clientY:300});
    host.emit('pointermove',{pointerId:2,clientX:800,clientY:300});
    assert.ok(Number.parseInt(buttons.get('[data-map-zoom]').textContent)>before);
    window.emit('pointercancel',{pointerId:2});window.emit('pointercancel',{pointerId:1});
    assert.equal(view.interacting,false);
    buttons.get('[data-map-fit]').emit('click');
    assert.equal(buttons.get('[data-map-zoom]').textContent,'100%');
  }finally{globalThis.window=previousWindow;globalThis.ResizeObserver=previousObserver;}
});
