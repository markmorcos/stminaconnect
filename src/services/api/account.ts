import type { ServantRow } from './servants';
import { supabase } from './supabase';

export async function updateMyServant(displayName: string): Promise<ServantRow> {
  const { data, error } = await supabase.rpc('update_my_servant', {
    display_name: displayName,
  });
  if (error) throw error;
  return data as ServantRow;
}
