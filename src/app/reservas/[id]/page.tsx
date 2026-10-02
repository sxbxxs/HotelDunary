import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { reservationBalance, reservationTotal, nightsOf } from "@/lib/billing";

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

async function addConsumption(formData: FormData) {
  "use server";
  const reservationId = Number(formData.get("reservationId"));
  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity"));

  const back = `/reservas/${reservationId}`;

  if (!reservationId || !productId || !(quantity > 0)) {
    redirect(back + "?error=" + encodeURIComponent("Elige un producto y una cantidad válida."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) return "La reserva no existe.";
    if (reservation.status !== "CHECKED_IN") {
      return "Solo se puede registrar consumo mientras el huésped está hospedado.";
    }

    const stock = await tx.roomStock.findUnique({
      where: { roomId_productId: { roomId: reservation.roomId, productId } },
      include: { product: true },
    });
    if (!stock) return "Ese producto no está en la canasta de esta habitación.";
    if (stock.quantity < quantity) {
      return `Solo quedan ${stock.quantity} unidades de ${stock.product.name} en esta habitación.`;
    }

    await tx.roomStock.update({
      where: { roomId_productId: { roomId: reservation.roomId, productId } },
      data: { quantity: { decrement: quantity } },
    });

    await tx.consumption.create({
      data: {
        reservationId,
        productId,
        quantity,
        unitPrice: stock.product.price,
      },
    });
    return null;
  });

  if (error) redirect(back + "?error=" + encodeURIComponent(error));

  revalidatePath(`/reservas/${reservationId}`);
  revalidatePath("/reservas");
  revalidatePath("/pagos");
  revalidatePath("/hoy");
  revalidatePath("/inventario");
  redirect(back + "?ok=1");
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


async function cancelReservation(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const cancelReason = String(formData.get("cancelReason") ?? "").trim() || null;
  if (!id) return;

  await prisma.reservation.update({
    where: { id },
    data: { status: "CANCELLED", cancelReason },
  });

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
    include: {
      guest: true,
      room: true,
      payments: true,
      consumptions: { include: { product: true }, orderBy: { consumedAt: "desc" } },
    },
  });
  if (!reservation) notFound();

  const roomStock = await prisma.roomStock.findMany({
    where: { roomId: reservation.roomId, quantity: { gt: 0 } },
    include: { product: true },
  });

  const rooms = await prisma.room.findMany({
    where: { OR: [{ active: true }, { id: reservation.roomId }] },
    orderBy: { number: "asc" },
    include: { roomType: true },
  });

  const editable =
    reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN";

  const nights = nightsOf(reservation);
  const total = reservationTotal(reservation);
  const paid = reservation.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = reservationBalance(reservation);

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
          Total actual: {cop.format(total)} · Pagado: {cop.format(paid)} · Saldo:{" "}
          <span className={balance > 0 ? "text-red-600" : "text-emerald-600"}>
            {balance > 0 ? cop.format(balance) : "Al día"}
          </span>
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {reservation.status === "CHECKED_IN" && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Consumo del minibar</h2>
          {roomStock.length === 0 ? (
            <p className="text-sm text-slate-500">
              Esta habitación no tiene productos disponibles en su canasta.
            </p>
          ) : (
            <form action={addConsumption} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="reservationId" value={reservation.id} />
              <label className={label}>
                Producto
                <select name="productId" required className={`${input} mt-1 block`}>
                  {roomStock.map((s) => (
                    <option key={s.productId} value={s.productId}>
                      {s.product.name} ({s.quantity} disponibles, {cop.format(s.product.price)})
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Cantidad
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  className={`${input} mt-1 block w-20`}
                />
              </label>
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700">
                Registrar consumo
              </button>
            </form>
          )}

          {reservation.consumptions.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="px-4 py-2">Producto</th>
                    <th className="px-4 py-2">Cantidad</th>
                    <th className="px-4 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.consumptions.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{c.product.name}</td>
                      <td className="px-4 py-2">{c.quantity}</td>
                      <td className="px-4 py-2">{cop.format(c.quantity * c.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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

      {editable && (
        <form
          action={cancelReservation}
          className="flex flex-wrap items-end gap-3 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <input type="hidden" name="id" value={reservation.id} />
          <label className="text-xs text-red-700">
            Cancelar esta reserva, motivo:
            <input
              name="cancelReason"
              placeholder="Ej. El cliente no llegó"
              className="mt-1 block w-64 rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
            Cancelar reserva
          </button>
        </form>
      )}
    </div>
  );
}