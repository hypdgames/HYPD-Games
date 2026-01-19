import type { Metadata, Viewport } from "next";
import { Chivo, Manrope } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/toast-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { SettingsProvider } from "@/components/settings-provider";

const chivo = Chivo({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-chivo",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
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
    google: "your-google-verification-code", // Add when you have it
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="google-adsense-account" content="ca-pub-9316102142280167" />
      </head>
      <body className={`${chivo.variable} ${manrope.variable} font-sans antialiased`}>
        <Providers>
          <SettingsProvider>
            <ServiceWorkerRegistration />
            <main className="min-h-screen bg-background transition-colors duration-300">
              {children}
            </main>
            <BottomNav />
            <ToastProvider />
          </SettingsProvider>
        </Providers>
      </body>
    </html>
  );
}
