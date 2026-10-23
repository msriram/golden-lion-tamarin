import {
  COLS,
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

const storageKey = 'goldenThreadsGameV1';
const map = document.querySelector('[data-game-map]');
const message = document.querySelector('[data-game-message]');
const tamarin = document.querySelector('[data-tamarin]');
const reportDialog = document.querySelector('[data-report-dialog]');
let state = loadState() || createInitialState();
let activeTool = 'inspect';
let timer = null;

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed.version === 1 ? parsed : null;
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
  map.innerHTML = '';
  for (const tile of state.tiles) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `map-cell ${tile.kind}`;
    button.dataset.tileId = tile.id;
    button.setAttribute('aria-label', tileLabel(tile));
    if (tile.kind === 'pasture' && !tile.permission) button.classList.add('private');
    if (tile.row === 3 && tile.column >= 3 && tile.column <= 7) button.classList.add('route-target');
    if (tile.restoration) button.classList.add(`restored-${tile.restoration.stage}`);
    if (tile.kind === 'road' && tile.row === 3 && state.bridge) button.classList.add(state.bridge.status === 'ready' ? 'bridge-site' : 'bridge-building');
    button.addEventListener('click', () => handleTileClick(tile.id));
    map.append(button);
  }
}

function handleTileClick(tileId) {
  const result = applyTool(state, activeTool, tileId);
  state = result.state;
  const tile = findTile(state, tileId);
  document.querySelector('[data-inspector-title]').textContent = activeTool === 'inspect' ? `Tile ${tile.row + 1}.${tile.column + 1}` : result.ok ? 'Action accepted' : 'Action blocked';
  document.querySelector('[data-inspector]').textContent = result.message;
  setMessage(result.message, result.ok ? 'success' : 'error');
  render();
}

function positionTamarin() {
  const connected = isRouteConnected(state);
  const disconnectedPath = [[1, 2], [2, 1], [3, 2], [4, 1]];
  const connectedPath = [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6.5], [3, 8], [3, 9], [3, 10]];
  const path = connected ? connectedPath : disconnectedPath;
  const index = Math.floor(state.totalWeeks / 2) % path.length;
  const [row, column] = path[index];
  tamarin.style.left = `${((column + 0.5) / COLS) * 100}%`;
  tamarin.style.top = `${((row + 0.5) / 7) * 100}%`;
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
  document.querySelectorAll('[data-speed]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed)));
  document.querySelectorAll('[data-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tool === activeTool)));
  const eventPending = state.fundraisers.some((event) => event.status === 'preparing');
  document.querySelectorAll('[data-fundraiser]').forEach((button) => {
    button.disabled = eventPending;
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

  if (state.status === 'won') {
    setMessage('Mission complete: the route is mature, supported, and used.', 'success');
    showReport('The forest has a future', 'You combined consent, restoration, infrastructure, community support, and observed route use.', 'Mission complete');
  }
  if (state.status === 'lost-funding') {
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
  if (!reportDialog.open) reportDialog.showModal();
}

function restartTimer() {
  clearInterval(timer);
  if (state.paused || state.status !== 'playing') return;
  timer = setInterval(() => {
    const before = getMetrics(state).year;
    state = simulateOneWeek(state);
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
document.querySelector('[data-reset]').addEventListener('click', () => {
  if (!window.confirm('Reset this teaching scenario and erase the local save?')) return;
  localStorage.removeItem(storageKey);
  state = createInitialState();
  setMessage('Scenario reset. The simulation is paused.', 'success');
  render();
  restartTimer();
});

reportDialog.addEventListener('close', () => {
  if (state.status === 'playing') {
    state = setPaused(state, false);
    render();
    restartTimer();
  }
});

render();
restartTimer();
