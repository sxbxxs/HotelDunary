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
    <html lang="es">
            <body className="flex bg-slate-50 text-slate-900">
                        <AppShell
          userName={session?.name ?? null}
          isAdmin={session?.role === "ADMIN"}
          hotelName={settings.hotelName}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
