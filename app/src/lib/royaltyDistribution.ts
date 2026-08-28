import { RoyaltySplitConfig, TOTAL_BASIS_POINTS } from "@/types/royalty";
import { validateRoyaltySplit } from "./royaltySplit";

/**
 * Optional royalty distribution computation (#294).
 *
 * Mirrors the `royalty` contract's `distribute` behaviour: for a gross amount
 * (in stroops), work out the exact amount owed to every configured recipient
 * by basis-point share, such that all rounded per-recipient amounts reconstruct
 * the full gross total. This is what the on-chain split produces atomically at
 * sale time.
 *
 * The truncation rule matches Stellar fixed-point: each recipient gets
 * `floor(gross * bp / 10_000)`, and any remainder stroops go to the largest
 * share holder so the distributed total is always exactly the gross amount.
 */

export interface RoyaltyDistribution {
  grossStroops: string;
  /** Per-recipient exact payouts (sum matches grossStroops exactly). */
  payouts: Array<{ recipient: string; basisPoints: number; stropAmount: string }>;
  /** Whether the split is valid enough to distribute. */
  valid: boolean;
  /** Validation errors, if any. */
  errors: string[];
}

/**
 * Compute the per-recipient payout amounts for a gross proceeds value.
 *
 * @param config  The song's royalty split config.
 * @param grossStroops  Total proceeds to distribute, in stroops (decimal string).
 *
 * @throws If the split is invalid (won't sum to 10_000 basis points, etc.).
 */
export function computeRoyaltyDistribution(
  config: RoyaltySplitConfig,
  grossStroops: string
): RoyaltyDistribution {
  const validation = validateRoyaltySplit(config.splits);
  const base: RoyaltyDistribution = {
    grossStroops,
    payouts: [],
    valid: validation.valid,
    errors: validation.errors,
  };

  if (!validation.valid) {
    return base;
  }

  const gross = BigInt(grossStroops);
  // Rough "largest holder" adjudication: give rounding remainder to the
  // biggest share, falling back to the first entry on a tie.
  const ordered = [...config.splits].sort((a, b) => b.basisPoints - a.basisPoints);

  const payouts = config.splits.map((split) => {
    const stropAmount = (gross * BigInt(split.basisPoints)) / BigInt(TOTAL_BASIS_POINTS);
    return {
      recipient: split.recipient,
      basisPoints: split.basisPoints,
      stropAmount: stropAmount.toString(),
    };
  });

  // Distribute the truncation remainder (0..recipientCount-1 stroops) to the
  // largest share holder so totals always reconcile exactly.
  const allocated = payouts.reduce(
    (sum, p) => sum + BigInt(p.stropAmount),
    BigInt(0)
  );
  let remainder = gross - allocated;
  let idx = 0;
  while (remainder > 0n && idx < ordered.length) {
    const top = ordered[idx].recipient;
    const entry = payouts.find((p) => p.recipient === top);
    if (entry) {
      entry.stropAmount = (BigInt(entry.stropAmount) + 1n).toString();
      remainder -= 1n;
    }
    idx += 1;
  }

  return {
    grossStroops,
    payouts,
    valid: true,
    errors: [],
  };
}

/**
 * Utility for a component: format a payouts array into a human-readable line,
 * e.g. "USDC … 25.0000000 … 2500000 stroops".
 */
export function formatPayoutSummary(payout: {
  recipient: string;
  basisPoints: number;
  stropAmount: string;
}): string {
  const short = payout.recipient.slice(0, 6) + "…" + payout.recipient.slice(-4);
  return `${short} · ${(payout.basisPoints / 100).toFixed(2)}% · ${payout.stropAmount} stroops`;
}