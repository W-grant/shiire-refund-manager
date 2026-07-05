import "./lib/supabase-connection-check";
import { completePasswordRecovery, getCurrentAuth, signInWithPassword, signOut, updatePassword } from "./lib/services/authService";
import { loadSupabasePurchaseState } from "./lib/services/purchaseReadService";
import { getPurchaseSaveStatus, savePurchase, updatePurchase } from "./lib/services/purchaseWriteService";

declare global {
  interface Window {
    ShiireAuth?: {
      getCurrentAuth: typeof getCurrentAuth;
      completePasswordRecovery: typeof completePasswordRecovery;
      signInWithPassword: typeof signInWithPassword;
      signOut: typeof signOut;
      updatePassword: typeof updatePassword;
    };
    ShiireSupabaseRead?: {
      loadAll: typeof loadSupabasePurchaseState;
    };
    ShiireSupabaseWrite?: {
      getSaveStatus: typeof getPurchaseSaveStatus;
      savePurchase: typeof savePurchase;
      updatePurchase: typeof updatePurchase;
    };
  }
}

window.ShiireAuth = {
  completePasswordRecovery,
  getCurrentAuth,
  signInWithPassword,
  signOut,
  updatePassword
};
window.ShiireSupabaseRead = {
  loadAll: loadSupabasePurchaseState
};
window.ShiireSupabaseWrite = {
  getSaveStatus: getPurchaseSaveStatus,
  savePurchase,
  updatePurchase
};
window.dispatchEvent(new Event("shiire:supabase-read-ready"));
window.dispatchEvent(new Event("shiire:supabase-write-ready"));
window.dispatchEvent(new Event("shiire:auth-ready"));
