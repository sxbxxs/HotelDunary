import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

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

function toInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function updateReservation(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const roomId = Number(formData.get("roomId"));
  const checkIn = parseDate(formData.get("checkIn"));
  const checkOut = parseDate(formData.get("checkOut"));
  const adults = Number(formData.get("adults")) || 1;
  const children = Number(formData.get("children")) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const back = `/reservas/${id}`;

  if (!id || !roomId || !checkIn || !checkOut) {
    redirect(back + "?error=" + encodeURIComponent("Faltan datos."));
  }
  if (checkOut <= checkIn) {
    redirect(
      back +
        "?error=" +
        encodeURIComponent("La salida debe ser después de la entrada.")
    );
  }

  const error = await prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!current) return "La reserva no existe.";
    if (current.status !== "CONFIRMED" && current.status !== "CHECKED_IN") {
      return "Esta reserva ya no se puede editar.";
    }

    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!room) return "La habitación no existe.";
    if (!room.active && room.id !== current.roomId) {
      return "La habitación no está disponible.";
    }

    // Igual que al crear, pero ignorando esta misma reserva
    const conflict = await tx.reservation.findFirst({
      where: {
        id: { not: id },
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

    // Misma habitación: se respeta la tarifa acordada. Otra habitación: tarifa de su tipo.
    const nightlyRate =
      roomId === current.roomId ? current.nightlyRate : room.roomType.nightlyRate;

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
    const total = nights * nightlyRate;
    const paid = current.payments.reduce((sum, p) => sum + p.amount, 0);
    if (total < paid) {
      return `El nuevo total (${cop.format(total)}) es menor a lo que ya se pagó (${cop.format(
        paid
      )}).`;
    }

    await tx.reservation.update({
      where: { id },
      data: { roomId, checkIn, checkOut, adults, children, notes, nightlyRate },
    });
    return null;
  });

  if (error) redirect(back + "?error=" + encodeURIComponent(error));

  revalidatePath("/reservas");
  revalidatePath("/pagos");
  revalidatePath("/");
  redirect("/reservas?ok=1");
}

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "text-xs text-slate-500";

export default async function EditarReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const reservationId = Number(id);
  if (!reservationId) notFound();

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, room: true, payments: true },
  });
  if (!reservation) notFound();

  const rooms = await prisma.room.findMany({
    where: { OR: [{ active: true }, { id: reservation.roomId }] },
    orderBy: { number: "asc" },
    include: { roomType: true },
  });

  const editable =
    reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN";
  const nights = Math.round(
    (reservation.checkOut.getTime() - reservation.checkIn.getTime()) / DAY_MS
  );
  const total = nights * reservation.nightlyRate;
  const paid = reservation.payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/reservas" className="text-sm text-slate-500 hover:underline">
          ← Volver a reservas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Editar reserva de {reservation.guest.firstName} {reservation.guest.lastName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Total actual: {cop.format(total)} · Pagado: {cop.format(paid)}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!editable ? (
        <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Esta reserva ya está cerrada (salió, se canceló o no llegó) y no se puede
          editar.
        </div>
      ) : (
        <form action={updateReservation} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={reservation.id} />

          <label className={`${label} sm:col-span-2`}>
            Habitación
            <select name="roomId" defaultValue={reservation.roomId} className={input}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} - {r.roomType.name} ({cop.format(r.roomType.nightlyRate)})
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Entrada
            <input
              name="checkIn"
              type="date"
              required
              defaultValue={toInput(reservation.checkIn)}
              className={input}
            />
          </label>
          <label className={label}>
            Salida
            <input
              name="checkOut"
              type="date"
              required
              defaultValue={toInput(reservation.checkOut)}
              className={input}
            />
          </label>
          <label className={label}>
            Adultos
            <input
              name="adults"
              type="number"
              min="1"
              defaultValue={reservation.adults}
              className={input}
            />
          </label>
          <label className={label}>
            Niños
            <input
              name="children"
              type="number"
              min="0"
              defaultValue={reservation.children}
              className={input}
            />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Notas
            <textarea
              name="notes"
              defaultValue={reservation.notes ?? ""}
              rows={3}
              className={input}
            />
          </label>

          <div className="sm:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700">
              Guardar cambios
            </button>
          </div>
        </form>
      )}
    </div>
  );
}