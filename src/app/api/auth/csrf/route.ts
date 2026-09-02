import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const token = randomBytes(32).toString("base64url");
  const response = NextResponse.json({ token });
  response.cookies.set("fenoa_csrf", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 600,
  });
  return response;
}
