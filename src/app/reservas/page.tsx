import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: FormDataEntryValue | null) {
  const s = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date) {
  return d.toLocaleDateString("es-CO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function createReservation(formData: FormData) {
  "use server";
  const guestId = Number(formData.get("guestId"));
  const roomId = Number(formData.get("roomId"));
  const checkIn = parseDate(formData.get("checkIn"));
  const checkOut = parseDate(formData.get("checkOut"));
  const adults = Number(formData.get("adults")) || 1;
  const children = Number(formData.get("children")) || 0;

  if (!guestId || !roomId || !checkIn || !checkOut) {
    redirect("/reservas?error=" + encodeURIComponent("Faltan datos."));
  }
  if (checkOut <= checkIn) {
    redirect(
      "/reservas?error=" +
        encodeURIComponent("La salida debe ser después de la entrada.")
    );
  }

  const error = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!room || !room.active) return "La habitación no está disponible.";

    // Se cruzan si: nueva.entrada < existente.salida Y nueva.salida > existente.entrada
    const conflict = await tx.reservation.findFirst({
      where: {
        roomId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (conflict) {
      return `La habitación ${room.number} ya está reservada del ${fmt(
        conflict.checkIn
      )} al ${fmt(conflict.checkOut)}.`;
    }

    await tx.reservation.create({
      data: {
        roomId,
        guestId,
        checkIn,
        checkOut,
        adults,
        children,
        nightlyRate: room.roomType.nightlyRate,
      },
    });
    return null;
  });

  if (error) redirect("/reservas?error=" + encodeURIComponent(error));

  revalidatePath("/reservas");
  redirect("/reservas?ok=1");
}

async function setStatus(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!id || !["CHECKED_IN", "CHECKED_OUT", "CANCELLED"].includes(status)) return;

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: status as "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" },
  });

  // Al salir el huésped, la habitación queda pendiente de limpieza
  if (status === "CHECKED_OUT") {
    await prisma.room.update({
      where: { id: reservation.roomId },
      data: { status: "DIRTY" },
    });
  }
  revalidatePath("/reservas");
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const statusLabel: Record<string, { text: string; className: string }> = {
  CONFIRMED: { text: "Reservada", className: "bg-sky-100 text-sky-800" },
  CHECKED_IN: { text: "Hospedado", className: "bg-emerald-100 text-emerald-800" },
  CHECKED_OUT: { text: "Salió", className: "bg-slate-200 text-slate-700" },
  CANCELLED: { text: "Cancelada", className: "bg-red-100 text-red-800" },
  NO_SHOW: { text: "No llegó", className: "bg-amber-100 text-amber-800" },
};

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";
const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const [guests, rooms, reservations] = await Promise.all([
    prisma.guest.findMany({ orderBy: { firstName: "asc" } }),
    prisma.room.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
      include: { roomType: true },
    }),
    prisma.reservation.findMany({
      orderBy: { checkIn: "desc" },
      take: 100,
      include: { room: true, guest: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Reservas</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Reserva creada.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Nueva reserva</h2>
        {guests.length === 0 || rooms.length === 0 ? (
          <p className="text-sm text-slate-500">
            Necesitas al menos un huésped y una habitación registrados.
          </p>
        ) : (
          <form action={createReservation} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Huésped
              <select name="guestId" required className={`${input} mt-1 block`}>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.firstName} {g.lastName} ({g.documentNumber})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Habitación
              <select name="roomId" required className={`${input} mt-1 block`}>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} - {r.roomType.name} ({cop.format(r.roomType.nightlyRate)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Entrada
              <input name="checkIn" type="date" required className={`${input} mt-1 block`} />
            </label>
            <label className="text-xs text-slate-500">
              Salida
              <input name="checkOut" type="date" required className={`${input} mt-1 block`} />
            </label>
            <label className="text-xs text-slate-500">
              Adultos
              <input name="adults" type="number" min="1" defaultValue="1" className={`${input} mt-1 block w-20`} />
            </label>
            <label className="text-xs text-slate-500">
              Niños
              <input name="children" type="number" min="0" defaultValue="0" className={`${input} mt-1 block w-20`} />
            </label>
            <button className={button}>Crear reserva</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Listado</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Entrada</th>
                <th className="px-4 py-2">Salida</th>
                <th className="px-4 py-2">Noches</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-slate-500">
                    Todavía no hay reservas.
                  </td>
                </tr>
              )}
              {reservations.map((r) => {
                const nights = Math.round(
                  (r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS
                );
                const st = statusLabel[r.status];
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">
                      {r.guest.firstName} {r.guest.lastName}
                    </td>
                    <td className="px-4 py-2">{r.room.number}</td>
                    <td className="px-4 py-2">{fmt(r.checkIn)}</td>
                    <td className="px-4 py-2">{fmt(r.checkOut)}</td>
                    <td className="px-4 py-2">{nights}</td>
                    <td className="px-4 py-2">{cop.format(nights * r.nightlyRate)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${st.className}`}>
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {r.status === "CONFIRMED" && (
                          <>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="CHECKED_IN" />
                              <button className={smallButton}>Check-in</button>
                            </form>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="CANCELLED" />
                              <button className={smallButton}>Cancelar</button>
                            </form>
                          </>
                        )}
                        {r.status === "CHECKED_IN" && (
                          <form action={setStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="CHECKED_OUT" />
                            <button className={smallButton}>Check-out</button>
                          </form>
                        )}
                      </div>
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