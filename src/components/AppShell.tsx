"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
  userName,
  isAdmin,
  hotelName,
}: {
  children: React.ReactNode;
  userName: string | null;
  isAdmin: boolean;
  hotelName: string;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin || !userName) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
            <Sidebar userName={userName} isAdmin={isAdmin} hotelName={hotelName} />
      <main className="h-screen flex-1 overflow-y-auto p-8">{children}</main>
    </>
  );
}