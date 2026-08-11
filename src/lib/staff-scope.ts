import type {
  FirestoreStaffGrant,
  FirestoreStaffScope,
  StaffGrant,
  StaffScope,
} from "@/types";

// ============================================
// Staff access codes — pure helpers
//
// No Firebase import lives here on purpose: the API routes (admin SDK) and the
// browser screens both need the same scope vocabulary, and a client-SDK import
// would poison the server bundle.
// ============================================

/**
 * Code alphabet without the characters people mistype when a code is read out
 * loud or scribbled on a team sheet: no O/0, no I/1, no L, no U/V confusion.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";
const CODE_LENGTH = 8;

/** A fresh code, e.g. "H4KM-2Q7P". Stored and compared without the dash. */
export function generateStaffCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Uppercase, strip everything that is not part of the alphabet (dashes, spaces). */
export function normalizeStaffCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "H4KM2Q7P" → "H4KM-2Q7P" — only for display, never for lookup. */
export function formatStaffCode(code: string): string {
  const c = normalizeStaffCode(code);
  return c.length === CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

// ── Scope ────────────────────────────────────────────────────

export function describeStaffScope(scope: StaffScope): string {
  switch (scope.kind) {
    case "competition":
      return "Toute la compétition";
    case "stage":
      return scope.stage === "group" ? "Phase de groupes" : "Phase finale";
    case "group":
      return `Poule ${scope.group}`;
    case "match":
      return scope.matchLabel || "Un match";
  }
}

/** One line of plain French explaining what the holder may actually do. */
export function explainStaffScope(scope: StaffScope): string {
  switch (scope.kind) {
    case "competition":
      return "Peut saisir en direct n'importe quel match de la compétition.";
    case "stage":
      return scope.stage === "group"
        ? "Peut saisir en direct les matchs de poule uniquement."
        : "Peut saisir en direct les matchs à élimination directe uniquement.";
    case "group":
      return `Peut saisir en direct les matchs de la poule ${scope.group} uniquement.`;
    case "match":
      return "Peut saisir en direct ce seul match.";
  }
}

export function scopeToFirestore(scope: StaffScope): FirestoreStaffScope {
  if (scope.kind === "match") {
    return { kind: "match", match_id: scope.matchId, match_label: scope.matchLabel };
  }
  return scope;
}

export function scopeFromFirestore(scope: FirestoreStaffScope): StaffScope {
  if (scope.kind === "match") {
    return { kind: "match", matchId: scope.match_id, matchLabel: scope.match_label };
  }
  return scope;
}

/**
 * Validate a scope arriving from a client. Returns null when the shape is not
 * one the rules know how to enforce — an unknown scope must never be stored,
 * because rules fall through to "deny" and the code would silently do nothing.
 */
export function parseStaffScope(input: unknown): StaffScope | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  switch (raw.kind) {
    case "competition":
      return { kind: "competition" };
    case "stage":
      return raw.stage === "group" || raw.stage === "knockout"
        ? { kind: "stage", stage: raw.stage }
        : null;
    case "group": {
      const group = typeof raw.group === "string" ? raw.group.trim() : "";
      return group ? { kind: "group", group } : null;
    }
    case "match": {
      const matchId = typeof raw.matchId === "string" ? raw.matchId.trim() : "";
      const matchLabel = typeof raw.matchLabel === "string" ? raw.matchLabel.trim() : "";
      return matchId ? { kind: "match", matchId, matchLabel } : null;
    }
    default:
      return null;
  }
}

// ── Grants ───────────────────────────────────────────────────

export function toStaffGrant(data: FirestoreStaffGrant): StaffGrant {
  return {
    uid: data.uid,
    name: data.name,
    code: data.code,
    label: data.label,
    scope: scopeFromFirestore(data.scope),
    grantedAt: data.granted_at,
    expiresAt: data.expires_at_ms != null ? new Date(data.expires_at_ms).toISOString() : null,
    revoked: data.revoked === true,
  };
}

/** A grant only counts while it is neither revoked nor past its expiry. */
export function isGrantActive(grant: StaffGrant, now: number = Date.now()): boolean {
  if (grant.revoked) return false;
  if (!grant.expiresAt) return true;
  return new Date(grant.expiresAt).getTime() > now;
}

/**
 * Does this grant cover that match? Mirrors `staffGrantCoversMatch` in
 * firestore.rules — the rules are the enforcement, this is what the UI uses to
 * avoid offering a console the write will be refused on.
 */
export function grantCoversMatch(
  grant: StaffGrant,
  match: { id: string; stage: string; group: string | null },
): boolean {
  if (!isGrantActive(grant)) return false;
  switch (grant.scope.kind) {
    case "competition":
      return true;
    case "stage":
      return match.stage === grant.scope.stage;
    case "group":
      return match.group === grant.scope.group;
    case "match":
      return match.id === grant.scope.matchId;
  }
}
