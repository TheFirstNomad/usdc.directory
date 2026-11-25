import { supabaseConnectedHost } from "@/integrations/supabase/client";

/**
 * Base URL of the backend functions, taken from the validated backend URL the
 * app is actually connected to (never from a separate project-id variable that
 * can be missing or stale).
 */
export const FUNCTIONS_BASE = `${supabaseConnectedHost.replace(/\/$/, "")}/functions/v1`;
