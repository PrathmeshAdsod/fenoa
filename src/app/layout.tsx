import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import Link from "next/link";

import { AuthButton } from "@/components/auth/auth-button";
import "./globals.css";

const story = Newsreader({
  variable: "--font-story",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${story.variable} ${sans.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="Fenoa home">
            Fenoa
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/#product">Product</Link>
            <Link href="/?view=discover">Discover</Link>
            <Link href="/create">Create</Link>
          </nav>
          <AuthButton />
        </header>
        {children}
      </body>
    </html>
  );
}
