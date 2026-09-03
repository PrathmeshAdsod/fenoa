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
  try {
    return JSON.parse(raw) as FirebaseWebAppConfig;
  } catch {
    throw new Error("FIREBASE_WEBAPP_CONFIG must contain valid JSON.");
  }
}

const appHostingConfig = appHostingFirebaseConfig();

const securityHeaders = [
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
