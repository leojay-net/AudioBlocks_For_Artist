# Analytics Events

`src/lib/analytics.ts` is a thin façade over a Segment-compatible
`window.analytics.track` call. It exists so the rest of the codebase never
talks to a specific analytics provider directly — swap the implementation of
`send()` in one place (a different provider, batching, sampling, etc.) and
every call site is unaffected.

## Enabling / disabling

Every call is a no-op unless both of the following are true:

- `NEXT_PUBLIC_ANALYTICS_WRITE_KEY` is set.
- `window.analytics.track` exists (i.e. a Segment-compatible snippet — such
  as Segment, PostHog, or Mixpanel's Segment-compat mode — has been loaded
  on the page).

This keeps local dev and the test environment quiet by default: no env var,
no network calls, no noise in `vitest` runs.

## Tracked events

All events are typed in `src/lib/analytics.ts` (`EventName`); there is no
untyped/free-form `track()` escape hatch, so every event below is exhaustive.

| Event              | Properties                                            | Fired from                                                                                     |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `upload_started`   | `fileId`, `fileName`, `fileSizeBytes`                 | `src/components/musicUpload/Song.tsx` — when a song file upload begins                          |
| `upload_completed` | `fileId`, `songId`, `durationMs`                      | `src/components/musicUpload/Song.tsx` — when the chunked upload + finalize call succeeds        |
| `upload_failed`    | `fileId`, `reason`                                    | `src/components/musicUpload/Song.tsx` — when any step of the upload pipeline throws              |
| `mint_started`     | `songId`, `walletAddress`                             | `MintSongButton.tsx` (song mint) and `SetupArtistOnChainProfile.tsx` (profile mint, `songId: "artist-profile"`) — when the Freighter sign request is sent |
| `mint_succeeded`   | `songId`, `txHash`, `tokenId`                         | Same two components, once the signed transaction is submitted and the backend returns a token ID |
| `mint_failed`      | `songId`, `reason`                                    | Same two components — covers both a rejected Freighter signature (`reason: "user rejected signature"`) and any other submit/backend failure |
| `profile_saved`    | `hasImage`, `hasWebsite`, `hasTwitter`                | `src/app/dashboard/profile/page.tsx` — when the artist saves profile edits                       |

Note that `mint_started` / `mint_succeeded` / `mint_failed` are shared
between song minting and artist-profile minting (same on-chain
prepare → sign → submit pattern, see `app/README.md`'s
[On-Chain Integration](../../README.md#on-chain-integration-freighter--soroban)
section) — `songId` is the literal string `"artist-profile"` for the
profile-mint case rather than a real song ID.

## Adding a new event

1. Add the event's string literal to the `EventName` union in
   `src/lib/analytics.ts`.
2. Add a typed helper to the `analytics` export (name it after the event,
   camelCased, e.g. `mint_started` → `mintStarted`) with a props type
   matching what you actually need on the receiving end.
3. Call the new helper from the component/service that triggers the event —
   do not call `send()` directly from outside `analytics.ts`.
4. Document it in the table above.

## Testing

Because `send()` no-ops without `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`, tests
don't need to mock a real analytics provider — asserting on
`window.analytics.track` calls requires setting the env var and stubbing
`window.analytics` in the test itself if you need to verify a specific event
fires; most existing tests don't bother and just verify the triggering
behavior (upload succeeds, mint succeeds, etc.).
