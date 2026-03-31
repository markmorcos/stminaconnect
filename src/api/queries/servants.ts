import { supabase } from '../supabase';
import { Servant } from '../../types';

export async function listServants(): Promise<Servant[]> {
  const { data, error } = await supabase
    .from('servants')
    .select('*')
    .order('last_name', { ascending: true });
  if (error) throw error;
  return data as Servant[];
}

export async function getServant(id: string): Promise<Servant> {
  const { data, error } = await supabase
    .from('servants')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Servant;
}

export async function updateServant(
  id: string,
  input: Partial<Pick<Servant, 'preferred_language' | 'push_token' | 'regions'>>
): Promise<Servant> {
  const { data, error } = await supabase
    .from('servants')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Servant;
}
