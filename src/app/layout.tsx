import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { getHotelSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Hotel Dunary",
  description: "Sistema de gestión del hotel",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const settings = await getHotelSettings();
  return (
    <html lang="es" style={{ "--color-primary": settings.primaryColor, "--color-accent": settings.accentColor } as React.CSSProperties}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="flex text-slate-900"
        style={{
          backgroundColor: settings.primaryColor,
          backgroundImage: settings.backgroundPath ? `url(${settings.backgroundPath})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <AppShell
          userName={session?.name ?? null}
          isAdmin={session?.role === "ADMIN"}
          hotelName={settings.hotelName}
          logoPath={settings.logoPath}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
