import type { Metadata, Viewport } from "next";
import { Chivo, Manrope } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/toast-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker";

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
  description: "TikTok-style instant gaming platform. Swipe, play, enjoy!",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HYPD Games",
  },
  keywords: ["games", "browser games", "instant games", "free games", "play online"],
  authors: [{ name: "HYPD Games" }],
  creator: "HYPD Games",
  publisher: "HYPD Games",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "HYPD Games",
    title: "HYPD Games - Play Instant Games",
    description: "TikTok-style instant gaming platform. Swipe, play, enjoy!",
  },
  twitter: {
    card: "summary_large_image",
    title: "HYPD Games - Play Instant Games",
    description: "TikTok-style instant gaming platform. Swipe, play, enjoy!",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
      <body className={`${chivo.variable} ${manrope.variable} font-sans antialiased`}>
        <Providers>
          <ServiceWorkerRegistration />
          <main className="min-h-screen bg-background transition-colors duration-300">
            {children}
          </main>
          <BottomNav />
          <ToastProvider />
        </Providers>
      </body>
    </html>
  );
}
