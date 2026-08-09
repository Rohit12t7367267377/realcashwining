// Server-only Firebase Cloud Messaging helpers.
// Works without credentials: campaigns are still recorded and delivered
// in-app; FCM push delivery activates automatically once the Firebase
// secrets are added.
import process from "node:process";

export type FcmMessage = {
  title: string;
  body: string;
  imageUrl?: string | null;
  link?: string | null;
  data?: Record<string, string>;
};

export function getFcmCredentials() {
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"];
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export function getWebPushConfig() {
  return {
    apiKey: process.env["FIREBASE_API_KEY"] ?? "",
    projectId: process.env["FIREBASE_PROJECT_ID"] ?? "",
    messagingSenderId: process.env["FIREBASE_MESSAGING_SENDER_ID"] ?? "",
    appId: process.env["FIREBASE_APP_ID"] ?? "",
    vapidKey: process.env["FIREBASE_VAPID_KEY"] ?? "",
  };
}

export function isPushConfigured() {
  const c = getWebPushConfig();
  return Boolean(getFcmCredentials() && c.apiKey && c.messagingSenderId && c.appId && c.vapidKey);
}

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const creds = getFcmCredentials();
  if (!creds) throw new Error("Firebase credentials are not configured");
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(creds.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? "Failed to get Firebase access token");
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

/** Sends one message to one device token. Returns null on success, else an error string. */
export async function sendToToken(token: string, msg: FcmMessage): Promise<string | null> {
  const creds = getFcmCredentials();
  if (!creds) return "not_configured";
  try {
    const accessToken = await getAccessToken();
    const payload = {
      message: {
        token,
        notification: {
          title: msg.title,
          body: msg.body,
          ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
        },
        data: {
          ...(msg.data ?? {}),
          ...(msg.link ? { link: msg.link } : {}),
        },
        webpush: {
          fcmOptions: { link: msg.link ?? "/notifications" },
          notification: {
            icon: "/favicon.ico",
            ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
          },
        },
        android: { priority: "HIGH" as const },
      },
    };
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) return null;
    const text = await res.text();
    return text.slice(0, 300);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function isDeadTokenError(error: string | null) {
  if (!error) return false;
  return /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(error);
}
