/**
 * Turn a raw error string (a network failure, an HTTP status, or a provider
 * message) into a short, plain-language explanation a non-technical user can act
 * on. `title` is the one-line explanation to show; `detail` is the original
 * technical text, kept for anyone who wants it (shown muted, never instead of
 * the title).
 */
export function explainError(raw: string): { title: string; detail?: string } {
  const msg = (raw || '').trim()
  const low = msg.toLowerCase()
  const statusMatch = msg.match(/\b(400|401|403|404|408|409|413|422|429|500|502|503|504)\b/)
  const status = statusMatch ? Number(statusMatch[1]) : 0

  const withDetail = (title: string) => ({ title, detail: msg && msg !== title ? msg : undefined })

  // Couldn't even reach the provider (DNS, connection refused, offline, TLS…).
  if (
    low.includes('fetch failed') ||
    low.includes('econnrefused') ||
    low.includes('enotfound') ||
    low.includes('getaddrinfo') ||
    low.includes('econnreset') ||
    low.includes('und_err') ||
    low.includes('socket hang up') ||
    low.includes('network') ||
    low.includes('dns')
  ) {
    return withDetail(
      "Couldn't reach the model provider. Check the provider's Base URL in Settings › Models, that the provider is online, and your internet connection.",
    )
  }

  // Took too long.
  if (low.includes('timeout') || low.includes('timed out') || low.includes('etimedout') || status === 408) {
    return withDetail('The provider took too long to respond (timeout). Try again in a moment.')
  }

  // Auth / key problems.
  if (
    status === 401 ||
    low.includes('unauthorized') ||
    low.includes('invalid api key') ||
    low.includes('invalid_api_key') ||
    low.includes('incorrect api key') ||
    low.includes('no api key') ||
    low.includes('missing api key') ||
    low.includes('authentication')
  ) {
    return withDetail(
      'The provider rejected the API key (401 Unauthorized). Open Settings › Models and re-enter a valid key for this provider.',
    )
  }
  if (status === 403 || low.includes('forbidden')) {
    return withDetail(
      "Access was denied by the provider (403). The API key may lack permission for this model, or billing isn't active on the account.",
    )
  }

  // Model / endpoint not found.
  if (status === 404) {
    return withDetail(
      "The model or endpoint wasn't found (404). Check the model name and the Base URL in Settings › Models.",
    )
  }

  // Rate limit / quota / credits.
  if (
    status === 429 ||
    low.includes('rate limit') ||
    low.includes('too many requests') ||
    low.includes('quota') ||
    low.includes('insufficient') ||
    low.includes('billing') ||
    low.includes('credit')
  ) {
    return withDetail(
      'Rate limited or out of quota (429). Wait a bit and try again, or check your provider plan, credits, or billing.',
    )
  }

  // Request too large for the model.
  if (low.includes('context length') || low.includes('maximum context') || low.includes('too many tokens') || status === 413) {
    return withDetail(
      'The conversation is too large for this model (context length exceeded). Start a new session or shorten the chat.',
    )
  }

  // Generic bad request.
  if (status === 400 || status === 422) {
    return withDetail(
      'The provider rejected the request (400). The model name or request options may be invalid — check Settings › Models.',
    )
  }

  // Provider-side server errors.
  if (status >= 500) {
    return withDetail(
      `The model provider had a server error (${status}). This is usually a temporary problem on their side — try again shortly.`,
    )
  }

  // A provider error we couldn't classify — show its own text as the explanation.
  if (low.includes('provider error')) {
    return { title: msg }
  }

  // Fallback: nothing recognized, surface the raw message as-is.
  return { title: msg || 'Something went wrong. Try again.' }
}
