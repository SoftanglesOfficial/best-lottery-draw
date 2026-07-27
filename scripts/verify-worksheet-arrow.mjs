import assert from 'node:assert/strict';

function nextEditableCol(col, unlocked) {
  const order = unlocked ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 4, 5, 6]; // code item [prefix series] from to rate
  const i = order.indexOf(col);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}
function prevEditableCol(col, unlocked) {
  const order = unlocked ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 4, 5, 6];
  const i = order.indexOf(col);
  return i > 0 ? order[i - 1] : null;
}
assert.equal(nextEditableCol(1, false), 4);
assert.equal(prevEditableCol(4, false), 1);
assert.equal(nextEditableCol(6, false), null);
assert.equal(prevEditableCol(0, false), null);
console.log('verify-worksheet-arrow: ok');
