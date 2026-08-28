/**
 * Specific Soroban contract error codes (#288).
 *
 * Maps raw contract failure flags / Soroban error sections to user-friendly,
 * specific messages instead of a generic "transaction failed". Arts separated
 * read the two failure surfaces:
 *
 * - `hostError`/`contractError` flags from a Soroban horizon error
 * - string fragments from the API error message body
 *
 * The fallback is a stable, human-readable message rather than a raw code,
 * so the UI never shows an unexplained hex error to an artist.
 */

/** A known error category with a stable code and a friendly message. */
export interface SorobanErrorMapping {
  /** Stable, machine-readable code surfaced to the UI/analytics. */
  code: string;
  /** User-friendly message shown to the artist. */
  message: string;
}

/** Fired when the contract rejected the invocation for a domain reason. */
export const SOROBAN_ERRORS: Record<string, SorobanErrorMapping> = {
  NOT_REGISTERED: {
    code: "artist_not_registered",
    message: "Your artist profile isn't on-chain yet. Register your artist profile first.",
  },
  ALREADY_REGISTERED: {
    code: "artist_already_registered",
    message: "This artist profile is already registered on-chain.",
  },
  SONG_NOT_FOUND: {
    code: "song_not_found",
    message: "The song could not be found in the catalog contract.",
  },
  ALBUM_NOT_FOUND: {
    code: "album_not_found",
    message: "The album could not be found in the catalog contract.",
  },
  METADATA_NOT_READY: {
    code: "metadata_not_ready",
    message: "The song metadata isn't ready yet. Wait for transcoding and IPFS pinning to finish.",
  },
  SONG_ALREADY_MINTED: {
    code: "song_already_minted",
    message: "This song has already been minted on-chain.",
  },
  INVALID_SIGNATURE: {
    code: "invalid_signature",
    message: "The transaction signature was invalid. Please sign again with Freighter.",
  },
  INSUFFICIENT_FEE: {
    code: "insufficient_fee",
    message: "The transaction fee was too low for the network to accept it.",
  },
  SEQUENCE_MISMATCH: {
    code: "sequence_mismatch",
    message: "Your account's transaction sequence is out of sync. Please retry.",
  },
  NETWORK_ERROR: {
    code: "network_error",
    message: "There was a network issue submitting the transaction. Please try again.",
  },
  REQUEST_TIMEOUT: {
    code: "request_timeout",
    message: "The request timed out. Please check your connection and retry.",
  },
  UNKNOWN: {
    code: "unknown_error",
    message: "Something went wrong submitting the transaction to Stellar.",
  },
};

/**
 * Try to map a raw error to a known Soroban error.
 *
 * The matcher is intentionally loose: contract flags and message fragments
 * both feed in, and the first match on a recognizable fragment wins. Returns
 * the UNKNOWN mapping when nothing matches.
 */
export function mapSorobanError(error: unknown): SorobanErrorMapping {
  const raw = errorToString(error);
  const lower = raw.toLowerCase();

  // Freighter / Stellar SDK contract error flags
  if (/not.?registered|register_artist/.test(lower) && /not|invalid/.test(lower)) {
    return SOROBAN_ERRORS.NOT_REGISTERED;
  }
  if (/already.?registered|already exists/.test(lower)) {
    return SOROBAN_ERRORS.ALREADY_REGISTERED;
  }
  if (/song.*not.*found|unknown song/.test(lower)) {
    return SOROBAN_ERRORS.SONG_NOT_FOUND;
  }
  if (/metadata.*not.*ready|still.*processing|pin/.test(lower)) {
    return SOROBAN_ERRORS.METADATA_NOT_READY;
  }
  if (/already.*mint/.test(lower)) {
    return SOROBAN_ERRORS.SONG_ALREADY_MINTED;
  }
  if (/signature|bad.*auth|unauthorized/.test(lower)) {
    return SOROBAN_ERRORS.INVALID_SIGNATURE;
  }
  if (/fee|insufficient.*resource|denied/.test(lower)) {
    return SOROBAN_ERRORS.INSUFFICIENT_FEE;
  }
  if (/sequence|bad.?seq/.test(lower)) {
    return SOROBAN_ERRORS.SEQUENCE_MISMATCH;
  }
  if (/timeout|timed.?out/.test(lower)) {
    return SOROBAN_ERRORS.REQUEST_TIMEOUT;
  }
  if (/network|rpc|horizon|unreachable/.test(lower)) {
    return SOROBAN_ERRORS.NETWORK_ERROR;
  }
  return SOROBAN_ERRORS.UNKNOWN;
}

/**
 * Safe stringification of an unknown error for the matcher.
 */
function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}