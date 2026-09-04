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

export const metadata: Metadata = {
  title: "Tiny Workshop Kanban",
  description: "A beautiful kanban board for managing your tiny workshop projects",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon-60@2x.png', sizes: '120x120', type: 'image/png' },
      { url: '/favicon-60@3x.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/favicon-60@2x.png',
      },
    ],
  },
  manifest: '/site.webmanifest',
};

import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import MasterNav from "@eliseboyd/design/nav";
import { createClient } from "@/utils/supabase/server";
import { getAllowedUserIds } from "@/utils/supabase/env";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Only decides what the nav's account corner shows. Middleware is the gate;
  // a wrong answer here costs an avatar, never access.
  const claims = await (async () => {
    const allowed = getAllowedUserIds();
    if (!allowed) return null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      const c = data?.claims;
      return typeof c?.sub === "string" && allowed.has(c.sub) ? c : null;
    } catch {
      return null;
    }
  })();
  // The JWT is the only identity source in the suite — set user_metadata.name
  // / .avatar_url in Supabase to change what renders.
  const meta = (claims?.user_metadata ?? {}) as { name?: string; avatar_url?: string };
  const navUser = claims
    ? {
        name: meta.name ?? (claims.email as string | undefined)?.split("@")[0] ?? "account",
        avatarUrl: meta.avatar_url,
      }
    : null;

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
        {/* MasterNav renders plain <a>/<form action> — Next's basePath is not
            applied to those, so the /kanban prefix is spelled out here. */}
        <MasterNav
          current="kanban"
          user={navUser}
          signInHref="/kanban/login"
          signOutAction="/kanban/auth/signout"
        />
        <ConfirmProvider>{children}</ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
