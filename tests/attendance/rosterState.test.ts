/**
 * Unit tests for `src/features/attendance/rosterState.ts`. These cover
 * task 7.6's "roster toggles update pending count" requirement at the
 * level of the logic module, where it can be exercised exhaustively
 * without touching React.
 */
import {
  emptyRoster,
  isChecked,
  pendingCount,
  togglePerson,
  withRefreshedPresent,
} from '@/features/attendance/rosterState';

describe('rosterState', () => {
  it('reports DB-present persons as checked', () => {
    const s = emptyRoster(['p1', 'p2']);
    expect(isChecked(s, 'p1')).toBe(true);
    expect(isChecked(s, 'p3')).toBe(false);
  });

  it('toggle ON for an absent person adds to pendingAdds and bumps count', () => {
    let s = emptyRoster();
    s = togglePerson(s, 'p1');
    expect(isChecked(s, 'p1')).toBe(true);
    expect(pendingCount(s)).toBe(1);
    expect([...s.pendingAdds]).toEqual(['p1']);
    expect([...s.pendingRemoves]).toEqual([]);
  });

  it('toggle OFF for a present person adds to pendingRemoves', () => {
    let s = emptyRoster(['p1']);
    s = togglePerson(s, 'p1');
    expect(isChecked(s, 'p1')).toBe(false);
    expect(pendingCount(s)).toBe(1);
    expect([...s.pendingRemoves]).toEqual(['p1']);
  });

  it('double toggle reverts to no pending change', () => {
    let s = emptyRoster();
    s = togglePerson(s, 'p1');
    s = togglePerson(s, 'p1');
    expect(isChecked(s, 'p1')).toBe(false);
    expect(pendingCount(s)).toBe(0);
  });

  it('double toggle of a present person reverts the remove', () => {
    let s = emptyRoster(['p1']);
    s = togglePerson(s, 'p1');
    s = togglePerson(s, 'p1');
    expect(isChecked(s, 'p1')).toBe(true);
    expect(pendingCount(s)).toBe(0);
  });

  it('counts adds and removes together', () => {
    let s = emptyRoster(['p1']);
    s = togglePerson(s, 'p2'); // add
    s = togglePerson(s, 'p1'); // remove
    expect(pendingCount(s)).toBe(2);
    expect([...s.pendingAdds]).toEqual(['p2']);
    expect([...s.pendingRemoves]).toEqual(['p1']);
  });

  it('refreshing the present set drops pending', () => {
    let s = emptyRoster(['p1']);
    s = togglePerson(s, 'p2');
    s = withRefreshedPresent(s, ['p1', 'p2']);
    expect(pendingCount(s)).toBe(0);
    expect(isChecked(s, 'p1')).toBe(true);
    expect(isChecked(s, 'p2')).toBe(true);
  });

  it('toggle does not mutate the previous state', () => {
    const before = emptyRoster();
    const after = togglePerson(before, 'p1');
    expect(before.pendingAdds.size).toBe(0);
    expect(after.pendingAdds.size).toBe(1);
    expect(after).not.toBe(before);
  });
});
