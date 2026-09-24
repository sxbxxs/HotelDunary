import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const methodLabel: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

function nightsOf(r: { checkIn: Date; checkOut: Date }) {
  return Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS);
}

async function createPayment(formData: FormData) {
  "use server";
  const reservationId = Number(formData.get("reservationId"));
  const amount = Math.round(Number(formData.get("amount")));
  const method = String(formData.get("method"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!reservationId || !(amount > 0) || !(method in methodLabel)) {
    redirect("/pagos?error=" + encodeURIComponent("Faltan datos o el valor no es válido."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation || reservation.status === "CANCELLED") {
      return "La reserva no existe o está cancelada.";
    }

    const paid = await tx.payment.aggregate({
      where: { reservationId },
      _sum: { amount: true },
    });
    const balance =
      nightsOf(reservation) * reservation.nightlyRate - (paid._sum.amount ?? 0);

    if (amount > balance) {
      return `El pago supera el saldo pendiente (${cop.format(balance)}).`;
    }

    await tx.payment.create({
      data: {
        reservationId,
        amount,
        method: method as "CASH" | "CARD" | "TRANSFER" | "OTHER",
        notes,
      },
    });
    return null;
  });

  if (error) redirect("/pagos?error=" + encodeURIComponent(error));

  revalidatePath("/pagos");
  redirect("/pagos?ok=1");
}

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const [reservations, recentPayments] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { checkIn: "desc" },
      take: 100,
      include: { guest: true, room: true, payments: true },
    }),
    prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 20,
      include: { reservation: { include: { guest: true, room: true } } },
    }),
  ]);

  const rows = reservations.map((r) => {
    const total = nightsOf(r) * r.nightlyRate;
    const paid = r.payments.reduce((sum, p) => sum + p.amount, 0);
    return { ...r, total, paid, balance: total - paid };
  });

  const pending = rows.filter((r) => r.balance > 0);
  const totalPending = pending.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Caja y pagos</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Pago registrado.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Registrar pago</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay reservas con saldo pendiente.
          </p>
        ) : (
          <form action={createPayment} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Reserva
              <select name="reservationId" required className={`${input} mt-1 block`}>
                {pending.map((r) => (
                  <option key={r.id} value={r.id}>
                    Hab. {r.room.number} - {r.guest.firstName} {r.guest.lastName} (debe{" "}
                    {cop.format(r.balance)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Valor (COP)
              <input name="amount" type="number" min="1" required className={`${input} mt-1 block`} />
            </label>
            <label className="text-xs text-slate-500">
              Medio de pago
              <select name="method" className={`${input} mt-1 block`}>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Nota (opcional)
              <input name="notes" className={`${input} mt-1 block`} />
            </label>
            <button className={button}>Registrar pago</button>
          </form>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Saldos por reserva</h2>
          <span className="text-sm text-slate-500">
            Pendiente total: <strong>{cop.format(totalPending)}</strong>
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Pagado</th>
                <th className="px-4 py-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    Todavía no hay reservas.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">
                    {r.guest.firstName} {r.guest.lastName}
                  </td>
                  <td className="px-4 py-2">{r.room.number}</td>
                  <td className="px-4 py-2">{cop.format(r.total)}</td>
                  <td className="px-4 py-2">{cop.format(r.paid)}</td>
                  <td
                    className={`px-4 py-2 font-medium ${
                      r.balance > 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {r.balance > 0 ? cop.format(r.balance) : "Al día"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Últimos pagos</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Medio</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-slate-500">
                    Todavía no hay pagos.
                  </td>
                </tr>
              )}
              {recentPayments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {p.paidAt.toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    {p.reservation.guest.firstName} {p.reservation.guest.lastName}
                  </td>
                  <td className="px-4 py-2">{p.reservation.room.number}</td>
                  <td className="px-4 py-2">{methodLabel[p.method]}</td>
                  <td className="px-4 py-2 font-medium">{cop.format(p.amount)}</td>
                  <td className="px-4 py-2 text-slate-500">{p.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}