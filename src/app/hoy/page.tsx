import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

async function setStatus(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!id || !["CHECKED_IN", "CHECKED_OUT"].includes(status)) return;

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: status as "CHECKED_IN" | "CHECKED_OUT" },
  });

  if (status === "CHECKED_OUT") {
    await prisma.room.update({
      where: { id: reservation.roomId },
      data: { status: "DIRTY" },
    });
  }

  revalidatePath("/hoy");
  revalidatePath("/reservas");
  revalidatePath("/");
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export default async function HoyPage() {
  // Hoy a medianoche UTC, igual que se guardan las fechas de las reservas
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const tomorrow = new Date(today.getTime() + DAY_MS);

  const include = { guest: true, room: true, payments: true };

  const [arrivals, departures, inHouse, totalRooms] = await Promise.all([
    // Llegan hoy y todavía no han hecho check-in
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", checkIn: { gte: today, lt: tomorrow } },
      include,
      orderBy: { room: { number: "asc" } },
    }),
    // Salen hoy y siguen hospedados
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN", checkOut: { gte: today, lt: tomorrow } },
      include,
      orderBy: { room: { number: "asc" } },
    }),
    // Hospedados actualmente (incluye los que salen hoy)
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN" },
      include,
      orderBy: { room: { number: "asc" } },
    }),
    prisma.room.count({ where: { active: true } }),
  ]);

  // Reservas con check-in pendiente de días anteriores (alerta)
  const overdueArrivals = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", checkIn: { lt: today } },
    include,
    orderBy: { checkIn: "asc" },
  });

  // Hospedados que ya debieron salir (alerta)
  const overdueDepartures = await prisma.reservation.findMany({
    where: { status: "CHECKED_IN", checkOut: { lt: today } },
    include,
    orderBy: { checkOut: "asc" },
  });

  function balanceOf(r: (typeof inHouse)[number]) {
    const nights = Math.round(
      (r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS
    );
    const paid = r.payments.reduce((sum, p) => sum + p.amount, 0);
    return nights * r.nightlyRate - paid;
  }

  const occupancy = totalRooms
    ? Math.round((inHouse.length / totalRooms) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Resumen de hoy</h1>
        <p className="text-sm capitalize text-slate-500">
          {today.toLocaleDateString("es-CO", {
            timeZone: "UTC",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold">{arrivals.length}</div>
          <div className="text-sm text-slate-500">Llegadas pendientes</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold">{departures.length}</div>
          <div className="text-sm text-slate-500">Salidas pendientes</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold">{inHouse.length}</div>
          <div className="text-sm text-slate-500">Hospedados ahora</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold">{occupancy}%</div>
          <div className="text-sm text-slate-500">
            Ocupación ({inHouse.length} de {totalRooms})
          </div>
        </div>
      </div>

      {(overdueArrivals.length > 0 || overdueDepartures.length > 0) && (
        <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-medium">Requieren atención</h2>
          {overdueArrivals.map((r) => (
            <p key={`a${r.id}`}>
              Hab. {r.room.number}: {r.guest.firstName} {r.guest.lastName} debió
              llegar antes y no tiene check-in.
            </p>
          ))}
          {overdueDepartures.map((r) => (
            <p key={`d${r.id}`}>
              Hab. {r.room.number}: {r.guest.firstName} {r.guest.lastName} debió
              salir antes y no tiene check-out.
            </p>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Llegan hoy</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Personas</th>
                <th className="px-4 py-2">Saldo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {arrivals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    No hay llegadas pendientes hoy.
                  </td>
                </tr>
              )}
              {arrivals.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{r.room.number}</td>
                  <td className="px-4 py-2">
                    {r.guest.firstName} {r.guest.lastName}
                  </td>
                  <td className="px-4 py-2">
                    {r.adults} adultos, {r.children} niños
                  </td>
                  <td className="px-4 py-2">{cop.format(balanceOf(r))}</td>
                  <td className="px-4 py-2">
                    <form action={setStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="CHECKED_IN" />
                      <button className={smallButton}>Check-in</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Salen hoy</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Saldo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {departures.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-slate-500">
                    No hay salidas pendientes hoy.
                  </td>
                </tr>
              )}
              {departures.map((r) => {
                const balance = balanceOf(r);
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">{r.room.number}</td>
                    <td className="px-4 py-2">
                      {r.guest.firstName} {r.guest.lastName}
                    </td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        balance > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {balance > 0 ? cop.format(balance) : "Al día"}
                    </td>
                    <td className="px-4 py-2">
                      <form action={setStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="CHECKED_OUT" />
                        <button className={smallButton}>Check-out</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Hospedados ahora</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Sale</th>
                <th className="px-4 py-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {inHouse.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-slate-500">
                    No hay huéspedes hospedados.
                  </td>
                </tr>
              )}
              {inHouse.map((r) => {
                const balance = balanceOf(r);
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">{r.room.number}</td>
                    <td className="px-4 py-2">
                      {r.guest.firstName} {r.guest.lastName}
                    </td>
                    <td className="px-4 py-2">
                      {r.checkOut.toLocaleDateString("es-CO", {
                        timeZone: "UTC",
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        balance > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {balance > 0 ? cop.format(balance) : "Al día"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}