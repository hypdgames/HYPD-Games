import type { Metadata, Viewport } from "next";
import { Chivo, Manrope } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/toast-provider";

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
