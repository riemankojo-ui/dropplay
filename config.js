const SUPABASE_URL = 'https://jzmoquqwsymxmkqgxiys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WugzrmPmu9M_SyKiKJX7Hw_RWw9MQIJ';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);