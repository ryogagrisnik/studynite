import assert from 'node:assert/strict';

import {
  applyAttemptLogEvent,
  clearAttempt,
  createAttemptLogMap,
  shouldDequeue,
} from '@/lib/missedAttemptLog';

const QUESTION_ID = 'question-123';

let map = createAttemptLogMap();
let result = applyAttemptLogEvent(map, {
  questionId: QUESTION_ID,
  status: 'correct',
  phase: 'start',
});
map = result.map;

assert.equal(shouldDequeue(map, QUESTION_ID), false, 'pending attempt should not dequeue');
assert.equal(result.error, null, 'pending attempt should not surface an error');

result = applyAttemptLogEvent(map, {
  questionId: QUESTION_ID,
  status: 'correct',
  phase: 'error',
  error: 'network failed',
});
map = result.map;

assert.equal(shouldDequeue(map, QUESTION_ID), false, 'failed attempt should not dequeue');
assert.equal(result.error, 'network failed', 'error phase should surface the message');

result = applyAttemptLogEvent(map, {
  questionId: QUESTION_ID,
  status: 'correct',
  phase: 'success',
});
map = result.map;

assert.equal(shouldDequeue(map, QUESTION_ID), true, 'successful attempt should dequeue');
assert.equal(result.error, null, 'success phase should not surface an error');

const cleared = clearAttempt(map, QUESTION_ID);
assert.equal(cleared[QUESTION_ID], undefined, 'clearAttempt should remove the entry');
