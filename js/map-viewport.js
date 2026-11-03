const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,value));

export function createMapCamera(){
  let width=0,height=0,scale=1,offsetX=0,offsetY=0;
  const minimum=()=>Math.min(width/1000,height/660);
  const maximum=()=>Math.max(width/1000,height/660)*4;
  function constrain(){
    offsetX=1000*scale<=width?(width-1000*scale)/2:clamp(offsetX,width-1000*scale,0);
    offsetY=660*scale<=height?(height-660*scale)/2:clamp(offsetY,height-660*scale,0);
  }
  function snapshot(){return {width,height,scale,offsetX,offsetY,zoom:scale/minimum()};}
  function resize(nextWidth,nextHeight){
    if(nextWidth<=0||nextHeight<=0)return snapshot();
    const centerX=(width/2-offsetX)/scale,centerY=(height/2-offsetY)/scale;
    const relativeZoom=width&&height?scale/minimum():null;
    width=nextWidth;height=nextHeight;
    scale=relativeZoom===null?Math.max(width/1000,height/660):clamp(relativeZoom*minimum(),minimum(),maximum());
    offsetX=width/2-(relativeZoom===null?500:centerX)*scale;
    offsetY=height/2-(relativeZoom===null?330:centerY)*scale;
    constrain();return snapshot();
  }
  function zoom(factor,anchorX=width/2,anchorY=height/2){
    if(!width||!height)return snapshot();
    const nextScale=clamp(scale*factor,minimum(),maximum()),ratio=nextScale/scale;
    offsetX=anchorX-(anchorX-offsetX)*ratio;offsetY=anchorY-(anchorY-offsetY)*ratio;scale=nextScale;
    constrain();return snapshot();
  }
  function pan(deltaX,deltaY){offsetX+=deltaX;offsetY+=deltaY;constrain();return snapshot();}
  function fit(){if(width&&height){scale=minimum();constrain();}return snapshot();}
  return {resize,zoom,pan,fit,snapshot};
}

export function attachMapViewport(host,world,controls){
  const camera=createMapCamera(),pointers=new Map();
  let gesture=null,dragging=false,suppressClickUntil=0;
  function paint(){
    const view=camera.snapshot();
    world.style.transform=`translate(${view.offsetX}px,${view.offsetY}px) scale(${view.scale})`;
    controls.querySelector('[data-map-zoom]').textContent=`${Math.round(view.zoom*100)}%`;
    host.classList.toggle('is-dragging',dragging);
  }
  function resize(){camera.resize(host.clientWidth,host.clientHeight);paint();}
  function position(event){const bounds=host.getBoundingClientRect();return {x:event.clientX-bounds.left,y:event.clientY-bounds.top};}
  function measure(){
    const points=[...pointers.values()];
    if(points.length<2)return {...points[0],distance:0};
    return {x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2,distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)};
  }
  function capture(){for(const pointerId of pointers.keys()){try{host.setPointerCapture(pointerId);}catch{}}}
  host.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointers.set(event.pointerId,position(event));gesture=measure();
    if(pointers.size>1){dragging=true;suppressClickUntil=Infinity;capture();paint();}
  });
  host.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,position(event));const next=measure();
    if(!dragging&&Math.hypot(next.x-gesture.x,next.y-gesture.y)<6)return;
    dragging=true;suppressClickUntil=Infinity;capture();
    if(next.distance&&gesture.distance)camera.zoom(next.distance/gesture.distance,gesture.x,gesture.y);
    camera.pan(next.x-gesture.x,next.y-gesture.y);gesture=next;paint();
  });
  function finish(event){
    if(!pointers.delete(event.pointerId))return;
    if(dragging)suppressClickUntil=performance.now()+400;
    if(pointers.size){gesture=measure();}else{gesture=null;dragging=false;}
    paint();
  }
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',finish);
  host.addEventListener('lostpointercapture',finish);
  host.addEventListener('click',event=>{
    if(event.detail!==0&&performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  host.addEventListener('dragstart',event=>event.preventDefault());
  host.addEventListener('wheel',event=>{
    event.preventDefault();const anchor=position(event);
    const units=event.deltaMode===1?16:event.deltaMode===2?host.clientHeight:1;
    if(event.shiftKey&&!event.ctrlKey)camera.pan(-event.deltaY*units,-event.deltaX*units);
    else camera.zoom(Math.exp(-clamp(event.deltaY*units,-400,400)*.002),anchor.x,anchor.y);
    paint();
  },{passive:false});
  host.addEventListener('keydown',event=>{
    if(event.target!==host)return;
    const actions={ArrowLeft:()=>camera.pan(60,0),ArrowRight:()=>camera.pan(-60,0),ArrowUp:()=>camera.pan(0,60),ArrowDown:()=>camera.pan(0,-60),'+':()=>camera.zoom(1.25),'=':()=>camera.zoom(1.25),'-':()=>camera.zoom(.8),Home:()=>camera.fit()};
    if(actions[event.key]){event.preventDefault();actions[event.key]();paint();}
  });
  controls.querySelector('[data-map-zoom-in]').addEventListener('click',()=>{camera.zoom(1.25);paint();});
  controls.querySelector('[data-map-zoom-out]').addEventListener('click',()=>{camera.zoom(.8);paint();});
  controls.querySelector('[data-map-fit]').addEventListener('click',()=>{camera.fit();paint();});
  const observer=new ResizeObserver(resize);observer.observe(host);
  window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
  resize();
  return {resize,get interacting(){return pointers.size>0;}};
}
