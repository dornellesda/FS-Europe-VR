import { createClient } from '@supabase/supabase-js';

// Access environment variables securely through Vite's import.meta.env
// The user will need to define these in a .env file locally and in Vercel settings.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// We export the client or null if not configured, to allow graceful fallback to local storage
// while the user sets up their database.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase is not configured! Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Database saving is disabled.");
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
