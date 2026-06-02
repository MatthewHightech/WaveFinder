import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WaveFinder",
  description: "Discover surf breaks from satellite imagery",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="flex h-[var(--header-height)] shrink-0 items-center gap-6 border-b border-slate-800 px-4">
          <Link href="/" className="font-semibold text-teal-400 tracking-tight">
            WaveFinder
          </Link>
          <nav className="flex gap-4 text-sm text-slate-400">
            <Link href="/" className="hover:text-white">
              Finder
            </Link>
            <Link href="/label/review" className="hover:text-white">
              Review queue
            </Link>
            <Link href="/label/explore" className="hover:text-white">
              Explore
            </Link>
            <Link href="/label/empty" className="hover:text-white">
              Empty chips
            </Link>
            <Link href="/train" className="hover:text-white">
              Train
            </Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
