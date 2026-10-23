import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE_MATURITY_WEEKS,
  applyTool,
  createInitialState,
  findTile,
  isRouteConnected,
  setPaused,
  simulateOneWeek,
  startFundraiser
} from '../js/game-core.js';

function advance(oldState, weeks) {
  let state = setPaused(oldState, false);
  for (let count = 0; count < weeks; count += 1) state = simulateOneWeek(state);
  return state;
}

function buildBridges(state) {
  state = applyTool(state, 'bridge', '3-6').state;
  state = applyTool(state, 'bridge', '3-7').state;
  return advance(state, 8);
}

test('tree cover stays locked until both bridges finish', () => {
  let state = createInitialState();
  assert.equal(applyTool(state, 'restore', '3-3').ok, false);
  state = advance(applyTool(state, 'bridge', '3-6').state, 8);
  assert.equal(applyTool(state, 'restore', '3-3').ok, false);
  state = advance(applyTool(state, 'bridge', '3-7').state, 7);
  assert.equal(applyTool(state, 'restore', '3-3').ok, false);
  state = advance(state, 1);
  assert.equal(applyTool(state, 'restore', '3-3').ok, true);
});

test('private pasture cannot be planted before an agreement', () => {
  const initial = createInitialState();
  const result = applyTool(initial, 'restore', '3-5');
  assert.equal(result.ok, false);
  assert.equal(findTile(result.state, '3-5').restoration, null);
  assert.equal(result.state.balanceFC, 18500);
});

test('agreement grants permission after eight simulated weeks', () => {
  const initial = createInitialState();
  const agreement = applyTool(initial, 'agreement', '3-5');
  assert.equal(agreement.ok, true);
  const state = advance(agreement.state, 8);
  assert.equal(findTile(state, '3-5').permission, true);
});

test('fundraiser payout happens exactly once', () => {
  const initial = createInitialState();
  const scheduled = startFundraiser(initial, 'presentation');
  const afterFourWeeks = advance(scheduled.state, 4);
  assert.equal(afterFourWeeks.balanceFC, 18500 - 40 + 160);
  const afterFiveWeeks = advance(afterFourWeeks, 1);
  assert.equal(afterFiveWeeks.balanceFC, afterFourWeeks.balanceFC);
});

test('planted trees are not instantly mature', () => {
  const initial = buildBridges(createInitialState());
  const planted = applyTool(initial, 'restore', '3-3');
  assert.equal(planted.ok, true);
  const beforeMaturity = advance(planted.state, TREE_MATURITY_WEEKS - 1);
  assert.equal(findTile(beforeMaturity, '3-3').restoration.stage, 'young');
  const mature = advance(beforeMaturity, 1);
  assert.equal(findTile(mature, '3-3').restoration.stage, 'mature');
});

test('bridge alone does not create tamarin connectivity', () => {
  const readyBridge = buildBridges(createInitialState());
  assert.equal(readyBridge.bridge.status, 'ready');
  assert.equal(isRouteConnected(readyBridge), false);
});

test('mature corridor plus ready bridge activates the route', () => {
  let state = buildBridges(createInitialState());
  state = applyTool(state, 'restore', '3-3').state;
  state = applyTool(state, 'restore', '3-4').state;
  state = applyTool(state, 'agreement', '3-5').state;
  state = advance(state, 8);
  state = applyTool(state, 'restore', '3-5').state;
  state = advance(state, TREE_MATURITY_WEEKS);
  assert.equal(isRouteConnected(state), true);
});
