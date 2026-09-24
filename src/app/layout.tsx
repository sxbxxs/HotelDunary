import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Hotel Dunary",
  description: "Sistema de gestión del hotel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="flex bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="h-screen flex-1 overflow-y-auto p-8">{children}</main>
      </body>
    </html>
  );
}
