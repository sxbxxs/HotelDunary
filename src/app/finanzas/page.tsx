import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type RangeKey = "day" | "week" | "month" | "year";

const rangeLabel: Record<RangeKey, string> = {
  day: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
};

function rangeStart(key: RangeKey, now: Date) {
  const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (key === "day") return utc(y, m, d);
  if (key === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return utc(y, m, d - diff);
  }
  if (key === "month") return utc(y, m, 1);
  return utc(y, 0, 1);
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Solo un administrador puede ver esta pantalla.
      </div>
    );
  }

  const { range } = await searchParams;
  const key: RangeKey = (["day", "week", "month", "year"] as const).includes(
    range as RangeKey
  )
    ? (range as RangeKey)
    : "day";

  const now = new Date();
  const start = rangeStart(key, now);
  const realEnd =
    key === "day"
      ? new Date(start.getTime() + DAY_MS)
      : key === "week"
      ? new Date(start.getTime() + 7 * DAY_MS)
      : key === "month"
      ? new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
      : new Date(Date.UTC(now.getFullYear() + 1, 0, 1));

  const [payments, sales, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: realEnd } },
    }),
    prisma.sale.findMany({
      where: { soldAt: { gte: start, lt: realEnd } },
    }),
    prisma.expense.findMany({
      where: { spentAt: { gte: start, lt: realEnd } },
      orderBy: { spentAt: "desc" },
    }),
  ]);

  const roomIncome = payments.reduce((sum, p) => sum + p.amount, 0);
  const deskIncome = sales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
  const totalIncome = roomIncome + deskIncome;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const net = totalIncome - totalExpenses;

  const ranges: RangeKey[] = ["day", "week", "month", "year"];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Finanzas</h1>

      <div className="flex flex-wrap gap-2">
        {ranges.map((r) => (
          
        <a    key={r}
            href={`/finanzas?range=${r}`}
            className={
              r === key
                ? "rounded-md border px-3 py-1.5 text-sm border-slate-900 bg-slate-900 text-white"
                : "rounded-md border px-3 py-1.5 text-sm border-slate-300 bg-white hover:bg-slate-100"
            }
          >
            {rangeLabel[r]}
          </a>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Ingresos por habitaciones</div>
          <div className="text-xl font-semibold text-emerald-600">
            {cop.format(roomIncome)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Ingresos por exhibidora</div>
          <div className="text-xl font-semibold text-emerald-600">
            {cop.format(deskIncome)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Egresos</div>
          <div className="text-xl font-semibold text-red-600">
            {cop.format(totalExpenses)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Balance ({rangeLabel[key]})</div>
          <div
            className={
              net >= 0
                ? "text-xl font-semibold text-emerald-600"
                : "text-xl font-semibold text-red-600"
            }
          >
            {cop.format(net)}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Egresos en este período</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-slate-500">
                    No hay egresos en este período.
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {e.spentAt.toLocaleDateString("es-CO", {
                      timeZone: "UTC",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2">{e.concept}</td>
                  <td className="px-4 py-2">{cop.format(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}