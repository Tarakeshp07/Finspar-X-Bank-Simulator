import geoip from 'geoip-lite';

/**
 * Offline IP -> geo resolution for the fraud gateway. Uses the bundled MaxMind
 * GeoLite2 data (in-process, no network call, sub-millisecond) so it is safe on
 * the login/payment path.
 *
 * The client's real country is what feeds the model's `f_user_new_country`
 * signal — a login/payment from a country the user has never used is a genuine
 * account-takeover signal (a VPN's exit country flowing through is the feature
 * working, not a bug). Private/loopback IPs (dev, unproxied) resolve to null.
 */

/** Normalise Express's ip (may be IPv4-mapped IPv6 like `::ffff:1.2.3.4`). */
function normalizeIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export interface GeoResult {
  country?: string; // ISO alpha-2
  lat?: number;
  lon?: number;
}

/** Resolve country + lat/lon from an IP. Returns {} for private/loopback/unknown. */
export function geoFromIp(ip?: string): GeoResult {
  const clean = normalizeIp(ip);
  if (!clean) return {};
  const hit = geoip.lookup(clean);
  if (!hit) return {};
  return { country: hit.country, lat: hit.ll?.[0], lon: hit.ll?.[1] };
}

/** Convenience: just the country (ISO alpha-2), or undefined. */
export function countryFromIp(ip?: string): string | undefined {
  return geoFromIp(ip).country;
}
