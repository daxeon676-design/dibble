import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthNav } from "@/app/components/auth-nav";
import Footer from "@/app/components/footer";
import { AppSessionProvider } from "@/app/components/session-provider";
import CookieConsentBanner from "@/app/components/cookie-consent-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dibble",
  description: "Marketplace for fresh produce by local makers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <AppSessionProvider>
          <AuthNav />
          <div className="flex-1">{children}</div>
          <Footer />
          <CookieConsentBanner />
        </AppSessionProvider>
      </body>
    </html>
  );
}
