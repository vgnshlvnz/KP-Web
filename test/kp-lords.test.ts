import test from 'node:test';
import assert from 'node:assert';
import { calculateKpLords } from '../dist/kp/sub-lords.js';

test('KP Lords for initial point of Aries (0°00\'00")', () => {
  const lords = calculateKpLords(0.0);

  assert.strictEqual(lords.signName, 'Aries');
  assert.strictEqual(lords.signLord, 'Mars');
  assert.strictEqual(lords.nakshatraName, 'Ashwini');
  assert.strictEqual(lords.starLord, 'Ketu');
  assert.strictEqual(lords.subLord, 'Ketu');
  assert.strictEqual(lords.subSubLord, 'Ketu');
  assert.strictEqual(lords.isNearSubBoundary, true); // at exact start of sub
});

test('KP Lords for 3°00\'00" Virgo (153°)', () => {
  // 153° = 3° Virgo
  // Leo ends at 150°.
  // Nakshatra: Uttara Phalguni (starts at 146°40' Leo, ends at 160°00' Virgo).
  // Star Lord: Sun.
  // In Uttara Phalguni, sub 6 is Saturn (153°00' to 155°06'40").
  const lords = calculateKpLords(153.0);

  assert.strictEqual(lords.signName, 'Virgo');
  assert.strictEqual(lords.signLord, 'Mercury');
  assert.strictEqual(lords.nakshatraName, 'Uttara Phalguni');
  assert.strictEqual(lords.starLord, 'Sun');
  assert.strictEqual(lords.subLord, 'Saturn');
  assert.strictEqual(lords.subSubLord, 'Saturn');
});

test('Boundary detection triggers when within threshold', () => {
  // Sub boundary is at 153.0 (3° Virgo)
  // 153.0 + 30 arcseconds = 153.0 + 30/3600 = 153.0083333°
  const nearStart = calculateKpLords(153.0 + 30 / 3600, 60);
  assert.strictEqual(nearStart.isNearSubBoundary, true);

  // 154.0 is well within the sub (span is 153.0 to ~155.11)
  const far = calculateKpLords(154.0, 60);
  assert.strictEqual(far.isNearSubBoundary, false);
});
