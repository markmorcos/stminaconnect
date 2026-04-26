/**
 * Submit pipeline for the Full Registration form.
 *
 * Three modes — `create`, `upgrade`, `edit` — share the same form UI
 * but route to different RPCs:
 *
 *   create  → `create_person({ ..., registration_type: 'full' })`
 *   upgrade → `update_person({ ..., registration_type: 'full' })`
 *             (assigned_servant is NOT included; the row keeps the
 *             current servant unless an admin reassigns separately).
 *   edit    → `update_person(diff)`. If the admin changed
 *             `assigned_servant`, the change is split off into
 *             `assign_person(personId, newServantId, reason)` so the
 *             trigger writes an `assignment_history` row. Other field
 *             changes are batched into a single `update_person`.
 *
 * Field-level permissions are enforced server-side. The hook surfaces
 * a localized message for `forbidden_field:<name>` errors so the UI
 * can render an inline snackbar.
 */
import { useState } from 'react';
import { i18n } from '@/i18n';
import {
  assignPerson,
  createPerson,
  findPotentialDuplicate,
  getPerson,
  updatePerson,
} from '@/services/api/persons';
import type { Person, PersonUpdatePayload } from '@/types/person';

import type { FullRegistrationOutput } from '../schemas/fullRegistrationSchema';

export type FullRegistrationMode = 'create' | 'upgrade' | 'edit';

export interface SubmitContext {
  mode: FullRegistrationMode;
  personId?: string;
  /**
   * For `edit` mode the original Person row, used to compute the diff
   * (so we don't send unchanged fields and don't bypass the comments
   * privacy filter when the form was rendered without comments access).
   */
  initialPerson?: Person;
  /**
   * `true` when the caller has comment-edit access (admin OR currently
   * assigned servant). When false, the comments field was not rendered
   * and must not be included in the update payload.
   */
  canEditComments: boolean;
  isAdmin: boolean;
}

export interface DuplicateHit {
  id: string;
  name: string;
}

export interface SubmitResult {
  /** The id of the affected person (newly-created in `create` mode). */
  personId: string;
  /** Mirrors `mode` for the screen's success-routing decision. */
  mode: FullRegistrationMode;
  /** Set when `assign_person` was called as part of an `edit` save. */
  reassigned: boolean;
  /**
   * False only when `mode='create'` and the user picked "Use existing"
   * in the duplicate dialog — in that case `personId` is the existing
   * row, not a fresh insert.
   */
  created: boolean;
}

export class ReassignmentReasonRequiredError extends Error {
  constructor() {
    super('reassignment_reason_required');
    this.name = 'ReassignmentReasonRequiredError';
  }
}

export class ForbiddenFieldError extends Error {
  field: string;
  constructor(field: string) {
    super(`forbidden_field:${field}`);
    this.name = 'ForbiddenFieldError';
    this.field = field;
  }
}

export interface UseFullRegistrationSubmitOptions {
  context: SubmitContext;
  /** Called when the duplicate dialog needs to open. Resolves with
   *  `'use-existing'` (caller will navigate to the duplicate) or
   *  `'save-anyway'` (caller will retry submit). */
  onDuplicate?: (hit: DuplicateHit) => Promise<'use-existing' | 'save-anyway'>;
}

function pickChanges(
  base: Person,
  next: FullRegistrationOutput,
  canEditComments: boolean,
  isAdmin: boolean,
): PersonUpdatePayload {
  const changes: PersonUpdatePayload = {};
  if (next.first_name !== base.first_name) changes.first_name = next.first_name;
  if (next.last_name !== base.last_name) changes.last_name = next.last_name;
  const nextPhone = next.phone;
  if (nextPhone !== base.phone) changes.phone = nextPhone;
  const nextRegion = next.region ?? null;
  if ((base.region ?? null) !== nextRegion) changes.region = nextRegion;
  if (next.language !== base.language) changes.language = next.language;

  // Admin-only fields. Skip even adding them to the payload when the
  // caller is non-admin — the UI keeps these disabled, but defensive
  // pruning here prevents an accidental forbidden_field rejection if
  // RHF default-values drift.
  if (isAdmin && next.priority !== base.priority) {
    changes.priority = next.priority;
  }

  if (canEditComments) {
    const nextComments = next.comments ?? null;
    if ((base.comments ?? null) !== nextComments) {
      changes.comments = nextComments;
    }
  }
  return changes;
}

export function useFullRegistrationSubmit({
  context,
  onDuplicate,
}: UseFullRegistrationSubmitOptions) {
  const [isSubmitting, setSubmitting] = useState(false);

  async function submit(values: FullRegistrationOutput): Promise<SubmitResult | null> {
    setSubmitting(true);
    try {
      if (context.mode === 'create') {
        return await submitCreate(values, onDuplicate);
      }
      if (!context.personId) {
        throw new Error('personId required for upgrade/edit');
      }
      if (context.mode === 'upgrade') {
        return await submitUpgrade(context.personId, values, context);
      }
      return await submitEdit(context.personId, values, context);
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, isSubmitting };
}

async function submitCreate(
  values: FullRegistrationOutput,
  onDuplicate?: (hit: DuplicateHit) => Promise<'use-existing' | 'save-anyway'>,
): Promise<SubmitResult | null> {
  const dupId = await findPotentialDuplicate(
    values.first_name,
    values.last_name,
    values.phone,
  ).catch(() => null);
  if (dupId && onDuplicate) {
    let name = `${values.first_name} ${values.last_name}`.trim();
    try {
      const existing = await getPerson(dupId);
      if (existing) name = `${existing.first_name} ${existing.last_name}`.trim();
    } catch {
      /* fall back to typed name */
    }
    const choice = await onDuplicate({ id: dupId, name });
    if (choice === 'use-existing') {
      return { personId: dupId, mode: 'create', reassigned: false, created: false };
    }
  }
  const id = await createPerson({
    first_name: values.first_name,
    last_name: values.last_name,
    phone: values.phone,
    region: values.region ?? null,
    language: values.language,
    priority: values.priority,
    assigned_servant: values.assigned_servant,
    comments: values.comments ?? null,
    registration_type: 'full',
  });
  return { personId: id, mode: 'create', reassigned: false, created: true };
}

async function submitUpgrade(
  personId: string,
  values: FullRegistrationOutput,
  context: SubmitContext,
): Promise<SubmitResult> {
  const payload: PersonUpdatePayload = {
    first_name: values.first_name,
    last_name: values.last_name,
    phone: values.phone,
    region: values.region ?? null,
    language: values.language,
    registration_type: 'full',
  };
  if (context.isAdmin) {
    payload.priority = values.priority;
  }
  if (context.canEditComments) {
    payload.comments = values.comments ?? null;
  }
  await updatePersonOrThrow(personId, payload);
  let reassigned = false;
  if (
    context.isAdmin &&
    context.initialPerson &&
    values.assigned_servant !== context.initialPerson.assigned_servant
  ) {
    if (!values.reassignment_reason) {
      throw new ReassignmentReasonRequiredError();
    }
    await assignPerson(personId, values.assigned_servant, values.reassignment_reason);
    reassigned = true;
  }
  return { personId, mode: 'upgrade', reassigned, created: false };
}

async function submitEdit(
  personId: string,
  values: FullRegistrationOutput,
  context: SubmitContext,
): Promise<SubmitResult> {
  if (!context.initialPerson) {
    throw new Error('initialPerson required for edit mode');
  }
  const reassignedTo =
    values.assigned_servant !== context.initialPerson.assigned_servant
      ? values.assigned_servant
      : null;
  if (reassignedTo && !context.isAdmin) {
    throw new ForbiddenFieldError('assigned_servant');
  }
  if (reassignedTo && !values.reassignment_reason) {
    throw new ReassignmentReasonRequiredError();
  }

  const changes = pickChanges(
    context.initialPerson,
    values,
    context.canEditComments,
    context.isAdmin,
  );
  if (Object.keys(changes).length > 0) {
    await updatePersonOrThrow(personId, changes);
  }
  let reassigned = false;
  if (reassignedTo && values.reassignment_reason) {
    await assignPerson(personId, reassignedTo, values.reassignment_reason);
    reassigned = true;
  }
  return { personId, mode: 'edit', reassigned, created: false };
}

async function updatePersonOrThrow(personId: string, payload: PersonUpdatePayload) {
  try {
    await updatePerson(personId, payload);
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? '';
    const m = msg.match(/forbidden_field:([a-z_]+)/i);
    if (m) throw new ForbiddenFieldError(m[1]);
    throw err;
  }
}

export function localizedSubmitError(err: unknown): string {
  if (err instanceof ForbiddenFieldError) {
    return i18n.t('persons.edit.errorPermissionField', { field: err.field });
  }
  if (err instanceof ReassignmentReasonRequiredError) {
    return i18n.t('persons.edit.errorReasonRequired');
  }
  return i18n.t('common.errors.generic');
}
