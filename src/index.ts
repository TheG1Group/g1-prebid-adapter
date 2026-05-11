/**
 * `@theg1team/prebid-adapter` — Prebid.js bidder adapter для g1.network SSP.
 *
 * Implements Prebid 9.x `BidderSpec`. Browser-target, ES2020. No `@theg1team/*`
 * internal deps (external publishers consume this directly).
 *
 * Usage:
 *   import { g1NetworkBidAdapter } from "@theg1team/prebid-adapter";
 *   import { registerBidder } from "prebid.js/src/adapters/bidderFactory.js";
 *   registerBidder(g1NetworkBidAdapter);
 */

import type {
	AdRequestPayload,
	AdResponse,
	BidRequest,
	BidderRequest,
	BidderSpec,
	InterpretedBid,
	MediaType,
	ServerRequest,
	UserSync,
	UserSyncOptions,
} from "./types.js";

export const BIDDER_CODE = "g1network";
export const AD_REQUEST_URL = "https://ssp-api.g1.network/ad-request";
export const SUPPORTED_MEDIA_TYPES: MediaType[] = ["banner"];
export const DEFAULT_TTL = 300;
export const DEFAULT_CURRENCY = "USD";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(s: unknown): s is string {
	return typeof s === "string" && UUID_RE.test(s);
}

/** Type-narrow helper for `bid.params`. */
export function isBidRequestValid(bid: BidRequest): boolean {
	const p = bid?.params;
	if (!p) return false;
	if (!isValidUuid(p.publisher_id)) return false;
	if (!isValidUuid(p.ad_unit_id)) return false;
	return true;
}

/** Build the outbound POST request payload from collected Prebid bids. */
export function buildRequests(
	validBidRequests: BidRequest[],
	bidderRequest: BidderRequest,
): ServerRequest[] {
	const pageUrl =
		bidderRequest?.refererInfo?.page ?? bidderRequest?.refererInfo?.topmostLocation ?? "";
	const pageRef = bidderRequest?.refererInfo?.ref;
	const tcString = bidderRequest?.gdprConsent?.consentString;
	const gppString = bidderRequest?.gppConsent?.gppString;
	const gppSid = bidderRequest?.gppConsent?.applicableSections;
	const uid2 = extractUid2Token(bidderRequest);

	return validBidRequests.map((bid) => {
		const payload: AdRequestPayload = {
			property_id: bid.params.publisher_id,
			ad_unit_slug: bid.params.ad_unit_id,
			page_url: pageUrl,
			page_ref: pageRef,
			tc_string: tcString,
			gpp_string: gppString,
			gpp_sid: gppSid,
			uid2_token: uid2,
			test_mode: bid.params.test_mode,
			prebid_bid_id: bid.bidId,
			mediaTypes: bid.mediaTypes,
			floor_cpm: bid.params.floor_cpm,
		};
		return {
			method: "POST",
			url: AD_REQUEST_URL,
			data: payload,
			options: { contentType: "application/json", withCredentials: false },
		};
	});
}

function extractUid2Token(bidderRequest: BidderRequest): string | undefined {
	const eids = bidderRequest?.userIdAsEids ?? [];
	const uid2Entry = eids.find((e) => e?.source === "uidapi.com");
	const uid2Id = uid2Entry?.uids?.[0]?.id;
	return typeof uid2Id === "string" ? uid2Id : undefined;
}

/** Translate ssp-api response → Prebid InterpretedBid[]. */
export function interpretResponse(
	serverResponse: { body: unknown },
	request: ServerRequest,
): InterpretedBid[] {
	const body = serverResponse?.body as AdResponse | undefined;
	if (!body || !body.ok || !Array.isArray(body.bids) || body.bids.length === 0) return [];

	const requestData = request?.data as AdRequestPayload | undefined;
	const requestId = requestData?.prebid_bid_id;
	if (!requestId) return [];

	return body.bids.map((b) => ({
		requestId,
		cpm: b.cpm,
		currency: b.currency ?? DEFAULT_CURRENCY,
		width: b.w,
		height: b.h,
		creativeId: b.creative_id,
		ad: `<iframe src="${b.creative_url}" width="${b.w}" height="${b.h}" frameborder="0" scrolling="no"></iframe>`,
		mediaType: b.mtype,
		ttl: DEFAULT_TTL,
		netRevenue: true,
		dealId: b.dealid,
		meta: {
			advertiserDomains: b.adomain,
			mediaType: b.mtype,
		},
	}));
}

/** Surface SSP-supplied user sync URLs to Prebid. */
export function getUserSyncs(
	syncOptions: UserSyncOptions,
	responses?: Array<{ body: unknown }>,
): UserSync[] {
	if (!syncOptions?.pixelEnabled && !syncOptions?.iframeEnabled) return [];
	const out: UserSync[] = [];
	for (const r of responses ?? []) {
		const body = r?.body as AdResponse | undefined;
		const sync = body?.sync_urls;
		if (!sync) continue;
		if (syncOptions.pixelEnabled) {
			for (const url of sync.pixel ?? []) out.push({ type: "image", url });
		}
		if (syncOptions.iframeEnabled) {
			for (const url of sync.iframe ?? []) out.push({ type: "iframe", url });
		}
	}
	return out;
}

/** Optional telemetry beacon — fired by Prebid после the bid wins. */
export function onBidWon(_bid: InterpretedBid & { adId?: string }): void {
	// Phase 2 TODO: GET https://adserver.g1.network/pixel/<imp_id> (no-op fallback
	// when navigator.sendBeacon unavailable). Already covered by the SafeFrame
	// shell embedded pixel в the served ad, so this is best-effort secondary.
}

export const g1NetworkBidAdapter: BidderSpec = {
	code: BIDDER_CODE,
	supportedMediaTypes: SUPPORTED_MEDIA_TYPES,
	isBidRequestValid,
	buildRequests,
	interpretResponse,
	getUserSyncs,
	onBidWon,
};

export default g1NetworkBidAdapter;
