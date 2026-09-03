import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Link from "next/link";

import { AuthButton } from "@/components/auth/auth-button";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fenoa — Worlds worth branching",
  description:
    "Create fictional worlds, explore community branches, and shape stories with your own agent.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="Fenoa home">
            Fenoa
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/">Discover</Link>
            <Link href="/create">Create</Link>
          </nav>
          <AuthButton />
        </header>
        {children}
      </body>
    </html>
  );
}
