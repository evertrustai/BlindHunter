/* ---------------------------------------------------------------------------
 * Loopback guards for the local server.
 *
 * BlindHunter runs unauthenticated on 127.0.0.1 and can run shell commands and
 * read the filesystem. Without these guards, any web page the user visits could
 * reach the API (cross-origin, or via DNS-rebinding where a hostile domain is
 * re-pointed at 127.0.0.1). Requests must be addressed to a loopback Host, and
 * browser requests must come from a loopback Origin.
 * Advanced users who intentionally expose the server can add hostnames via the
 * BLINDHUNTER_ALLOWED_HOSTS env var (comma-separated).
 * ------------------------------------------------------------------------- */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const EXTRA_HOSTS = new Set(
  (process.env.BLINDHUNTER_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
)

function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase()
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']')) // "[::1]:8787" -> "::1"
  return h.split(':')[0]
}

function isAllowedName(name: string): boolean {
  return LOOPBACK_HOSTS.has(name) || EXTRA_HOSTS.has(name)
}

export function hostAllowed(host?: string): boolean {
  return Boolean(host) && isAllowedName(hostnameOf(host as string))
}

export function originAllowed(origin: string): boolean {
  try {
    return isAllowedName(new URL(origin).hostname.toLowerCase())
  } catch {
    return false
  }
}
