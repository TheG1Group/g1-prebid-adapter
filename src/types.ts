/**
 * Minimal local types matching Prebid.js 9.x `BidderSpec` interface.
 *
 * No dependency on `@types/prebid.js` (community types are outdated и often
 * mismatch current Prebid runtime). Pinning local types keeps the adapter
 * stable against upstream type churn.
 */

export type MediaType = "banner" | "video" | "native" | "audio";

export interface AdUnitParams {
	publisher_id: string;
	ad_unit_id: string;
	floor_cpm?: number;
	test_mode?: boolean;
}

export interface BidRequest {
	bidder: string;
	bidId: string;
	adUnitCode: string;
	transactionId?: string;
	auctionId?: string;
	mediaTypes: Partial<Record<MediaType, unknown>>;
	params: AdUnitParams;
}

export interface BidderRequest {
	auctionId?: string;
	timeout?: number;
	refererInfo?: { page?: string; ref?: string; topmostLocation?: string };
	gdprConsent?: { consentString?: string; gdprApplies?: boolean };
	gppConsent?: { gppString?: string; applicableSections?: number[] };
	uspConsent?: string;
	userIdAsEids?: Array<{ source: string; uids: Array<{ id: string; atype?: number }> }>;
}

export interface ServerRequest {
	method: "POST";
	url: string;
	data: unknown;
	options?: { contentType?: string; withCredentials?: boolean };
}

export interface InterpretedBid {
	requestId: string;
	cpm: number;
	currency: string;
	width: number;
	height: number;
	creativeId: string;
	ad?: string;
	vastXml?: string;
	mediaType: MediaType;
	ttl: number;
	netRevenue: boolean;
	dealId?: string;
	meta?: {
		advertiserDomains?: string[];
		mediaType?: MediaType;
		[key: string]: unknown;
	};
}

export interface UserSyncOptions {
	pixelEnabled?: boolean;
	iframeEnabled?: boolean;
}

export interface UserSync {
	type: "image" | "iframe";
	url: string;
}

export interface BidderSpec {
	code: string;
	supportedMediaTypes: MediaType[];
	isBidRequestValid(bid: BidRequest): boolean;
	buildRequests(
		validBidRequests: BidRequest[],
		bidderRequest: BidderRequest,
	): ServerRequest | ServerRequest[];
	interpretResponse(serverResponse: { body: unknown }, request: ServerRequest): InterpretedBid[];
	getUserSyncs?(syncOptions: UserSyncOptions, responses?: Array<{ body: unknown }>): UserSync[];
	onBidWon?(bid: InterpretedBid & { adId?: string }): void;
}

// ── Wire types для ssp-api.g1.network/ad-request ────────────────────

export interface AdRequestPayload {
	property_id: string;
	ad_unit_slug: string;
	page_url: string;
	page_ref?: string;
	tc_string?: string;
	gpp_string?: string;
	gpp_sid?: number[];
	uid2_token?: string;
	test_mode?: boolean;
	prebid_bid_id?: string;
	mediaTypes?: Partial<Record<MediaType, unknown>>;
	floor_cpm?: number;
}

export interface AdResponseBid {
	bid_id: string;
	cpm: number;
	currency: string;
	w: number;
	h: number;
	creative_id: string;
	creative_url: string;
	dealid?: string;
	mtype: MediaType;
	adomain?: string[];
}

export interface AdResponse {
	ok: boolean;
	request_id: string;
	bids: AdResponseBid[];
	sync_urls?: { pixel?: string[]; iframe?: string[] };
}
