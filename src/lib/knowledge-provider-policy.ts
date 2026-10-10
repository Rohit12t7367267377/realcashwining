/** Destinations and credential references are deployment-owned, not supplied by a request. */
const providers: Record<string, { origin: string; secret?: string }> = {
  openai: { origin: "https://api.openai.com", secret: "OPENAI_API_KEY" },
  gemini: { origin: "https://generativelanguage.googleapis.com", secret: "GEMINI_API_KEY" },
  cricapi: { origin: "https://api.cricapi.com", secret: "CRICAPI_API_KEY" },
  anthropic: { origin: "https://api.anthropic.com", secret: "ANTHROPIC_API_KEY" },
};

export function approvedKnowledgeProvider(provider: string, endpoint: string, secretName?: string | null) {
  const policy = providers[provider.trim().toLowerCase()];
  const url = new URL(endpoint);
  if (!policy || url.origin !== policy.origin || url.username || url.password ||
      (secretName && secretName !== policy.secret)) {
    throw new Error("This provider destination or credential reference is not approved.");
  }
  return { url, secretName: policy.secret };
}