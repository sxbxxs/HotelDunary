import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const colors: Record<string, string> = {
  CHECKED_IN: "bg-emerald-500 text-white",
  CONFIRMED: "bg-sky-500 text-white",
  CHECKED_OUT: "bg-slate-300 text-slate-700",
};

const housekeeping: Record<string, { text: string; className: string }> = {
  CLEAN: { text: "Limpia", className: "text-emerald-600" },
  DIRTY: { text: "Sucia", className: "text-red-600" },
  CLEANING: { text: "En limpieza", className: "text-amber-600" },
  MAINTENANCE: { text: "Mantenimiento", className: "text-slate-500" },
};

export default async function CalendarioPage() {
  // Hoy a medianoche UTC, igual que se guardan las fechas de las reservas
  const now = new Date();
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = start + DAYS * DAY_MS;

  const rooms = await prisma.room.findMany({
    where: { active: true },
    orderBy: { number: "asc" },
    include: {
      roomType: true,
      reservations: {
        where: {
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          checkIn: { lt: new Date(end) },
          checkOut: { gt: new Date(start) },
        },
        include: { guest: true },
      },
    },
  });

  const days = Array.from({ length: DAYS }, (_, i) => new Date(start + i * DAY_MS));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Calendario de ocupación</h1>
      <p className="mb-4 text-sm text-slate-500">Próximos {DAYS} días</p>

      <div className="mb-4 flex gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500" /> Hospedado
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-sky-500" /> Reservada
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-slate-300" /> Ya salió
        </span>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-slate-500">
          Todavía no hay habitaciones. Agrégalas en la sección Habitaciones.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-white px-3 py-2 text-left">
                  Habitación
                </th>
                {days.map((d, i) => (
                  <th
                    key={i}
                    className={`min-w-20 border-b border-slate-200 px-2 py-2 font-medium ${
                      i === 0 ? "bg-amber-50" : ""
                    }`}
                  >
                    <div className="capitalize text-slate-500">
                      {d.toLocaleDateString("es-CO", { weekday: "short", timeZone: "UTC" })}
                    </div>
                    <div>{d.getUTCDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => {
                const cells = [];
                let i = 0;
                while (i < DAYS) {
                  const dayMs = start + i * DAY_MS;
                  const res = room.reservations.find(
                    (r) =>
                      r.checkIn.getTime() <= dayMs && r.checkOut.getTime() > dayMs
                  );
                  if (res) {
                    const span = Math.min(
                      DAYS - i,
                      Math.ceil((res.checkOut.getTime() - dayMs) / DAY_MS)
                    );
                    cells.push(
                      <td
                        key={i}
                        colSpan={span}
                        className={`h-14 border-b border-slate-100 px-2 font-medium ${
                          colors[res.status]
                        }`}
                        title={`${res.guest.firstName} ${res.guest.lastName}`}
                      >
                        {res.guest.firstName} {res.guest.lastName}
                      </td>
                    );
                    i += span;
                  } else {
                    cells.push(
                      <td key={i} className="h-14 border-b border-slate-100" />
                    );
                    i++;
                  }
                }

                const hk = housekeeping[room.status];
                return (
                  <tr key={room.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-3">
                      <div className="font-medium">{room.number}</div>
                      <div className="text-slate-500">{room.roomType.name}</div>
                      <div className={hk.className}>{hk.text}</div>
                    </td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}