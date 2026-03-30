import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthNav } from "@/app/components/auth-nav";
import Footer from "@/app/components/footer";
import { AppSessionProvider } from "@/app/components/session-provider";
import CookieConsentBanner from "@/app/components/cookie-consent-banner";
import { SiteNoticeBanner } from "@/app/components/site-notice-banner";
import { generateOrganizationSchema } from "@/lib/seo-utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dibble.farm";

export const metadata: Metadata = {
  title: {
    default: "Dibble - Fresh Local Produce Marketplace",
    template: "%s | Dibble",
  },
  description:
    "Discover fresh produce from local makers on Dibble. Direct from farms to your door. Buy local, support local farmers and producers.",
  keywords:
    "fresh produce, local farmers, organic food, food marketplace, farm fresh, local food, sustainable shopping, community supported agriculture",
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: baseUrl,
    title: "Dibble - Fresh Local Produce Marketplace",
    description:
      "Discover fresh produce from local makers on Dibble. Direct from farms to your door.",
    siteName: "Dibble",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Dibble - Fresh Local Produce Marketplace",
      },
      {
        url: `${baseUrl}/og-image-square.png`,
        width: 800,
        height: 800,
        alt: "Dibble",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@dibblefarm",
    creator: "@dibblefarm",
    title: "Dibble - Fresh Local Produce Marketplace",
    description:
      "Discover fresh produce from local makers on Dibble. Direct from farms to your door.",
    images: [`${baseUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dibble",
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = generateOrganizationSchema({
    name: "Dibble",
    description:
      "Marketplace for fresh produce by local makers. Direct from farms to your door.",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    sameAs: ["https://twitter.com/dibblefarm", "https://facebook.com/dibblefarm"],
  });

  return (
    <html lang="en">
      <head>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <AppSessionProvider>
          <AuthNav />
          <SiteNoticeBanner />
          <div className="flex-1">{children}</div>
          <Footer />
          <CookieConsentBanner />
        </AppSessionProvider>
      </body>
    </html>
  );
}
