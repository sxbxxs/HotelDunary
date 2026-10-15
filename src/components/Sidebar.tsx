"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Calendar,
  Bookmark,
  Users,
  ArrowLeftRight,
  BarChart3,
  BedDouble,
  Package,
  UserCog,
  ClipboardList,
  Settings,
  UserCircle,
  LogOut,
  CreditCard,
  Sun,
  Waves,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/hoy", label: "hoy", icon: Sun },
  { href: "/tablero", label: "Tablero", icon: LayoutGrid },
  { href: "/", label: "Calendario", icon: Calendar },
  { href: "/reservas", label: "Reservas", icon: Bookmark },
  { href: "/pagos", label: "Caja y pagos", icon: CreditCard },
  { href: "/huespedes", label: "Huéspedes", icon: Users },
  { href: "/caja-diaria", label: "Cambio de turno", icon: ArrowLeftRight },
    { href: "/servicios", label: "Servicios", icon: Waves },
];

const adminLinks = [
  { href: "/finanzas", label: "Finanzas", icon: BarChart3 },
  { href: "/habitaciones", label: "Habitaciones", icon: BedDouble },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/auditoria", label: "Auditoría", icon: ClipboardList },
  { href: "/configuracion", label: "Configuración", icon: Settings },
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
  const allLinks = isAdmin ? [...links, ...adminLinks] : links;

  return (
    <aside
      className="flex h-screen w-60 flex-col text-stone-100"
      style={{ backgroundColor: "var(--color-primary, #2A1215)" }}
    >
      <div className="flex items-center gap-3 px-6 py-5">
        {logoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPath} alt={hotelName} className="h-8 w-8 rounded object-cover" />
        )}
        <span className="text-lg font-semibold">{hotelName}</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {allLinks.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "font-medium text-white"
                  : "text-stone-300 hover:bg-stone-200/10 hover:text-white"
              }`}
              style={active ? { backgroundColor: "var(--color-accent, #6B1F24)" } : undefined}
            >
              <Icon
                size={17}
                style={!active ? { color: "var(--color-accent, #6B1F24)" } : undefined}
              />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 px-3 py-4">
        <div className="mb-2 flex items-center gap-2 px-3 text-sm text-stone-300">
          <UserCircle size={17} />
          {userName}
        </div>
        <Link
          href="/perfil"
          className="block rounded-md px-3 py-2 text-sm text-stone-300 hover:bg-white/5"
        >
          Mi perfil
        </Link>
        <form action={logout}>
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-stone-300 hover:bg-white/5">
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}