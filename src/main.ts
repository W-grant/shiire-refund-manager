import "./lib/supabase-connection-check";
import { loadSupabasePurchaseState } from "./lib/services/purchaseReadService";
import { insertSupabasePurchase } from "./lib/services/purchaseWriteService";

declare global {
  interface Window {
    ShiireSupabaseRead?: {
      loadAll: typeof loadSupabasePurchaseState;
    };
    ShiireSupabaseWrite?: {
      insertPurchase: typeof insertSupabasePurchase;
    };
  }
}

window.ShiireSupabaseRead = {
  loadAll: loadSupabasePurchaseState
};
window.ShiireSupabaseWrite = {
  insertPurchase: insertSupabasePurchase
};
window.dispatchEvent(new Event("shiire:supabase-read-ready"));
window.dispatchEvent(new Event("shiire:supabase-write-ready"));
