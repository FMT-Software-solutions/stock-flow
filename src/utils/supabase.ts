
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Both are baked in at build time. The build now refuses to run without them,
// so reaching this branch means the bundle was produced some other way — say
// a stale dist/ from before the guard existed. createClient's own complaint
// ("supabaseUrl is required") sends people hunting for a runtime setting that
// does not exist, so name the real cause instead.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY were missing when this app ' +
      'was built. Set them in .env.local and rebuild — they cannot be supplied ' +
      'at runtime.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase
        