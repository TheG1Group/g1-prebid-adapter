# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Project context:** part of g1.network ad-tech build per `g1-adtech-plan/FINAL-PLAN.md`. Phase 2 deliverable: OSS MIT npm package published to npm + Prebid official adapters list + jsDelivr/unpkg auto-mirror.

## Project Overview

Single npm package — no monorepo. Ships as ESM + CJS + .d.ts типы. Browser-target (no Node.js APIs).

## Architecture

- **Source**: `src/index.ts` exports `g1NetworkBidAdapter: BidderSpec`.
- **Types**: `src/types.ts` — minimal local types matching Prebid.js BidderSpec interface (Prebid 9.x). No `@types/prebid.js` dependency (community types outdated).
- **Build**: tsup → `dist/index.js` (ESM) + `dist/index.cjs` (CJS) + `dist/index.d.ts`.
- **Test**: vitest happy-path + invariant tests (no Prebid runtime needed — pure adapter logic).
- **Endpoint**: POST `https://ssp-api.g1.network/ad-request` (g1-ssp/ssp-api worker).
- **Telemetry**: optional `onBidWon` callback emits beacon к `adserver.g1.network/pixel/<imp_id>`.

## Engineering standards (FINAL-PLAN §2)

- **MIT license** (OSS).
- **No `@theg1team/*` internal package deps** — this is an external-publisher-facing artifact. Self-contained, no GH Packages auth required для consumers.
- **Browser-only target**: ES2020, `lib: ["ES2020", "DOM"]`. No Node `fs`/`path`/etc.
- **TypeScript strict**.
- **SemVer + 12mo deprecation** для breaking changes (FINAL-PLAN §5 SDK versioning policy).
- **`@source` directive не нужен** (no Tailwind / no React components — pure adapter).

## BidderSpec contract (Prebid 9.x)

- `code`: "g1network"
- `supportedMediaTypes`: ["banner"] initially; ["video"] Phase 8; ["native"] Phase 9
- `isBidRequestValid(bid)`: requires `bid.params.publisher_id` UUID + `bid.params.ad_unit_id` UUID
- `buildRequests(validBidRequests, bidderRequest)`: POST к ssp-api.g1.network/ad-request
- `interpretResponse(serverResponse, request)`: parse → Prebid Bid[]
- `getUserSyncs(syncOptions, ...)`: пixel + iframe sync (Phase 7+ identity)
- `onBidWon(bid)`: optional beacon к adserver.g1.network/pixel/<imp_id>

## Don't

- Don't add `@theg1team/*` workspace dependencies — keep self-contained for external publishers.
- Don't depend на Node-only APIs (`fs`, `path`, `crypto.subtle` only via WebCrypto).
- Don't ship adapter без TCF v2.2 + GPP support (regulatory hard requirement).
- Don't fetch sync URLs synchronously — use Prebid's `getUserSyncs` callback.
- Don't break SemVer minor bumps — adapter is consumed by publishers' Prebid wrappers.

## Publish flow

1. `pnpm typecheck && pnpm lint && pnpm test` — verify locally.
2. `pnpm version <patch|minor|major>` — bump.
3. `git push --tags` → GitHub Actions release workflow runs `pnpm publish` к npmjs.org.
4. jsDelivr + unpkg auto-mirror within 1-5 min.
5. Apply к Prebid official adapters list (one-off PR per Phase 2 §3).

## Verification

Before commit: `pnpm typecheck && pnpm lint && pnpm test`.
