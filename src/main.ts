import "./lib/supabase-connection-check";
import { loadSupabasePurchaseState } from "./lib/services/purchaseReadService";

declare global {
  interface Window {
    ShiireSupabaseRead?: {
      loadAll: typeof loadSupabasePurchaseState;
    };
  }
}

window.ShiireSupabaseRead = {
  loadAll: loadSupabasePurchaseState
};
window.dispatchEvent(new Event("shiire:supabase-read-ready"));
