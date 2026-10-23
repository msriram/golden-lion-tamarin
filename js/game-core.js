export const ROWS = 7;
export const COLS = 12;
export const WEEKS_PER_YEAR = 52;
export const TREE_MATURITY_WEEKS = 104;

export const TOOL_CONFIG = {
  inspect: { label: 'Inspect', cost: 0 },
  restore: { label: 'Plant corridor', cost: 110 },
  agreement: { label: 'Land agreement', cost: 800 },
  bridge: { label: 'Canopy crossing', cost: 2400 }
};

export const FUNDRAISERS = {
  presentation: { label: 'Class presentation', cost: 40, duration: 4, payout: 160, awareness: 10 },
  artShow: { label: 'Community art show', cost: 250, duration: 10, payout: 900, awareness: 8 },
  scienceFair: { label: 'School science fair', cost: 340, duration: 12, payout: 1450, awareness: 12 }
};

function makeTile(row, column) {
  let kind = 'pasture';
  if (column <= 2 || column >= 8) kind = 'forest';
  if (column === 6 || column === 7) kind = 'road';
  if (row === 0 && column >= 9) kind = 'town';
  if (row === 6 && column >= 3 && column <= 5) kind = 'stream';

  const isPublicRoute = row === 3 && (column === 3 || column === 4);
  return {
    id: `${row}-${column}`,
    row,
    column,
    kind,
    permission: kind === 'forest' || isPublicRoute,
    restoration: null
  };
}

function addEvent(state, message, tone = 'note') {
  state.events.unshift({ id: `${state.totalWeeks}-${state.eventCounter}`, week: state.totalWeeks, message, tone });
  state.eventCounter += 1;
  state.events = state.events.slice(0, 12);
}

export function createInitialState() {
  const tiles = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) tiles.push(makeTile(row, column));
  }

  return {
    version: 1,
    totalWeeks: 0,
    paused: true,
    speed: 1,
    status: 'playing',
    balanceFC: 18500,
    previousYearEndBalanceFC: 18500,
    yearlyIncomeFC: 0,
    yearlyExpensesFC: 0,
    decliningBalanceYears: 0,
    monkeyCount: 6,
    awareness: 12,
    crossingCount: 0,
    tiles,
    bridge: null,
    agreements: [],
    fundraisers: [],
    wildlife: { canopy: 100, ground: 100, birds: 100, amphibians: 100, pollinators: 100 },
    eventCounter: 2,
    events: [
      { id: '0-1', week: 0, message: 'Mission opened: reconnect the west and east forest patches.', tone: 'goal' },
      { id: '0-0', week: 0, message: 'Start with the highlighted row. Two pasture tiles already have restoration permission.', tone: 'note' }
    ]
  };
}

function cloneState(state) {
  return structuredClone(state);
}

function charge(state, amount, description) {
  if (state.balanceFC < amount) return false;
  state.balanceFC -= amount;
  state.yearlyExpensesFC += amount;
  addEvent(state, `${description}: −${amount.toLocaleString()} FC`, 'cost');
  return true;
}

export function findTile(state, tileId) {
  return state.tiles.find((tile) => tile.id === tileId);
}

export function describeTile(tile) {
  if (!tile) return 'Select a map tile to inspect it.';
  if (tile.kind === 'forest') return 'Established forest. It already provides canopy habitat in this teaching model.';
  if (tile.kind === 'road') return tile.row === 3 ? 'Narrow road crossing site. A canopy crossing can connect suitable anchors here.' : 'Road. This location is not approved for a canopy crossing in the scenario.';
  if (tile.kind === 'town') return 'Town area. Conservation routes must work around homes and community needs.';
  if (tile.kind === 'stream') return 'Stream edge. It needs a specialized buffer plan, not the standard corridor brush.';
  if (tile.restoration) {
    const remaining = Math.max(0, TREE_MATURITY_WEEKS - tile.restoration.ageWeeks);
    return remaining === 0
      ? 'Mature teaching-model corridor tile. In real restoration, readiness requires field monitoring.'
      : `Young mixed native planting. ${remaining} simulated weeks until canopy readiness.`;
  }
  return tile.permission
    ? 'Pasture with restoration permission in this scenario.'
    : 'Privately managed pasture. A voluntary land agreement is required before planting.';
}

export function applyTool(oldState, tool, tileId) {
  const state = cloneState(oldState);
  const tile = findTile(state, tileId);
  if (!tile) return { state: oldState, ok: false, message: 'That tile does not exist.' };
  if (state.status !== 'playing') return { state: oldState, ok: false, message: 'Reset the scenario to keep building.' };

  if (tool === 'inspect') return { state, ok: true, message: describeTile(tile) };

  if (tool === 'restore') {
    if (tile.kind !== 'pasture') return { state: oldState, ok: false, message: 'Planting is limited to suitable pasture tiles in this scenario.' };
    if (!tile.permission) return { state: oldState, ok: false, message: 'Permission first: negotiate a voluntary land agreement.' };
    if (tile.restoration) return { state: oldState, ok: false, message: 'This tile already has a restoration cohort.' };
    if (!charge(state, TOOL_CONFIG.restore.cost, 'Mixed native restoration')) return { state: oldState, ok: false, message: 'Not enough Forest Credits.' };
    tile.restoration = { ageWeeks: 0, stage: 'sapling' };
    addEvent(state, `Planted a mixed restoration tile at row ${tile.row + 1}, column ${tile.column + 1}.`, 'forest');
    return { state, ok: true, message: 'Saplings planted. They need 104 simulated weeks to reach canopy readiness.' };
  }

  if (tool === 'agreement') {
    if (tile.kind !== 'pasture') return { state: oldState, ok: false, message: 'Land agreements apply to pasture parcels in this scenario.' };
    if (tile.permission) return { state: oldState, ok: false, message: 'Restoration permission is already active here.' };
    if (state.agreements.some((agreement) => agreement.tileId === tile.id)) return { state: oldState, ok: false, message: 'A conversation with this landowner is already underway.' };
    if (!charge(state, TOOL_CONFIG.agreement.cost, 'Stewardship agreement')) return { state: oldState, ok: false, message: 'Not enough Forest Credits.' };
    state.agreements.push({ tileId: tile.id, completeWeek: state.totalWeeks + 8 });
    addEvent(state, 'Landowner conversation started. Consent and stewardship support take time.', 'community');
    return { state, ok: true, message: 'Agreement in progress. It will complete in 8 simulated weeks.' };
  }

  if (tool === 'bridge') {
    if (tile.kind !== 'road' || tile.row !== 3) return { state: oldState, ok: false, message: 'This scenario has one approved short crossing site in the highlighted row.' };
    if (state.bridge) return { state: oldState, ok: false, message: 'The scenario already has a canopy crossing project.' };
    if (!charge(state, TOOL_CONFIG.bridge.cost, 'Canopy crossing construction')) return { state: oldState, ok: false, message: 'Not enough Forest Credits.' };
    state.bridge = { status: 'building', readyWeek: state.totalWeeks + 8, condition: 1, observedCrossings: 0 };
    addEvent(state, 'Canopy crossing construction started. Building it does not guarantee wildlife use.', 'build');
    return { state, ok: true, message: 'Crossing under construction. Completion is expected in 8 simulated weeks.' };
  }

  return { state: oldState, ok: false, message: 'Choose a valid tool.' };
}

export function startFundraiser(oldState, fundraiserId) {
  const config = FUNDRAISERS[fundraiserId];
  if (!config) return { state: oldState, ok: false, message: 'Unknown community event.' };
  if (oldState.fundraisers.some((event) => event.status === 'preparing')) return { state: oldState, ok: false, message: 'Finish the current community event first.' };
  const state = cloneState(oldState);
  if (!charge(state, config.cost, config.label)) return { state: oldState, ok: false, message: 'Not enough Forest Credits.' };
  state.fundraisers.push({ id: fundraiserId, status: 'preparing', completeWeek: state.totalWeeks + config.duration });
  addEvent(state, `${config.label} preparation started. Fictional payout arrives after ${config.duration} weeks.`, 'community');
  return { state, ok: true, message: `${config.label} scheduled.` };
}

export function isRouteConnected(state) {
  const corridorColumns = [3, 4, 5];
  const corridorReady = corridorColumns.every((column) => {
    const tile = findTile(state, `3-${column}`);
    return tile?.restoration?.ageWeeks >= TREE_MATURITY_WEEKS;
  });
  return corridorReady && state.bridge?.status === 'ready';
}

export function getMetrics(state) {
  const restored = state.tiles.filter((tile) => tile.restoration);
  const mature = restored.filter((tile) => tile.restoration.ageWeeks >= TREE_MATURITY_WEEKS);
  const forestTiles = state.tiles.filter((tile) => tile.kind === 'forest').length + mature.length;
  const availableTiles = state.tiles.filter((tile) => !['road', 'town', 'stream'].includes(tile.kind)).length;
  return {
    year: Math.floor(state.totalWeeks / WEEKS_PER_YEAR) + 1,
    week: (state.totalWeeks % WEEKS_PER_YEAR) + 1,
    restored: restored.length,
    mature: mature.length,
    forestPercent: Math.round((forestTiles / availableTiles) * 100),
    connected: isRouteConnected(state)
  };
}

function resolveProjects(state) {
  for (const agreement of state.agreements) {
    if (!agreement.completed && agreement.completeWeek <= state.totalWeeks) {
      agreement.completed = true;
      const tile = findTile(state, agreement.tileId);
      if (tile) tile.permission = true;
      addEvent(state, 'Voluntary land agreement completed. Restoration is now allowed on that parcel.', 'community');
    }
  }

  if (state.bridge?.status === 'building' && state.bridge.readyWeek <= state.totalWeeks) {
    state.bridge.status = 'ready';
    addEvent(state, 'Canopy crossing construction completed. Wildlife use still needs to be observed.', 'build');
  }

  for (const fundraiser of state.fundraisers) {
    if (fundraiser.status === 'preparing' && fundraiser.completeWeek <= state.totalWeeks) {
      const config = FUNDRAISERS[fundraiser.id];
      fundraiser.status = 'complete';
      state.balanceFC += config.payout;
      state.yearlyIncomeFC += config.payout;
      state.awareness = Math.min(100, state.awareness + config.awareness);
      addEvent(state, `${config.label} finished: +${config.payout.toLocaleString()} FC and +${config.awareness} awareness.`, 'income');
    }
  }
}

function growForest(state) {
  for (const tile of state.tiles) {
    if (!tile.restoration) continue;
    tile.restoration.ageWeeks += 1;
    if (tile.restoration.ageWeeks === 26) {
      tile.restoration.stage = 'young';
      addEvent(state, 'A restoration tile moved from sapling to young growth.', 'forest');
    }
    if (tile.restoration.ageWeeks === TREE_MATURITY_WEEKS) {
      tile.restoration.stage = 'mature';
      addEvent(state, 'A restoration tile reached canopy readiness in the teaching model.', 'forest');
    }
  }
}

function updateWildlife(state) {
  const metrics = getMetrics(state);
  state.wildlife.pollinators = 100 + Math.min(20, metrics.restored * 3);
  state.wildlife.birds = 100 + Math.min(18, metrics.mature * 4);
  state.wildlife.canopy = 100 + Math.min(20, metrics.mature * 4 + (metrics.connected ? 5 : 0));
  state.wildlife.ground = 100 + Math.min(8, metrics.mature * 2);
  state.wildlife.amphibians = 100 + Math.min(5, metrics.mature);
}

function settleYear(state) {
  const restoredTiles = state.tiles.filter((tile) => tile.restoration).length;
  const upkeep = restoredTiles * 8 + (state.bridge?.status === 'ready' ? 70 : 0) + state.agreements.filter((agreement) => agreement.completed).length * 40;
  state.balanceFC -= upkeep;
  state.yearlyExpensesFC += upkeep;
  addEvent(state, `Year-end stewardship and maintenance: −${upkeep.toLocaleString()} FC.`, 'cost');

  if (isRouteConnected(state) && state.crossingCount > 0) {
    state.monkeyCount += 2;
    addEvent(state, 'Annual model update: the connected habitat can now support a larger local family group.', 'wildlife');
  }

  const declined = state.balanceFC < state.previousYearEndBalanceFC;
  state.decliningBalanceYears = declined ? state.decliningBalanceYears + 1 : 0;
  state.previousYearEndBalanceFC = state.balanceFC;
  state.yearlyIncomeFC = 0;
  state.yearlyExpensesFC = 0;

  if (state.decliningBalanceYears >= 10) {
    state.status = 'lost-funding';
    state.paused = true;
    addEvent(state, 'The program ended after ten consecutive years of declining closing funds.', 'warning');
  }
}

export function simulateOneWeek(oldState) {
  if (oldState.paused || oldState.status !== 'playing') return oldState;
  const state = cloneState(oldState);
  state.totalWeeks += 1;
  resolveProjects(state);
  growForest(state);
  updateWildlife(state);

  if (isRouteConnected(state) && state.totalWeeks % 13 === 0) {
    state.crossingCount += 1;
    state.bridge.observedCrossings = state.crossingCount;
    addEvent(state, 'Observed: a tamarin family used the connected canopy route.', 'wildlife');
  }

  if (state.totalWeeks % WEEKS_PER_YEAR === 0) settleYear(state);

  if (state.crossingCount >= 2 && getMetrics(state).mature >= 3 && state.awareness >= 20) {
    state.status = 'won';
    state.paused = true;
    addEvent(state, 'Mission complete: habitat, observed use, community support, and upkeep are working together.', 'goal');
  }

  return state;
}

export function setPaused(oldState, paused) {
  const state = cloneState(oldState);
  state.paused = paused;
  return state;
}

export function setSpeed(oldState, speed) {
  const state = cloneState(oldState);
  state.speed = [1, 2, 4].includes(speed) ? speed : 1;
  return state;
}
