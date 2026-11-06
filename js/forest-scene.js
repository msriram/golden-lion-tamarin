import {PATCHES,activeLink,corridorGrowth} from './game-core.js?v=20261106-immersive-1';

export const FOREST_SPECIES=['Embaúba','Jequitibá','Ipê-amarelo'];
function randomSource(seed){
  let value=seed;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
const fixed=value=>Number(value.toFixed(2));
export function routeGeometry(link,layout={x:1,y:1}){
  const from=PATCHES.find(patch=>patch.id===link.from),to=PATCHES.find(patch=>patch.id===link.to);
  const start={x:from.x*10*layout.x,y:from.y*6.6*layout.y},end={x:to.x*10*layout.x,y:to.y*6.6*layout.y};
  return {start,end,middle:{x:(start.x+end.x)/2,y:(start.y+end.y)/2+10},path:`M${start.x} ${start.y} Q${(start.x+end.x)/2} ${(start.y+end.y)/2+20} ${end.x} ${end.y}`};
}
function organicPath(centerX,centerY,radiusX,radiusY,seed){
  const random=randomSource(seed),points=Array.from({length:22},(_,index)=>{
    const angle=index/22*Math.PI*2,radius=.8+random()*.25;
    return {x:centerX+Math.cos(angle)*radiusX*radius,y:centerY+Math.sin(angle)*radiusY*radius};
  });
  return points.map((point,index)=>{
    const next=points[(index+1)%points.length];
    return `${index===0?`M${fixed((points.at(-1).x+point.x)/2)} ${fixed((points.at(-1).y+point.y)/2)}`:''} Q${fixed(point.x)} ${fixed(point.y)} ${fixed((point.x+next.x)/2)} ${fixed((point.y+next.y)/2)}`;
  }).join('')+'Z';
}
export function landscapeArtwork(layout={x:1,y:1}){
  return `<svg class="terrain-art forest-scene" viewBox="0 0 ${1000*layout.x} ${660*layout.y}" role="group" aria-label="Interactive Atlantic Forest landscape"><defs>
    <linearGradient id="canopy-light" x2=".8" y2="1"><stop stop-color="#89ac60"/><stop offset=".45" stop-color="#45724b"/><stop offset="1" stop-color="#204b3a"/></linearGradient>
    <linearGradient id="forest-floor" x2="1" y2="1"><stop stop-color="#456e46"/><stop offset="1" stop-color="#193c32"/></linearGradient>
    <linearGradient id="hill-far" x2="0" y2="1"><stop stop-color="#728b72"/><stop offset="1" stop-color="#536f5a"/></linearGradient>
    <pattern id="meadow-grain" width="71" height="79" patternUnits="userSpaceOnUse"><path d="M8 22l4-3m0 4l2-5m33 38l4-2M30 9l2-2m-6 52l4-2" stroke="#56754b" stroke-width=".6" opacity=".3"/><path d="M55 13l5 1m-9 27l4 2" stroke="#d8db9b" opacity=".4"/></pattern>
    <g id="tree-jequitiba"><path d="M-12 6Q3 3 17 14Q15 24 1 25Q-13 23-12 6" fill="#153b30" opacity=".35"/><path d="M-3 13l2-21 4-4 1 25" fill="#65503a"/><path d="M-17-1Q-23-11-13-17Q-11-25 0-21Q10-25 16-15Q27-12 21-2Q25 8 13 10Q5 18-4 11Q-17 15-19 5Z" fill="url(#canopy-light)" stroke="#345e40" stroke-width=".6"/><path d="M-15-10Q-8-18 0-14M3-17Q13-18 15-10M-14 2Q-7-4-1 1M5 5Q12-1 18 0" fill="none" stroke="#b7c788" stroke-width="1.2" opacity=".55"/><g class="tree-detail" fill="none" stroke="#234f38" stroke-width=".7" opacity=".7"><path d="M-12-4l3-5m4 14l2-6m11-8l4-3m1 13l-2 3M-2-15l2 4m-14 17l4-1"/><path d="M-4 8l3-9 8-7M0-2l-8-7" stroke="#728a4c"/></g></g>
    <g id="tree-embauba"><path d="M-4 8l4-25 4 26" fill="#897c54"/><ellipse cx="5" cy="11" rx="21" ry="13" fill="#183f32" opacity=".25"/><g fill="#729d68" stroke="#3d7851" stroke-width=".7"><path d="M0-5L-20-12-9-14-14-24-2-17 2-29 7-17 19-24 15-12 26-7 12-3 18 9 5 4-1 17-5 4-19 8-12-3Z"/><path d="M-3-5l-10-8m10 8l5-15m-5 15l17-7m-17 7l10 9m-10-9l-3 11" stroke="#d2d5a0" fill="none"/></g><path class="tree-detail" d="M-13-14l6 1m10-9l1 6m12 2l-5 4m2 15l-4-3" stroke="#c0d09a" fill="none"/></g>
    <g id="tree-ipe"><use href="#tree-jequitiba"/><path d="M-18-8Q-16-22-4-20Q6-27 16-15Q26-10 18 0Q20 13 7 10Q-4 17-10 7Q-22 7-18-8Z" fill="#c2ad43" opacity=".92"/><path d="M-13-11l5-3m8-4l6 2m6 6l4 2m-3 6l-5 3m-8 2l-5-2m-8-2l3-3" stroke="#f1d276" stroke-width="3"/><path class="tree-detail" d="M-6-9l3 1m7-5l2 3m6 6l-2 2m-8 4l-2-1" stroke="#fff0ae" stroke-width="1.3"/></g>
    <g id="tree-sapling"><ellipse cy="6" rx="6" ry="2" fill="#385a37" opacity=".35"/><path d="M0 5v-12m0 5q-10 0-7-7 8-1 7 7m0 1q8-7 10-1-2 6-10 1" stroke="#3b6a41" fill="#82a557" stroke-width="1"/></g>
    <g id="golden-tamarin"><path d="M-6 5C-30 5-28-17-12-13S-16-1-8-2" fill="none" stroke="#c77923" stroke-width="5" stroke-linecap="round"/><path d="M-5 7l-6 6m12-7l5 6M-6 0l-7-3m17 3l6-4" stroke="#633e29" stroke-width="2.2" stroke-linecap="round"/><ellipse cy="2" rx="9" ry="6" fill="#d68c2e"/><path d="M2-4L0-11 5-9 8-15 11-10 17-12 16-7 21-5 17-2 18 3 13 2 9 6 6 1 2 2Z" fill="#e8aa45"/><ellipse cx="11" cy="-4" rx="5" ry="5.5" fill="#61402c"/><path d="M8-6h1m4 0h1" stroke="#f8dc9c" stroke-width="1.5"/><path d="M10-1h3" stroke="#2c2822" stroke-width="1.2"/></g>
  </defs><g transform="scale(${layout.x} ${layout.y})"><rect x="-6000" y="-6000" width="13000" height="13000" fill="#91a979"/>
    <g class="distant-hills"><path d="M-180 175L-40 54 70 146 160 72 290 188V250H-180Z" fill="url(#hill-far)"/><path d="M760 205L850 92 930 142 1040 38 1170 194V270H760Z" fill="url(#hill-far)"/><path d="M-120 190L20 103 120 171 230 118 330 215M720 225L850 142 940 184 1050 95 1170 220" fill="none" stroke="#d5d9b5" stroke-width="5" opacity=".35"/></g>
    <path d="M-3000 90Q-500-900 260 80T1700-40T5000 180V4000H-3000Z" fill="#a8b98a"/><path d="M-1500 580Q-100 290 320 490T2100 420V3000H-1500Z" fill="#bac592" opacity=".45"/>
    <rect x="-6000" y="-6000" width="13000" height="13000" fill="url(#meadow-grain)"/>
    <g fill="none" stroke="#567557" stroke-width=".8" opacity=".16"><path d="M-600 100Q-200-100 130 20T650 30T1500-10M-600 115Q-200-85 130 35T650 45T1500 5M-600 130Q-200-70 130 50T650 60T1500 20M-600 145Q-200-55 130 65T650 75T1500 35"/></g>
    <path d="M-1500 620Q-100 470 240 566T750 590T2400 450" fill="none" stroke="#5a7e62" stroke-width="45" opacity=".3"/><path d="M-1500 620Q-100 470 240 566T750 590T2400 450" fill="none" stroke="#c3d2ae" stroke-width="30"/><path d="M-1500 620Q-100 470 240 566T750 590T2400 450" fill="none" stroke="#668f89" stroke-width="21"/><path class="water-shimmer" d="M-1500 615Q-100 465 240 561T750 585T2400 445" fill="none" stroke="#d7e8da" stroke-width="2"/>
    <path d="M530-2000Q480-100 610 100T690 370T1100 2300" fill="none" stroke="#b3ac88" stroke-width="20"/><path d="M530-2000Q480-100 610 100T690 370T1100 2300" fill="none" stroke="#73796d" stroke-width="12"/><path d="M530-2000Q480-100 610 100T690 370T1100 2300" fill="none" stroke="#dad6ae" stroke-width=".8" stroke-dasharray="7 11"/>
    <g class="bird-flock" fill="none" stroke="#2f4638" stroke-width="2" stroke-linecap="round"><path d="M0 0q6-6 12 0q6-6 12 0M33 11q5-5 10 0q5-5 10 0M65-8q4-4 8 0q4-4 8 0"/></g><g class="bird-flock secondary" fill="none" stroke="#354b3c" stroke-width="1.7" stroke-linecap="round"><path d="M0 0q5-5 10 0q5-5 10 0M26-9q4-4 8 0q4-4 8 0"/></g>
    <g class="road-vehicle"><rect x="-8" y="-4" width="16" height="8" rx="2" fill="#c8a64a" stroke="#4c4636"/><circle cx="-5" cy="5" r="2" fill="#2b302c"/><circle cx="5" cy="5" r="2" fill="#2b302c"/></g><g class="road-vehicle second"><rect x="-7" y="-4" width="14" height="8" rx="2" fill="#7a9aa0" stroke="#3e4948"/><circle cx="-4" cy="5" r="2" fill="#2b302c"/><circle cx="4" cy="5" r="2" fill="#2b302c"/></g>
  </g></svg>`;
}
function tree(positionX,positionY,size,species,index,extra='',attributes=''){
  return `<g class="tree-anchor" transform="translate(${fixed(positionX)} ${fixed(positionY)})"><g class="tree-sway ${extra?'planted-sway':''}" style="--tree-delay:${-(index%9)}s"><use class="forest-tree ${extra}" href="#tree-${species}" transform="scale(${fixed(size)})" ${attributes}/></g></g>`;
}
export function roadCenterXAt(positionY,layout={x:1,y:1}){
  const y=positionY/layout.y,center=y<=100?610-(100-y)*.13:y<=370?610+(y-100)*(80/270):690+(y-370)*.18;
  return center*layout.x;
}
function keepTreeOffRoad(positionX,positionY,layout,index){
  const center=roadCenterXAt(positionY,layout),clearance=24*layout.x;
  if(Math.abs(positionX-center)>=clearance)return positionX;
  return center+(index%2?1:-1)*(clearance+(index%4)*3*layout.x);
}
function patchArtwork(patch,index,layout){
  const random=randomSource(index*7919+83),centerX=patch.x*10*layout.x,centerY=patch.y*6.6*layout.y;
  const radiusX=85+patch.health*.3,radiusY=57+patch.health*.21;
  const outline=organicPath(centerX,centerY,radiusX,radiusY,index+93),trees=[];
  for(let number=0;number<86;number+=1){
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.92;
    const positionX=centerX+Math.cos(angle)*radiusX*radius,positionY=centerY+Math.sin(angle)*radiusY*radius;
    if(number/86>patch.health/100+.1)continue;
    trees.push({x:positionX,y:positionY,size:.45+random()*.38,species:number%13===0?'ipe':number%5===0?'embauba':'jequitiba',number});
  }
  trees.sort((first,second)=>first.y-second.y);
  return `<g class="forest-grove ${patch.health<45?'degraded-grove':''}" data-grove-art="${patch.id}"><path d="${outline}" fill="#31583d" opacity=".3" transform="translate(6 10)"/><path d="${outline}" fill="url(#forest-floor)" opacity=".85"/>${trees.map(entry=>tree(entry.x,entry.y,entry.size,entry.species,entry.number)).join('')}<path class="grove-target" data-patch="${patch.id}" d="${outline}" role="button" tabindex="0" aria-label="${patch.name}: ${patch.population} tamarins, health ${Math.round(patch.health)}%."/></g>`;
}
function plantingArtwork(link,layout){
  if(!link.planted)return '';
  const growth=corridorGrowth(link),{start,end,path}=routeGeometry(link,layout),random=randomSource(link.id.charCodeAt(0)*99+link.id.charCodeAt(1));
  const length=Math.hypot(end.x-start.x,end.y-start.y),normalX=-(end.y-start.y)/length,normalY=(end.x-start.x)/length,trees=[];
  for(let index=0;index<62;index+=1){
    const fraction=(index+.5)/62,spread=(random()-.5)*(14+growth*80);
    const positionX=start.x+(end.x-start.x)*fraction+normalX*spread,positionY=start.y+(end.y-start.y)*fraction+normalY*spread;
    const roadsideX=keepTreeOffRoad(positionX,positionY,layout,index);
    trees.push({x:roadsideX,y:positionY,size:growth<.13?.45+growth*2:.16+growth*(.38+random()*.3),species:growth<.13?'sapling':index%11===0?'ipe':index%3===0?'embauba':'jequitiba',index});
  }
  return `<g class="restoration-grove" data-growth="${growth.toFixed(3)}" aria-label="Native planting: Embaúba, Jequitibá and Ipê-amarelo; ${Math.round(growth*100)}% canopy development"><path d="${path}" fill="none" stroke="#56794b" stroke-width="${8+growth*82}" opacity="${.15+growth*.25}" stroke-linecap="round"/>${trees.sort((first,second)=>first.y-second.y).map(entry=>tree(entry.x,entry.y,entry.size,entry.species,entry.index,'planted-tree',`data-plant-x="${fixed(entry.x)}" data-plant-y="${fixed(entry.y)}"`)).join('')}</g>`;
}
function bridgeArtwork(link,layout){
  const {start,end,path}=routeGeometry(link,layout),length=Math.hypot(end.x-start.x,end.y-start.y),angle=Math.atan2(end.y-start.y,end.x-start.x)*180/Math.PI;
  const open=activeLink(link),built=link.built;
  const slats=Array.from({length:Math.ceil(length/7)},(_,index)=>{
    const position=(index+.5)/Math.ceil(length/7),positionX=position*length,sag=4*position*(1-position)*12;
    return `<path d="M${fixed(positionX)} ${fixed(sag-3)}v6" stroke="${index%3?'#c7ad74':'#92734c'}" stroke-width="3.2"/>`;
  }).join('');
  return `<g class="habitat-route ${built?'built':''} ${open?'open':''} ${built&&!open?'closed':''} ${link.bridgeDue?'under-construction':''}" data-route="${link.id}" role="button" tabindex="0" aria-label="${link.name}: ${link.agreement?'agreement active':'agreement needed'}; ${built?`bridge ${Math.round(link.condition)}% condition`:`bridge ${link.cost} FC`}; ${link.planted?'native trees growing':'plant cover after bridge completion'}."><path class="route-halo" d="${path}"/><path class="planned-trail" d="${path}"/>
    ${built||link.bridgeDue?`<g transform="translate(${start.x} ${start.y}) rotate(${angle})"><g class="bridge-motion"><path d="M0 5Q${length/2} 30 ${length} 5" stroke="#244436" stroke-width="11" opacity=".25" fill="none"/><path d="M0 0Q${length/2} 24 ${length} 0" stroke="#705a3d" stroke-width="7" fill="none"/>${slats}<path d="M0-5Q${length/2} 19 ${length}-5M0 5Q${length/2} 29 ${length} 5" stroke="#514c32" stroke-width="1.3" fill="none"/>${Array.from({length:Math.ceil(length/21)},(_,index)=>{const positionX=(index+.5)/Math.ceil(length/21)*length,sag=4*(positionX/length)*(1-positionX/length)*12;return `<path d="M${fixed(positionX)} ${fixed(sag-3)}v-6m0 12v5" stroke="#d4c49a" stroke-width=".9"/>`;}).join('')}<path d="M0-11v22M${length}-11v22" stroke="#715437" stroke-width="5"/></g></g>`:''}<path class="route-touch-target" d="${path}"/></g>`;
}
export function forestSceneArtwork(state,layout={x:1,y:1}){
  const distantTrees=Array.from({length:180},(_,index)=>{
    const random=randomSource(index+188),positionX=-700+random()*2400,positionY=-450+random()*1560;
    if(positionX>-30&&positionX<1040&&positionY>10&&positionY<640)return '';
    return tree(positionX*layout.x,positionY*layout.y,.5+random()*.7,index%9===0?'embauba':'jequitiba',index);
  }).join('');
  return landscapeArtwork(layout).replace('</svg>',`${distantTrees}${state.links.map(link=>plantingArtwork(link,layout)).join('')}${state.patches.map((patch,index)=>patchArtwork(patch,index,layout)).join('')}${state.links.map(link=>bridgeArtwork(link,layout)).join('')}</svg>`);
}
