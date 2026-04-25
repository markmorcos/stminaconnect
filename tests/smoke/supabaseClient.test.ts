import { supabase } from '@/services/api/supabase';

describe('supabase client', () => {
  it('constructs without throwing', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth).toBe('object');
  });

  it('auth.getSession resolves to an object', async () => {
    const result = await supabase.auth.getSession();
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
