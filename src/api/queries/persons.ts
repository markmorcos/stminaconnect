import { supabase } from '../supabase';
import { Person } from '../../types';

export type CreatePersonInput = Omit<
  Person,
  'id' | 'registered_at' | 'updated_at'
> & {
  status?: Person['status'];
};

export type UpdatePersonInput = Partial<
  Omit<Person, 'id' | 'registered_at' | 'registered_by'>
>;

export async function listPersons(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .order('registered_at', { ascending: false });
  if (error) throw error;
  return data as Person[];
}

export async function getPerson(id: string): Promise<Person> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Person;
}

export async function createPerson(input: CreatePersonInput): Promise<Person> {
  const { data, error } = await supabase
    .from('persons')
    .insert({ ...input, status: input.status ?? 'new' })
    .select()
    .single();
  if (error) throw error;
  return data as Person;
}

export async function updatePerson(
  id: string,
  input: UpdatePersonInput
): Promise<Person> {
  const { data, error } = await supabase
    .from('persons')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Person;
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from('persons').delete().eq('id', id);
  if (error) throw error;
}
