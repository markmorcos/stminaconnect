/**
 * Pure logic for the attendance roster screen — kept separate from the
 * React component so the toggle / pending-set semantics can be unit
 * tested without rendering anything.
 *
 * The roster works against three sets of person ids:
 *
 *   - `present`     : persons currently marked present in the DB
 *                     (from `get_event_attendance`).
 *   - `pendingAdds` : persons toggled ON locally but not yet saved.
 *   - `pendingRemoves`: persons toggled OFF locally but not yet saved.
 *
 * Toggling reconciles the change against the DB state:
 *   - toggling ON  a present person  → removes from `pendingRemoves`
 *   - toggling ON  an absent person  → adds to `pendingAdds`
 *   - toggling OFF a present person  → adds to `pendingRemoves`
 *   - toggling OFF an absent person  → removes from `pendingAdds`
 *
 * The "displayed checked" state for a row is computed as:
 *   present XOR (in pendingAdds OR in pendingRemoves)
 *
 * which collapses to: "toggling makes it the opposite of DB state".
 */

export interface RosterState {
  present: ReadonlySet<string>;
  pendingAdds: ReadonlySet<string>;
  pendingRemoves: ReadonlySet<string>;
}

export function emptyRoster(present: Iterable<string> = []): RosterState {
  return {
    present: new Set(present),
    pendingAdds: new Set(),
    pendingRemoves: new Set(),
  };
}

/** Whether the row should display as checked given the current state. */
export function isChecked(state: RosterState, personId: string): boolean {
  if (state.pendingAdds.has(personId)) return true;
  if (state.pendingRemoves.has(personId)) return false;
  return state.present.has(personId);
}

/** Toggle the checked state for a person, returning a new RosterState. */
export function togglePerson(state: RosterState, personId: string): RosterState {
  const wasChecked = isChecked(state, personId);
  const isPresent = state.present.has(personId);

  const adds = new Set(state.pendingAdds);
  const removes = new Set(state.pendingRemoves);

  if (wasChecked) {
    // turning OFF
    if (isPresent) {
      removes.add(personId);
      adds.delete(personId);
    } else {
      adds.delete(personId);
    }
  } else {
    // turning ON
    if (isPresent) {
      removes.delete(personId);
    } else {
      adds.add(personId);
      removes.delete(personId);
    }
  }

  return { present: state.present, pendingAdds: adds, pendingRemoves: removes };
}

/** Total number of pending changes — what the Save FAB shows. */
export function pendingCount(state: RosterState): number {
  return state.pendingAdds.size + state.pendingRemoves.size;
}

/**
 * Replace the DB-truth set after a successful save / refetch. Pending
 * sets are dropped because the new `present` already reflects the saved
 * changes; any newly-discovered server changes show up as well.
 */
export function withRefreshedPresent(
  state: RosterState,
  nextPresent: Iterable<string>,
): RosterState {
  return emptyRoster(nextPresent);
}
