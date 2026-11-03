import {DIFFICULTIES,PATCHES,LINKS} from './game-core.js';
import {terrainArtwork} from './terrain.js';

document.querySelector('[data-landscape-preview]').innerHTML=terrainArtwork();
const landscape=document.querySelector('[data-landscape-preview] svg');
function shape(name,attributes,text){
  const element=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [attribute,value] of Object.entries(attributes))element.setAttribute(attribute,String(value));
  if(text)element.textContent=text;
  return element;
}
for(const link of LINKS){
  const from=PATCHES.find(patch=>patch.id===link.from),to=PATCHES.find(patch=>patch.id===link.to);
  landscape.append(shape('line',{x1:from.x*10,y1:from.y*6.6,x2:to.x*10,y2:to.y*6.6,stroke:'#77794f','stroke-width':3,'stroke-dasharray':'8 9'}));
}
for(const patch of PATCHES){
  const grove=shape('g',{transform:`translate(${patch.x*10} ${patch.y*6.6})`});
  grove.append(shape('ellipse',{rx:84,ry:65,fill:'#47734b'}));
  for(const [x,y,radius] of [[-35,-20,24],[9,-30,26],[40,0,25],[-25,26,27],[14,22,23]]){
    grove.append(shape('circle',{cx:x,cy:y,r:radius,fill:'#2e5539'}));
  }
  grove.append(shape('rect',{x:-90,y:68,width:180,height:25,rx:4,fill:'#fff8e7'}),shape('text',{x:0,y:86,'text-anchor':'middle',fill:'#213d2d','font-size':17,'font-family':'sans-serif'},patch.name));
  landscape.append(grove);
}
const body=document.querySelector('[data-mode-table]');
for(const [id,mode] of Object.entries(DIFFICULTIES)){
  const row=document.createElement('tr');
  if(id==='standard')row.dataset.recommended='';
  for(const value of [id==='standard'?mode.label+' · recommended':mode.label,...['operations','income','growth','threat'].map(key=>mode[key].toFixed(2)+'×')]){
    const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  body.append(row);
}
