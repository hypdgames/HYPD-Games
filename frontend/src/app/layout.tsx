import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/toast-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { SettingsProvider } from "@/components/settings-provider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "HYPD Games - Play Instant Games",
  description: "TikTok-style instant gaming platform. Swipe through endless games and play instantly - no downloads required!",
  manifest: "/manifest.json",
  metadataBase: new URL("https://hypd.games"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HYPD Games",
  },
  keywords: ["games", "browser games", "instant games", "free games", "play online", "mobile games", "html5 games", "casual games"],
  authors: [{ name: "HYPD Games" }],
  creator: "HYPD Games",
  publisher: "HYPD Games",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://hypd.games",
    siteName: "HYPD Games",
    title: "HYPD Games - Play Instant Games",
    description: "TikTok-style instant gaming platform. Swipe through endless games and play instantly!",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HYPD Games - Play Instant Games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HYPD Games - Play Instant Games",
    description: "TikTok-style instant gaming platform. Swipe through endless games and play instantly!",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#141414",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-9316102142280167" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9316102142280167"
          crossOrigin="anonymous"
        ></script>
        <link rel="preconnect" href="https://games.gamepix.com" />
        <link rel="dns-prefetch" href="https://games.gamepix.com" />
        <link rel="preconnect" href="https://html5.gamedistribution.com" />
        <link rel="dns-prefetch" href="https://html5.gamedistribution.com" />
        <link rel="preconnect" href="https://html5.gamemonetize.co" />
        <link rel="dns-prefetch" href="https://html5.gamemonetize.co" />
        <link rel="preconnect" href="https://img.gamemonetize.com" />
        <link rel="dns-prefetch" href="https://img.gamemonetize.com" />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <Providers>
          <SettingsProvider>
            <ServiceWorkerRegistration />
            <main className="min-h-screen bg-background">
              <div className="mx-auto max-w-[430px] min-h-screen relative">
                {children}
              </div>
            </main>
            <BottomNav />
            <ToastProvider />
          </SettingsProvider>
        </Providers>
      </body>
    </html>
  );
}
