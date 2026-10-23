import {
  applyTool,
  createInitialState,
  describeTile,
  findTile,
  getMetrics,
  isRouteConnected,
  setPaused,
  setSpeed,
  simulateOneWeek,
  startFundraiser
} from './game-core.js';
import { AREAS, terrainArtwork } from './terrain.js';

const storageKey = 'tamarinTrailsGameV2';
const map = document.querySelector('[data-game-map]');
const message = document.querySelector('[data-game-message]');
const tamarin = document.querySelector('[data-tamarin]');
const reportDialog = document.querySelector('[data-report-dialog]');
let state = loadState() || createInitialState();
let activeTool = 'inspect';
let timer = null;
let terminalReportShown = false;

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed.version === 2 ? parsed : null;
  } catch {
    return null;
  }
}

function saveState(showMessage = true) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (showMessage) setMessage('Scenario saved on this device.', 'success');
}

function setMessage(text, tone = '') {
  message.textContent = text;
  message.className = `game-message ${tone}`.trim();
}

function tileLabel(tile) {
  const base = `Row ${tile.row + 1}, column ${tile.column + 1}. ${describeTile(tile)}`;
  if (tile.row === 3 && tile.column >= 3 && tile.column <= 7) return `${base} This tile is part of the mission route.`;
  return base;
}

function renderMap() {
  const focusId = document.activeElement?.dataset.tileId;
  map.innerHTML = terrainArtwork();
  for (const area of AREAS) {
    const tile = findTile(state, area.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `terrain-area ${area.kind}`;
    button.dataset.tileId = tile.id;
    button.setAttribute('aria-label', `${area.name}. ${describeTile(tile)}`);
    button.style.cssText = `left:${area.x}%;top:${area.y}%;width:${area.width}%;height:${area.height}%`;
    button.innerHTML = `<span class="area-name">${area.name}${area.kind === 'planting' && !tile.permission ? ' · Permission needed' : ''}</span>`;
    if (tile.restoration) button.classList.add(`restored-${tile.restoration.stage}`);
    const segment = state.bridge?.segments.find((entry) => entry.tileId === tile.id);
    if (segment) button.classList.add(segment.readyWeek <= state.totalWeeks ? 'bridge-ready' : 'bridge-building');
    if (area.kind === 'forest' || tile.restoration) {
      const mature = area.kind === 'forest' || tile.restoration?.stage === 'mature';
      button.innerHTML += Array.from({length: mature ? 14 : 7}, (_, index) => `<i class="terrain-tree ${mature ? '' : 'sapling'}" style="left:${15 + (index * 31 % 70)}%;top:${12 + (index * 23 % 64)}%"></i>`).join('');
    }
    button.addEventListener('click', () => handleTileClick(tile.id));
    map.append(button);
  }
  if (focusId) map.querySelector(`[data-tile-id="${focusId}"]`)?.focus({preventScroll:true});
}

function handleTileClick(tileId) {
  const result = applyTool(state, activeTool, tileId);
  state = result.state;
  const tile = findTile(state, tileId);
  document.querySelector('[data-inspector-title]').textContent = activeTool === 'inspect' ? AREAS.find((area) => area.id === tileId).name : result.ok ? 'Action accepted' : 'Action blocked';
  document.querySelector('[data-inspector]').textContent = result.message;
  setMessage(result.message, result.ok ? 'success' : 'error');
  render();
}

function positionTamarin() {
  const connected = isRouteConnected(state);
  const disconnectedPath = [[44, 13], [38, 18], [48, 20], [44, 13]];
  const connectedPath = [[44, 16], [37, 33], [31, 49], [39, 65], [48, 82], [39, 65], [31, 49], [37, 33]];
  const path = connected ? connectedPath : disconnectedPath;
  const index = Math.floor(state.totalWeeks / 2) % path.length;
  const [vertical, horizontal] = path[index];
  tamarin.style.left = `${horizontal}%`;
  tamarin.style.top = `${vertical}%`;
}

function renderObjectives(metrics) {
  const objectiveState = {
    permission: state.agreements.some((agreement) => agreement.completed),
    plant: metrics.restored >= 3,
    bridge: state.bridge?.status === 'ready',
    mature: metrics.mature >= 3,
    observe: state.crossingCount >= 2,
    community: state.awareness >= 20
  };
  for (const [id, complete] of Object.entries(objectiveState)) {
    document.querySelector(`[data-objective="${id}"]`)?.classList.toggle('complete', complete);
  }
}

function renderWildlife() {
  const names = { canopy: 'Canopy mammals', ground: 'Ground mammals', birds: 'Forest birds', amphibians: 'Amphibians', pollinators: 'Pollinators' };
  document.querySelector('[data-wildlife]').innerHTML = Object.entries(state.wildlife)
    .map(([id, value]) => `<div class="wildlife-row"><span>${names[id]}</span><strong>${value >= 100 ? '+' : ''}${value - 100}%</strong></div>`)
    .join('');
}

function renderEvents(metrics) {
  document.querySelector('[data-event-log]').innerHTML = state.events
    .map((event) => {
      const year = Math.floor(event.week / 52) + 1;
      const week = (event.week % 52) + 1;
      return `<li class="${event.tone}"><time>Year ${year}, week ${week}</time>${event.message}</li>`;
    })
    .join('');

  const routeStatus = document.querySelector('[data-route-status]');
  routeStatus.textContent = metrics.connected ? 'Route active' : 'Disconnected';
}

function renderControls() {
  const pauseButton = document.querySelector('[data-pause]');
  pauseButton.textContent = state.paused ? 'Start' : 'Pause';
  pauseButton.disabled = state.status !== 'playing';
  document.querySelector('[data-tool="restore"]').disabled = state.bridge?.status !== 'ready' || state.status !== 'playing';
  document.querySelectorAll('[data-speed]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed)));
  document.querySelectorAll('[data-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tool === activeTool)));
  const eventPending = state.fundraisers.some((event) => event.status === 'preparing');
  document.querySelectorAll('[data-fundraiser]').forEach((button) => {
    button.disabled = eventPending || state.status !== 'playing';
    button.title = eventPending ? 'Finish the current event first' : '';
  });
}

function render() {
  const metrics = getMetrics(state);
  document.querySelector('[data-hud="funds"]').textContent = `${state.balanceFC.toLocaleString()} FC`;
  document.querySelector('[data-hud="calendar"]').textContent = `Y${metrics.year} • W${metrics.week}`;
  document.querySelector('[data-hud="tamarins"]').textContent = state.monkeyCount;
  document.querySelector('[data-hud="forest"]').textContent = `${metrics.forestPercent}%`;
  document.querySelector('[data-hud="crossings"]').textContent = state.crossingCount;
  renderMap();
  positionTamarin();
  renderObjectives(metrics);
  renderWildlife();
  renderEvents(metrics);
  renderControls();

  if (state.status === 'won' && !terminalReportShown) {
    terminalReportShown = true;
    setMessage('Mission complete: the route is mature, supported, and used.', 'success');
    showReport('The forest has a future', 'You combined consent, restoration, infrastructure, community support, and observed route use.', 'Mission complete');
  }
  if (state.status === 'lost-funding' && !terminalReportShown) {
    terminalReportShown = true;
    setMessage('Program ended after ten years of declining closing funds.', 'error');
    showReport('Support ran out', 'Closing funds declined for ten years in a row. Try a slower build plan with stronger community support.', 'Program ended');
  }
}

function showReport(title, copy, stamp = 'Annual report') {
  const metrics = getMetrics(state);
  document.querySelector('[data-report-stamp]').textContent = stamp;
  document.querySelector('[data-report-title]').textContent = title;
  document.querySelector('[data-report-copy]').textContent = copy;
  document.querySelector('[data-report="funds"]').textContent = `${state.balanceFC.toLocaleString()} FC`;
  document.querySelector('[data-report="forest"]').textContent = `${metrics.forestPercent}%`;
  document.querySelector('[data-report="crossings"]').textContent = state.crossingCount;
  document.querySelector('[data-report="tamarins"]').textContent = state.monkeyCount;
  document.querySelector('[data-report-continue]').textContent = state.status === 'playing' ? 'Continue the scenario' : 'Close report';
  document.querySelector('[data-report-reset]').hidden = state.status === 'playing';
  if (!reportDialog.open) reportDialog.showModal();
}

function restartTimer() {
  clearInterval(timer);
  if (state.paused || state.status !== 'playing') return;
  timer = setInterval(() => {
    const before = getMetrics(state).year;
    state = simulateOneWeek(state);
    if (state.status !== 'playing') clearInterval(timer);
    const after = getMetrics(state).year;
    saveState(false);
    render();
    if (after !== before && state.status === 'playing') {
      state = setPaused(state, true);
      showReport(`Year ${before} report`, 'A year has passed. Review the forest, wildlife, and funds before continuing.');
      render();
      restartTimer();
    }
  }, 1000 / state.speed);
}

document.querySelectorAll('[data-tool]').forEach((button) => {
  button.addEventListener('click', () => {
    activeTool = button.dataset.tool;
    setMessage(`${button.textContent.trim()} selected. Choose a tile on the map.`);
    renderControls();
  });
});

document.querySelector('[data-pause]').addEventListener('click', () => {
  state = setPaused(state, !state.paused);
  setMessage(state.paused ? 'Simulation paused.' : 'Simulation running. Trees, projects, and events now advance each week.', 'success');
  render();
  restartTimer();
});

document.querySelectorAll('[data-speed]').forEach((button) => {
  button.addEventListener('click', () => {
    state = setSpeed(state, Number(button.dataset.speed));
    setMessage(`Simulation speed set to ${state.speed}×.`);
    renderControls();
    restartTimer();
  });
});

document.querySelectorAll('[data-fundraiser]').forEach((button) => {
  button.addEventListener('click', () => {
    const result = startFundraiser(state, button.dataset.fundraiser);
    state = result.state;
    setMessage(result.message, result.ok ? 'success' : 'error');
    render();
  });
});

document.querySelector('[data-save]').addEventListener('click', () => saveState());
function resetGame() {
  if (reportDialog.open) reportDialog.close('reset');
  localStorage.removeItem(storageKey);
  state = createInitialState();
  terminalReportShown = false;
  setMessage('Scenario reset. The simulation is paused.', 'success');
  render();
  restartTimer();
}

document.querySelector('[data-reset]').addEventListener('click', resetGame);
document.querySelector('[data-report-reset]').addEventListener('click', resetGame);

reportDialog.addEventListener('close', () => {
  if (state.status === 'playing' && reportDialog.returnValue !== 'reset') {
    state = setPaused(state, false);
    render();
    restartTimer();
  }
});

render();
restartTimer();
