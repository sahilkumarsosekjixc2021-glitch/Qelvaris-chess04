import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fails loudly but politely: RootApp shows CONFIG_PROBLEM instead of a blank white page.
function checkConfig() {
  if (!supabaseUrl || !supabaseAnonKey) return "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. Add them in Vercel -> Settings -> Environment Variables (or your local .env) and redeploy.";
  if (!/^https:\/\/.+\.supabase\.(co|in)\/?$/.test(supabaseUrl)) return "VITE_SUPABASE_URL does not look like https://<project>.supabase.co";
  // The anon key is public by design. A service_role key must NEVER be in the browser.
  try {
    const part = supabaseAnonKey.split(".")[1];
    if (part && JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role") {
      return "A service_role key was found in VITE_SUPABASE_ANON_KEY. Remove it now and rotate the key in Supabase: it gives full database access.";
    }
  } catch { /* new-style publishable keys are not JWTs; that is fine */ }
  return "";
}

export const CONFIG_PROBLEM = checkConfig();

export const supabase = createClient(
  CONFIG_PROBLEM ? "https://config-missing.invalid" : supabaseUrl,
  CONFIG_PROBLEM ? "config-missing" : supabaseAnonKey
);
