import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";

import "@/styles/globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { isSuperadmin } from "@/server/services/platformAccessService";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";

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
  const [superadminEnabled, primaryOrganization] = session
    ? await Promise.all([
      isSuperadmin(session.userId, session.email).catch(() => false),
      getPrimaryOrganizationForUser(session.userId).catch(() => null)
    ])
    : [false, null];

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={cn(
          "h-full bg-[radial-gradient(1200px_700px_at_20%_0%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(1000px_600px_at_100%_100%,hsl(var(--accent)/0.16),transparent_65%)] antialiased"
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell
            user={
              session
                ? {
                    email: session.email,
                    name: session.name,
                    avatarUrl: null,
                    isSuperadmin: superadminEnabled,
                    primaryOrgId: primaryOrganization?.id ?? null,
                    primaryOrgRole: primaryOrganization?.role ?? null
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
