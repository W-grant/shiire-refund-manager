import "./lib/supabase-connection-check";
import { loadSupabasePurchaseState } from "./lib/services/purchaseReadService";
import { getPurchaseSaveStatus, savePurchase } from "./lib/services/purchaseWriteService";

declare global {
  interface Window {
    ShiireSupabaseRead?: {
      loadAll: typeof loadSupabasePurchaseState;
    };
    ShiireSupabaseWrite?: {
      getSaveStatus: typeof getPurchaseSaveStatus;
      savePurchase: typeof savePurchase;
    };
  }
}

window.ShiireSupabaseRead = {
  loadAll: loadSupabasePurchaseState
};
window.ShiireSupabaseWrite = {
  getSaveStatus: getPurchaseSaveStatus,
  savePurchase
};
window.dispatchEvent(new Event("shiire:supabase-read-ready"));
window.dispatchEvent(new Event("shiire:supabase-write-ready"));
