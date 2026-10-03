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

function toInput(d: Date) {
  return d.toISOString().slice(0, 10);
}


const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function bogotaDateParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === "year")!.value),
    m: Number(parts.find((p) => p.type === "month")!.value) - 1,
    d: Number(parts.find((p) => p.type === "day")!.value),
  };
}

function bogotaDayRange(dateStr?: string) {
  let y: number, m: number, d: number;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yy, mm, dd] = dateStr.split("-").map(Number);
    y = yy;
    m = mm - 1;
    d = dd;
  } else {
    const parts = bogotaDateParts(new Date());
    y = parts.y;
    m = parts.m;
    d = parts.d;
  }
  const start = new Date(Date.UTC(y, m, d) + BOGOTA_OFFSET_MS);
  const end = new Date(start.getTime() + DAY_MS);
  const label = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start, end, label };
}

export default async function CajaDiariaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

    const { start, end, label } = bogotaDayRange(date);

  const [payments, sales, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      include: { reservation: { include: { guest: true, room: true } } },
      orderBy: { paidAt: "asc" },
    }),
    prisma.sale.findMany({
      where: { soldAt: { gte: start, lt: end } },
      include: { product: true },
      orderBy: { soldAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { spentAt: { gte: start, lt: end } },
      orderBy: { spentAt: "asc" },
    }),
  ]);

  const methods = ["CASH", "CARD", "TRANSFER", "OTHER"] as const;
  const byMethod = Object.fromEntries(
    methods.map((m) => {
      const fromPayments = payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);
      const fromSales = sales
        .filter((s) => s.method === m)
        .reduce((s, sale) => s + sale.quantity * sale.unitPrice, 0);
      return [m, fromPayments + fromSales];
    })
  ) as Record<(typeof methods)[number], number>;

  const totalIncome = methods.reduce((sum, m) => sum + byMethod[m], 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCash = byMethod.CASH - totalExpenses;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cierre de caja</h1>
        <form className="flex items-center gap-2">
          <label className="text-sm text-slate-500">
            Fecha:
            <input
              name="date"
              type="date"
              defaultValue={label}
              className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700">
            Ver
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {methods.map((m) => (
          <div key={m} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{methodLabel[m]}</div>
            <div className="text-xl font-semibold">{cop.format(byMethod[m])}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Total ingresos del día</div>
          <div className="text-xl font-semibold text-emerald-600">{cop.format(totalIncome)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Egresos del día</div>
          <div className="text-xl font-semibold text-red-600">{cop.format(totalExpenses)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Efectivo esperado en caja</div>
          <div className="text-xl font-semibold">{cop.format(netCash)}</div>
          <div className="text-xs text-slate-400">Efectivo cobrado menos egresos</div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Pagos de habitaciones</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Hora</th>
                <th className="px-4 py-2">Huésped</th>
                <th className="px-4 py-2">Hab.</th>
                <th className="px-4 py-2">Medio</th>
                <th className="px-4 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    No hay pagos este día.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {p.paidAt.toLocaleTimeString("es-CO", {
                      timeZone: "America/Bogota",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    {p.reservation.guest.firstName} {p.reservation.guest.lastName}
                  </td>
                  <td className="px-4 py-2">{p.reservation.room.number}</td>
                  <td className="px-4 py-2">{methodLabel[p.method]}</td>
                  <td className="px-4 py-2 font-medium">{cop.format(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Ventas de exhibidora</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Hora</th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Cant.</th>
                <th className="px-4 py-2">Medio</th>
                <th className="px-4 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    No hay ventas este día.
                  </td>
                </tr>
              )}
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {s.soldAt.toLocaleTimeString("es-CO", {
                      timeZone: "America/Bogota",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">{s.product.name}</td>
                  <td className="px-4 py-2">{s.quantity}</td>
                  <td className="px-4 py-2">{methodLabel[s.method]}</td>
                  <td className="px-4 py-2 font-medium">{cop.format(s.quantity * s.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Egresos</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Hora</th>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-slate-500">
                    No hay egresos este día.
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {e.spentAt.toLocaleTimeString("es-CO", {
                      timeZone: "America/Bogota",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">{e.concept}</td>
                  <td className="px-4 py-2 font-medium">{cop.format(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}