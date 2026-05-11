import { describe, expect, it } from "vitest";
import {
	AD_REQUEST_URL,
	BIDDER_CODE,
	buildRequests,
	g1NetworkBidAdapter,
	getUserSyncs,
	interpretResponse,
	isBidRequestValid,
	isValidUuid,
} from "./index.js";
import type { AdResponse, BidRequest, BidderRequest, ServerRequest } from "./types.js";

const VALID_PUB = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UNIT = "550e8400-e29b-41d4-a716-446655440001";

function makeBid(overrides: Partial<BidRequest> = {}): BidRequest {
	return {
		bidder: "g1network",
		bidId: "bid-1",
		adUnitCode: "div-1",
		mediaTypes: { banner: { sizes: [[300, 250]] } },
		params: { publisher_id: VALID_PUB, ad_unit_id: VALID_UNIT },
		...overrides,
	};
}

describe("isValidUuid", () => {
	it("accepts canonical UUID v4", () => {
		expect(isValidUuid(VALID_PUB)).toBe(true);
	});
	it("rejects non-string", () => {
		expect(isValidUuid(123)).toBe(false);
		expect(isValidUuid(null)).toBe(false);
		expect(isValidUuid(undefined)).toBe(false);
	});
	it("rejects malformed", () => {
		expect(isValidUuid("not-uuid")).toBe(false);
		expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
	});
});

describe("isBidRequestValid", () => {
	it("accepts valid bid request", () => {
		expect(isBidRequestValid(makeBid())).toBe(true);
	});
	it("rejects missing publisher_id", () => {
		const b = makeBid();
		// biome-ignore lint/suspicious/noExplicitAny: shim
		(b.params as any).publisher_id = undefined;
		expect(isBidRequestValid(b)).toBe(false);
	});
	it("rejects malformed ad_unit_id", () => {
		expect(
			isBidRequestValid(makeBid({ params: { publisher_id: VALID_PUB, ad_unit_id: "x" } })),
		).toBe(false);
	});
	it("rejects bid с no params object", () => {
		// biome-ignore lint/suspicious/noExplicitAny: shim
		expect(isBidRequestValid({ bidder: "g1network", bidId: "1" } as any)).toBe(false);
	});
});

describe("buildRequests", () => {
	const bidderReq: BidderRequest = {
		refererInfo: { page: "https://review.g1.network/article/1", ref: "https://google.com/" },
		gdprConsent: { consentString: "CPxxx.YAAAAAAAAA", gdprApplies: true },
		gppConsent: { gppString: "DBABL~BVQqAAAAAgA.QA", applicableSections: [7] },
	};

	it("builds 1 POST request per valid bid", () => {
		const out = buildRequests([makeBid()], bidderReq);
		expect(out).toHaveLength(1);
		const [req] = out;
		if (!req) throw new Error("missing request");
		expect(req.method).toBe("POST");
		expect(req.url).toBe(AD_REQUEST_URL);
		const data = req.data as { property_id: string; ad_unit_slug: string };
		expect(data.property_id).toBe(VALID_PUB);
		expect(data.ad_unit_slug).toBe(VALID_UNIT);
	});

	it("propagates TCF + GPP + page context", () => {
		const [req] = buildRequests([makeBid()], bidderReq);
		if (!req) throw new Error("missing request");
		const data = req.data as {
			tc_string: string;
			gpp_string: string;
			gpp_sid: number[];
			page_url: string;
			page_ref: string;
		};
		expect(data.tc_string).toBe("CPxxx.YAAAAAAAAA");
		expect(data.gpp_string).toBe("DBABL~BVQqAAAAAgA.QA");
		expect(data.gpp_sid).toEqual([7]);
		expect(data.page_url).toBe("https://review.g1.network/article/1");
		expect(data.page_ref).toBe("https://google.com/");
	});

	it("extracts UID2 token from userIdAsEids (uidapi.com source)", () => {
		const [req] = buildRequests([makeBid()], {
			...bidderReq,
			userIdAsEids: [
				{ source: "id5-sync.com", uids: [{ id: "id5-zzz" }] },
				{ source: "uidapi.com", uids: [{ id: "uid2-abc...", atype: 3 }] },
			],
		});
		if (!req) throw new Error("missing request");
		const data = req.data as { uid2_token: string };
		expect(data.uid2_token).toBe("uid2-abc...");
	});

	it("emits N requests для N valid bids", () => {
		const out = buildRequests([makeBid({ bidId: "a" }), makeBid({ bidId: "b" })], bidderReq);
		expect(out).toHaveLength(2);
	});
});

describe("interpretResponse", () => {
	const stubRequest: ServerRequest = {
		method: "POST",
		url: AD_REQUEST_URL,
		data: {
			property_id: VALID_PUB,
			ad_unit_slug: VALID_UNIT,
			page_url: "https://x.com",
			prebid_bid_id: "bid-1",
		},
	};

	it("returns empty array на ok=false", () => {
		const out = interpretResponse(
			{ body: { ok: false, request_id: "x", bids: [] } satisfies AdResponse },
			stubRequest,
		);
		expect(out).toEqual([]);
	});

	it("returns empty array на empty bids[]", () => {
		const out = interpretResponse(
			{ body: { ok: true, request_id: "x", bids: [] } satisfies AdResponse },
			stubRequest,
		);
		expect(out).toEqual([]);
	});

	it("converts AdResponse bid → Prebid InterpretedBid", () => {
		const body: AdResponse = {
			ok: true,
			request_id: "req-1",
			bids: [
				{
					bid_id: "bid-srv",
					cpm: 2.5,
					currency: "USD",
					w: 300,
					h: 250,
					creative_id: "creative-42",
					creative_url: "https://adserver.g1.network/serve/abc?imp=imp-1",
					mtype: "banner",
					adomain: ["jrpass.com"],
				},
			],
		};
		const out = interpretResponse({ body }, stubRequest);
		expect(out).toHaveLength(1);
		const [ib] = out;
		if (!ib) throw new Error("missing interpreted bid");
		expect(ib.requestId).toBe("bid-1");
		expect(ib.cpm).toBe(2.5);
		expect(ib.currency).toBe("USD");
		expect(ib.width).toBe(300);
		expect(ib.height).toBe(250);
		expect(ib.creativeId).toBe("creative-42");
		expect(ib.mediaType).toBe("banner");
		expect(ib.ttl).toBe(300);
		expect(ib.netRevenue).toBe(true);
		expect(ib.meta?.advertiserDomains).toEqual(["jrpass.com"]);
		expect(ib.ad).toContain("iframe");
	});
});

describe("getUserSyncs", () => {
	const body: AdResponse = {
		ok: true,
		request_id: "x",
		bids: [],
		sync_urls: {
			pixel: ["https://ssp-api.g1.network/sync/pixel/uid2"],
			iframe: ["https://ssp-api.g1.network/sync/iframe/topics"],
		},
	};

	it("returns no syncs when both options disabled", () => {
		expect(getUserSyncs({}, [{ body }])).toEqual([]);
	});
	it("returns pixel syncs when pixelEnabled", () => {
		const out = getUserSyncs({ pixelEnabled: true }, [{ body }]);
		expect(out).toEqual([{ type: "image", url: "https://ssp-api.g1.network/sync/pixel/uid2" }]);
	});
	it("returns iframe syncs when iframeEnabled", () => {
		const out = getUserSyncs({ iframeEnabled: true }, [{ body }]);
		expect(out).toEqual([{ type: "iframe", url: "https://ssp-api.g1.network/sync/iframe/topics" }]);
	});
	it("returns both когда both enabled", () => {
		expect(getUserSyncs({ pixelEnabled: true, iframeEnabled: true }, [{ body }])).toHaveLength(2);
	});
});

describe("g1NetworkBidAdapter (BidderSpec export)", () => {
	it("exposes canonical code + supportedMediaTypes", () => {
		expect(g1NetworkBidAdapter.code).toBe(BIDDER_CODE);
		expect(g1NetworkBidAdapter.code).toBe("g1network");
		expect(g1NetworkBidAdapter.supportedMediaTypes).toContain("banner");
	});

	it("default export equals named export", async () => {
		const mod = await import("./index.js");
		expect(mod.default).toBe(mod.g1NetworkBidAdapter);
	});
});
