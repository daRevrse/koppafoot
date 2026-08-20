import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "@/lib/firebase";

// ============================================
// reCAPTCHA verifiers for phone auth.
//
// Firebase consumes the reCAPTCHA token on EVERY sendVerificationCode call,
// successful or not, so each attempt needs a brand new verifier. That much
// is well known, what bites is the container:
//
// `verifier.clear()` releases the verifier on Firebase's side but leaves the
// rendered widget in the DOM node. Constructing the next verifier on that
// same dirty node yields a token the backend rejects with
// INVALID_APP_CREDENTIAL, intermittently, which makes it look like a
// backend flake rather than a client bug.
//
// So: fresh verifier AND fresh container, every time.
// ============================================

export function createRecaptchaVerifier(
  host: HTMLElement,
  previous?: RecaptchaVerifier | null,
): RecaptchaVerifier {
  previous?.clear();
  // Drop whatever the previous attempt left behind.
  host.replaceChildren();

  const container = document.createElement("div");
  host.appendChild(container);

  return new RecaptchaVerifier(auth, container, { size: "invisible" });
}
