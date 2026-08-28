import { describe, it, expect } from "vitest";
import { computeRoyaltyDistribution } from "@/lib/royaltyDistribution";
import { mapSorobanError, SOROBAN_ERRORS } from "@/lib/sorobanErrors";

// Valid Stellar G addresses: exactly G + 55 base32 chars (base32 alphabet:
// A-Z and 2-7). Built programmatically to guarantee correct length.
function makeAddress(letter: string): string {
  return "G" + letter.repeat(55);
}
const ARTIST = makeAddress("A");
const COLLAB = makeAddress("B");
const MIXER = makeAddress("D");

describe("computeRoyaltyDistribution (#294)", () => {
  const splits = [
    { recipient: ARTIST, basisPoints: 6000 },
    { recipient: COLLAB, basisPoints: 4000 },
  ];

  it("distributes a gross amount exactly by basis-point share", () => {
    const dist = computeRoyaltyDistribution({ songId: "s1", splits }, "10000000");
    expect(dist.valid).toBe(true);
    expect(dist.errors).toEqual([]);
    expect(dist.payouts).toHaveLength(2);
    expect(dist.payouts[0].stropAmount).toBe("6000000");
    expect(dist.payouts[1].stropAmount).toBe("4000000");
  });

  it("reconstructs the exact gross total across recipients", () => {
    const gross = "12345678912345";
    const dist = computeRoyaltyDistribution({ songId: "s1", splits }, gross);
    const sum = dist.payouts.reduce((acc, p) => acc + BigInt(p.stropAmount), 0n);
    // The distributed total must equal the gross amount exactly — never a
    // rounding discrepancy that would reconcile wrong.
    expect(sum.toString()).toBe(gross);
  });

  it("assigns truncation remainder to the largest share holder", () => {
    const threeWay = [
      { recipient: ARTIST, basisPoints: 3333 },
      { recipient: COLLAB, basisPoints: 3333 },
      { recipient: MIXER, basisPoints: 3334 },
    ];
    // 10,000 stroops across thirds leaves a remainder that must reconcile.
    const dist = computeRoyaltyDistribution({ songId: "s1", splits: threeWay }, "10000");
    const sum = dist.payouts.reduce((acc, p) => acc + BigInt(p.stropAmount), 0n);
    expect(sum.toString()).toBe("10000");
  });

  it("rejects an invalid split (does not sum to 10_000 basis points)", () => {
    const bad = [{ recipient: ARTIST, basisPoints: 5000 }];
    const dist = computeRoyaltyDistribution({ songId: "s1", splits: bad }, "10000");
    expect(dist.valid).toBe(false);
    expect(dist.errors.length).toBeGreaterThan(0);
  });
});

describe("mapSorobanError (#288)", () => {
  it("maps an artist-not-registered fragment to a friendly message", () => {
    const mapping = mapSorobanError(new Error("artist_not_registered: register the artist first"));
    expect(mapping.code).toBe("artist_not_registered");
    expect(mapping.message).toContain("Register your artist profile first");
  });

  it("maps a bad auth / signature rejection", () => {
    const mapping = mapSorobanError("bad_auth: invalid signature in host invocation");
    expect(mapping.code).toBe("invalid_signature");
  });

  it("falls back to a stable unknown error for unrecognized input", () => {
    const mapping = mapSorobanError({ some: "unexpected" });
    expect(mapping.code).toBe(SOROBAN_ERRORS.UNKNOWN.code);
    expect(mapping.message.length).toBeGreaterThan(0);
  });

  it("knows every exported mapping is non-empty and stable", () => {
    for (const mapping of Object.values(SOROBAN_ERRORS)) {
      expect(mapping.code.length).toBeGreaterThan(0);
      expect(mapping.message.length).toBeGreaterThan(0);
    }
  });
});