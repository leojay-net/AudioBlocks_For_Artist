# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- IPFS metadata viewer for minted songs (#287).
- Specific Soroban contract error codes with user-friendly messages (#288).
- Automatic on-chain royalty distribution via smart contracts (#294).

## [0.1.0] - 2026-08-28

### Added
- Initial artist-focused dashboard for AudioBlocks on Stellar.
- Music upload flow with metadata capture.
- Royalty split configuration UI and client-side validation (#286).
- Freighter wallet integration and Horizon helper library.
- Multilingual support (English / Spanish) via i18n locale files.
- Storybook component library and Playwright e2e harness.

### Changed
- Moved from a single Next.js app to a structured `app/` workspace.

### Fixed
- Client-side royalty split validation to mirror on-chain invariants.