import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk } from "next/font/google";

import "@/styles/globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getProfile } from "@/server/services/authService";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "20byte",
  description: "20byte SaaS foundation shell"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  const profile = session ? await getProfile(session.userId).catch(() => null) : null;

  return (
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <body
        className={cn(
          spaceGrotesk.className,
          "h-full overflow-hidden bg-[radial-gradient(1200px_700px_at_20%_0%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(1000px_600px_at_100%_100%,hsl(var(--accent)/0.16),transparent_65%)] antialiased"
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell
            user={
              session
                ? {
                    email: session.email,
                    name: session.name,
                    avatarUrl: profile?.avatarUrl ?? null
                  }
                : null
            }
          >
            {children}
          </AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
