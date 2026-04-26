/**
 * Type shapes mirroring the `public.persons` table from migration 002.
 * Keep in sync with the SQL schema; the RPCs in `services/api/persons.ts`
 * project these shapes out of `supabase.rpc(...)` responses.
 */

export type PersonLanguage = 'en' | 'ar' | 'de';
export type PersonPriority = 'high' | 'medium' | 'low' | 'very_low';
export type PersonStatus = 'new' | 'active' | 'inactive' | 'on_break';
export type PersonRegistrationType = 'quick_add' | 'full';

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  region: string | null;
  language: PersonLanguage;
  priority: PersonPriority;
  assigned_servant: string;
  /** Null in `list_persons`; null in `get_person` when caller isn't admin or assigned. */
  comments: string | null;
  status: PersonStatus;
  paused_until: string | null;
  registration_type: PersonRegistrationType;
  registered_by: string;
  registered_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PersonsFilter {
  assigned_servant?: string;
  region?: string;
  status?: PersonStatus;
  search?: string;
}

export interface PersonCreatePayload {
  first_name: string;
  last_name: string;
  language: PersonLanguage;
  registration_type: PersonRegistrationType;
  /**
   * Optional. Non-admin callers always end up as the assigned servant
   * regardless of what's sent here (the RPC overrides). Admins may set
   * this to register on behalf of another servant; omitted ⇒ caller.
   */
  assigned_servant?: string;
  phone?: string | null;
  region?: string | null;
  priority?: PersonPriority;
  comments?: string | null;
  status?: PersonStatus;
  paused_until?: string | null;
}

export type PersonUpdatePayload = Partial<
  Pick<
    Person,
    | 'first_name'
    | 'last_name'
    | 'phone'
    | 'region'
    | 'language'
    | 'priority'
    | 'comments'
    | 'paused_until'
    | 'status'
  >
>;
