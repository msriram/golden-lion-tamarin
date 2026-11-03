import {DIFFICULTIES,createInitialState} from './game-core.js?v=20261103-forest-redesign-1';
import {forestSceneArtwork} from './forest-scene.js?v=20261103-forest-redesign-1';

document.querySelector('[data-landscape-preview]').innerHTML=forestSceneArtwork(createInitialState());
const body=document.querySelector('[data-mode-table]');
for(const [id,mode] of Object.entries(DIFFICULTIES)){
  const row=document.createElement('tr');
  if(id==='explorer')row.dataset.recommended='';
  for(const value of [id==='explorer'?mode.label+' · first campaign':mode.label,...['operations','income','growth','threat'].map(key=>mode[key].toFixed(2)+'×')]){
    const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  body.append(row);
}
