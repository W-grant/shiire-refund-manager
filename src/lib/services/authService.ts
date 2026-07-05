import { supabase } from "../supabase";

export type AppRole = "admin" | "staff" | "tax_accountant";

export type AppProfile = {
  id: string;
  display_name: string;
  role: AppRole;
  is_active: boolean;
};

export type AuthSnapshot = {
  authenticated: boolean;
  profile: AppProfile | null;
};

export async function getCurrentAuth(): Promise<AuthSnapshot> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) return { authenticated: false, profile: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,role,is_active")
    .eq("id", userId)
    .single();
  if (error) throw error;

  return { authenticated: true, profile: data as AppProfile };
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return getCurrentAuth();
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function completePasswordRecovery(url: string) {
  const parsedUrl = new URL(url);
  const code = parsedUrl.searchParams.get("code");
  if (!code) return false;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
