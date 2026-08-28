import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Next does not apply basePath to metadata URLs — unlike next/link and
// next/image, these strings are emitted verbatim — so the prefix is explicit.
// NEXT_PUBLIC_BASE_PATH is set from `basePath` in next.config.ts.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: "Tiny Workshop Kanban",
  description: "A beautiful kanban board for managing your tiny workshop projects",
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico`, sizes: 'any' },
      { url: `${basePath}/favicon.png`, type: 'image/png' },
    ],
    apple: [
      { url: `${basePath}/favicon-60@2x.png`, sizes: '120x120', type: 'image/png' },
      { url: `${basePath}/favicon-60@3x.png`, sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: `${basePath}/favicon-60@2x.png`,
      },
    ],
  },
  manifest: `${basePath}/site.webmanifest`,
};

import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="en" suppressHydrationWarning>
      {/* Start the TLS handshake to Supabase (auth + storage images) during
          HTML parse instead of on first fetch. React hoists this to <head>. */}
      {supabaseUrl && <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
      >
        <ConfirmProvider>{children}</ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
