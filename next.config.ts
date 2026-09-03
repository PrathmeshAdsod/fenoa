import type { NextConfig } from "next";

type FirebaseWebAppConfig = {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  projectId?: string;
};

function appHostingFirebaseConfig(): FirebaseWebAppConfig {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("FIREBASE_WEBAPP_CONFIG must contain valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("FIREBASE_WEBAPP_CONFIG must contain a JSON object.");
  }
  const config = parsed as Record<string, unknown>;
  for (const key of ["apiKey", "appId", "authDomain", "projectId"]) {
    if (config[key] !== undefined && typeof config[key] !== "string") {
      throw new Error(`FIREBASE_WEBAPP_CONFIG.${key} must be a string.`);
    }
  }
  return config as FirebaseWebAppConfig;
}

const appHostingConfig = appHostingFirebaseConfig();

const securityHeaders = [
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? appHostingConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_APP_ID:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? appHostingConfig.appId,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
      appHostingConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? appHostingConfig.projectId,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
