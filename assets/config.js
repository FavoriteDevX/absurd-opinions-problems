/*
 * Optional: live community votes shared between all visitors.
 *
 * Leave these empty and the site works fully offline: your votes are kept
 * in your own browser only.
 *
 * To turn on shared, near-real-time vote counts, create a free Supabase
 * project, run supabase.sql in its SQL editor, then paste the project URL
 * and the public "anon" key below. The anon key is meant to be public.
 */
window.AOP_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',  // the project's public anon key
  pollSeconds: 15       // how often to refresh community counts
};
