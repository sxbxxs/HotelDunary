"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/", label: "Calendario" },
  { href: "/tablero", label: "Tablero" },
  { href: "/reservas", label: "Reservas" },
  { href: "/huespedes", label: "Huéspedes" },
  { href: "/pagos", label: "Caja y pagos" },
  { href: "/egresos", label: "Egresos" },
  { href: "/caja-diaria", label: "Cierre de caja" },
  { href: "/respaldo", label: "Copias de seguridad" },
];

const adminLinks = [
  { href: "/finanzas", label: "Finanzas" },
  { href: "/habitaciones", label: "Habitaciones" },
  { href: "/inventario", label: "Inventario" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/auditoria", label: "Auditoría" },
  { href: "/configuracion", label: "Configuración" },
];

export default function Sidebar({
  userName,
  isAdmin,
  hotelName,
  logoPath,
}: {
  userName: string;
  isAdmin: boolean;
  hotelName: string;
  logoPath: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-3 px-6 py-5">
        {logoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPath} alt={hotelName} className="h-8 w-8 rounded object-cover" />
        )}
        <span className="text-lg font-semibold">{hotelName}</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
                {(isAdmin ? [...links, ...adminLinks] : links).map((link) => {
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
        <Link
          href="/perfil"
          className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Mi perfil
        </Link>
        <form action={logout}>
          <button className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800">
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}