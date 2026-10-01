"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/hoy", label: "Hoy" },
  { href: "/tablero", label: "Tablero" },
  { href: "/", label: "Calendario" },
  { href: "/reservas", label: "Reservas" },
  { href: "/huespedes", label: "Huéspedes" },
  { href: "/habitaciones", label: "Habitaciones" },
  { href: "/pagos", label: "Caja y pagos" },
  { href: "/inventario", label: "Inventario" },
  { href: "/respaldo", label: "Copias de seguridad" },
];

export default function Sidebar({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-100">
      <div className="px-6 py-5 text-lg font-semibold">Hotel Dunary</div>
      <nav className="flex flex-col gap-1 px-3">
        {(isAdmin ? [...links, { href: "/usuarios", label: "Usuarios" }] : links).map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-slate-700 font-medium"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
            </nav>
      <div className="mt-auto border-t border-slate-800 px-3 py-4">
        <div className="mb-2 px-3 text-sm text-slate-300">{userName}</div>
        <form action={logout}>
          <button className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800">
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}