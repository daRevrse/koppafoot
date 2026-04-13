import { auth } from "@/lib/firebase";
import { onIdTokenChanged } from "firebase/auth";

/**
 * Syncs Firebase ID token to a cookie named __session.
 * This allows the proxy (middleware) to check auth state server-side.
 * Call this once at app startup (e.g., in AuthContext or root layout).
 */
export function syncSessionCookie() {
  return onIdTokenChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
    } else {
      document.cookie = "__session=; path=/; max-age=0";
    }
  });
}
