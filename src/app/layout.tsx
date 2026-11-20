import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/accessibility.css";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "P2P Music Platform",
  description: "A server-authoritative music streaming and social platform with optional IPFS support",
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');var l=t==='light';document.documentElement.classList.toggle('light',l);document.documentElement.classList.toggle('dark',!l)}catch(e){}",
          }}
        />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <ServiceWorkerProvider>
            <AppShell>{children}</AppShell>
          </ServiceWorkerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
