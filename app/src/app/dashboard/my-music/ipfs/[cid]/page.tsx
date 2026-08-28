"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/**
 * IPFS metadata viewer for minted songs (#287).
 *
 * Displays the JSON metadata CID (or ipfs:// URI) for a minted song by
 * resolving it through a public IPFS gateway. Shows the raw metadata fields
 * plus an error state when the CDN cannot resolve the CID.
 */

interface IpfsMetadata {
  name?: string;
  description?: string;
  image?: string;
  artist?: string;
  animation_url?: string;
  attributes?: Array<{ trait_type?: string; value?: unknown }>;
  [key: string]: unknown;
}

// IPFS gateways tried in order; the first to resolve wins.
const GATEWAYS = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
];

/** Normalise an ipfs:// URI or bare CID into a CID string. */
function normalizeCid(input: string): string {
  if (input.startsWith("ipfs://")) return input.slice("ipfs://".length).split("/")[0];
  return input.split("/")[0];
}

export default function IpfsMetadataViewerPage() {
  const { cid } = useParams<{ cid: string }>();
  const [metadata, setMetadata] = useState<IpfsMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cid) return;
    const normalized = normalizeCid(cid);

    async function fetchMetadata() {
      for (const gateway of GATEWAYS) {
        try {
          const res = await fetch(gateway(normalized));
          if (!res.ok) continue;
          const json = (await res.json()) as IpfsMetadata;
          setMetadata(json);
          setError(null);
          return;
        } catch {
          // Try the next gateway.
        }
      }
      setError(
        `Unable to resolve metadata for IPFS CID \`${normalized}\`. It may still be propagating across the network.`,
      );
    }

    fetchMetadata().finally(() => setLoading(false));
  }, [cid]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard/my-music"
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to My Music
        </Link>
        <h1 className="mb-1 text-2xl font-semibold">IPFS Metadata</h1>
        <p className="mb-6 font-mono text-sm text-gray-500">CID: {cid}</p>

        {loading && <p className="text-gray-500">Loading metadata from IPFS…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {metadata && !loading && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {metadata.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metadata.image}
                alt={metadata.name ?? "Song cover"}
                className="h-48 w-full object-cover"
              />
            )}
            <div className="space-y-3 p-6">
              <h2 className="text-xl font-semibold">{metadata.name ?? "Untitled"}</h2>
              {metadata.artist && (
                <p className="text-sm text-gray-600">Artist: {metadata.artist}</p>
              )}
              {metadata.description && (
                <p className="text-sm text-gray-600">{metadata.description}</p>
              )}
              {metadata.animation_url && (
                <a
                  href={metadata.animation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:underline"
                >
                  Play / stream audio
                </a>
              )}
              {metadata.attributes && metadata.attributes.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">Attributes</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {metadata.attributes.map((attr, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-gray-200 px-3 py-2 text-xs text-gray-700"
                      >
                        <span className="block font-medium">{attr.trait_type}</span>
                        <span>{String(attr.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <pre className="mt-4 max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}