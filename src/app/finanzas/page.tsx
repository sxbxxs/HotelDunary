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

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function bogotaNow() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const weekdayStr = parts.find((p) => p.type === "weekday")!.value;
  const weekdayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const weekday = weekdayMap[weekdayStr.toLowerCase()] ?? 0;
  return { y, m, d, weekday };
}

function rangeStart(key: RangeKey) {
  const { y, m, d, weekday } = bogotaNow();
  const bogota = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm, dd) + BOGOTA_OFFSET_MS);

  if (key === "day") return bogota(y, m, d);
  if (key === "week") {
    const diff = weekday === 0 ? 6 : weekday - 1;
    return bogota(y, m, d - diff);
  }
  if (key === "month") return bogota(y, m, 1);
  return bogota(y, 0, 1);
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
  const start = rangeStart(key);
    const realEnd =
    key === "day"
      ? new Date(start.getTime() + DAY_MS)
      : key === "week"
      ? new Date(start.getTime() + 7 * DAY_MS)
      : key === "month"
      ? (() => {
          const { y, m } = bogotaNow();
          const nextMonth = m === 11 ? 0 : m + 1;
          const nextYear = m === 11 ? y + 1 : y;
          return new Date(Date.UTC(nextYear, nextMonth, 1) + BOGOTA_OFFSET_MS);
        })()
      : (() => {
          const { y } = bogotaNow();
          return new Date(Date.UTC(y + 1, 0, 1) + BOGOTA_OFFSET_MS);
        })();

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