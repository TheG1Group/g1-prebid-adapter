# @theg1team/prebid-adapter

Prebid.js bidder adapter для **g1.network SSP**. OSS MIT.

Plug into your existing Prebid wrapper as a custom adapter and bid against g1.network publishers' programmatic inventory.

## Install

```bash
npm install @theg1team/prebid-adapter
# or via CDN (auto-mirrored to jsDelivr/unpkg from oss.g1.network):
# https://cdn.jsdelivr.net/npm/@theg1team/prebid-adapter@latest/dist/index.js
# https://unpkg.com/@theg1team/prebid-adapter@latest/dist/index.js
```

## Register с Prebid

```javascript
import { g1NetworkBidAdapter } from "@theg1team/prebid-adapter";
import { registerBidder } from "prebid.js/src/adapters/bidderFactory.js";

registerBidder(g1NetworkBidAdapter);
```

## Ad-unit config

```javascript
pbjs.addAdUnits({
	code: "div-1",
	mediaTypes: { banner: { sizes: [[300, 250], [728, 90]] } },
	bids: [{
		bidder: "g1network",
		params: {
			publisher_id: "550e8400-e29b-41d4-a716-446655440000",
			ad_unit_id: "550e8400-e29b-41d4-a716-446655440001",
			// optional:
			// floor_cpm: 0.5,
			// test_mode: false,
		},
	}],
});
```

## Supported media types

- `banner` — IAB sizes (300×250, 320×50, 728×90, 300×600, 970×250, и др. per FINAL-PLAN §21)
- `video` — VAST 4.x (Phase 8 deliverable)
- `native` — IAB v1.2 (Phase 9 deliverable)

## Endpoint

POST `https://ssp-api.g1.network/ad-request`. Carries TC string (GDPR consent), GPP string (US/multi-jurisdiction), UID2 token (Phase 3+), test_mode flag.

## Compliance

- TCF v2.2 + GPP USNAT respected.
- ads.txt declares `g1.network, <publisher_id>, DIRECT`.
- sellers.json entry для each registered publisher via `ssp-api.g1.network/sellers.json`.

## Listing

- Published on Prebid official adapters list per FINAL-PLAN §3 Phase 2.
- Hosted at https://oss.g1.network/prebid-adapter + npm + jsDelivr/unpkg auto-mirror.

## Version policy

SemVer. Breaking change = major bump + 12mo deprecation notice (per FINAL-PLAN §5 engineering standards).

## License

MIT — see [LICENSE](LICENSE).
