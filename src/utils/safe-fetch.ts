import { lookup } from 'dns/promises';
import { isIP } from 'net';

// Maximum number of redirects we'll follow before bailing out.
const MAX_REDIRECTS = 3;

// IPv4 ranges that must never be the target of a server-side fetch.
// Each entry is [start, end] inclusive, encoded as 32-bit unsigned integers.
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [ipv4ToInt('0.0.0.0'), ipv4ToInt('0.255.255.255')],         // this network
  [ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')],       // private
  [ipv4ToInt('100.64.0.0'), ipv4ToInt('100.127.255.255')],    // CGNAT
  [ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')],     // loopback
  [ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')],   // link-local + cloud metadata
  [ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')],     // private
  [ipv4ToInt('192.0.0.0'), ipv4ToInt('192.0.0.255')],         // IETF protocol assignments
  [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],   // private
  [ipv4ToInt('198.18.0.0'), ipv4ToInt('198.19.255.255')],     // benchmarking
  [ipv4ToInt('224.0.0.0'), ipv4ToInt('239.255.255.255')],     // multicast
  [ipv4ToInt('240.0.0.0'), ipv4ToInt('255.255.255.255')],     // reserved + broadcast
];

function ipv4ToInt(addr: string): number {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid IPv4 address: ${addr}`);
  }
  // >>> 0 forces unsigned 32-bit.
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIPv4(addr: string): boolean {
  const n = ipv4ToInt(addr);
  return BLOCKED_IPV4_RANGES.some(([start, end]) => n >= start && n <= end);
}

function isBlockedIPv6(addr: string): boolean {
  const normalised = addr.toLowerCase();

  // ::, ::1 (loopback), multicast, link-local, unique-local, discard, documentation.
  if (normalised === '::' || normalised === '::1') return true;
  if (normalised.startsWith('ff')) return true;           // ff00::/8 multicast
  if (normalised.startsWith('fe8') || normalised.startsWith('fe9') ||
      normalised.startsWith('fea') || normalised.startsWith('feb')) return true; // fe80::/10 link-local
  if (normalised.startsWith('fc') || normalised.startsWith('fd')) return true;   // fc00::/7 unique-local
  if (normalised.startsWith('100::')) return true;        // discard prefix
  if (normalised.startsWith('2001:db8')) return true;     // documentation

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible — validate underlying v4.
  const mapped = normalised.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  const compat = normalised.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (compat) return isBlockedIPv4(compat[1]);

  // 6to4 (2002::/16) carries an embedded IPv4 — block if that IPv4 is private.
  if (normalised.startsWith('2002:')) {
    const hextets = normalised.split(':');
    if (hextets.length >= 3) {
      const a = parseInt(hextets[1], 16);
      const b = parseInt(hextets[2], 16);
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        const v4 = `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`;
        if (isBlockedIPv4(v4)) return true;
      }
    }
  }

  return false;
}

function isBlockedAddress(addr: string): boolean {
  const family = isIP(addr);
  if (family === 4) return isBlockedIPv4(addr);
  if (family === 6) return isBlockedIPv6(addr);
  return true; // not a valid IP literal — be conservative
}

export type SafeFetchOptions = {
  /**
   * Exact lowercase hostnames permitted. If omitted, any public host is allowed.
   * Wildcard subdomain matches can be expressed as ".example.com" (leading dot).
   */
  allowedHosts?: ReadonlyArray<string>;
  signal?: AbortSignal;
};

function hostMatches(hostname: string, allowed: ReadonlyArray<string>): boolean {
  const h = hostname.toLowerCase();
  return allowed.some((entry) => {
    const e = entry.toLowerCase();
    if (e.startsWith('.')) return h === e.slice(1) || h.endsWith(e);
    return h === e;
  });
}

/**
 * Validate a URL and resolve its hostname, rejecting anything that points at
 * a private network, loopback, link-local, metadata, or otherwise-reserved
 * address. Also enforces http(s) scheme and an optional host allowlist.
 */
export async function assertSafeUrl(url: string, opts: SafeFetchOptions = {}): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }
  if (opts.allowedHosts && !hostMatches(parsed.hostname, opts.allowedHosts)) {
    throw new Error(`Host not allowed: ${parsed.hostname}`);
  }

  const host = parsed.hostname;
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true });

  if (addresses.length === 0) {
    throw new Error(`No DNS result for ${host}`);
  }
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new Error(`Blocked address for ${host}: ${address}`);
    }
  }
  return parsed;
}

/**
 * Like fetch(), but validates the URL against SSRF before each hop and
 * follows redirects manually so a 3xx response can't sneak us onto a
 * private address.
 */
export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafeUrl(current, opts);
    const res = await fetch(current, { redirect: 'manual', signal: opts.signal });
    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get('location');
    if (!location) return res;
    current = new URL(location, current).toString();
  }
  throw new Error('Too many redirects');
}
