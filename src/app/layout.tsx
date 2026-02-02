import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/accessibility.css";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";

export const metadata: Metadata = {
  title: "P2P Music Platform",
  description: "A decentralized, peer-to-peer music streaming and social platform",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ServiceWorkerProvider>
          {children}
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
