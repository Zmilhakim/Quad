import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "@/providers";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SITE_URL } from "@/lib/site";

const archivo = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo", display: "swap" });

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

const description =
  "A launchpad on Uniswap v4 where every token opens at the same price: 1.7 ETH for a billion tokens, all of them in a locked pool. 4% of every swap, 80% of it to whoever launched it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Quadpad — every launch opens at 1.7 ETH", template: "%s · Quadpad" },
  description,
  openGraph: {
    type: "website",
    siteName: "Quadpad",
    title: "Quadpad — every launch opens at 1.7 ETH",
    description,
    images: [{ url: "/brand/og-1200x630.png", width: 1200, height: 630, alt: "Quadpad" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quadpad — every launch opens at 1.7 ETH",
    description,
    images: ["/brand/og-1200x630.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#101826",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
