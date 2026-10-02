import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function createExpense(formData: FormData) {
  "use server";
  const concept = String(formData.get("concept") ?? "").trim();
  const amount = Math.round(Number(formData.get("amount")));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const spentAtRaw = String(formData.get("spentAt") ?? "");

  if (!concept || !(amount > 0)) return;

  const spentAt = /^\d{4}-\d{2}-\d{2}$/.test(spentAtRaw)
    ? new Date(`${spentAtRaw}T12:00:00.000Z`)
    : new Date();

  await prisma.expense.create({ data: { concept, amount, notes, spentAt } });
  revalidatePath("/egresos");
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function toInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

export default async function EgresosPage() {
  const expenses = await prisma.expense.findMany({
    orderBy: { spentAt: "desc" },
    take: 100,
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Egresos</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Registrar gasto</h2>
        <form action={createExpense} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            Concepto
            <input name="concept" placeholder="Ej. Papel higiénico" required className={`${input} mt-1 block`} />
          </label>
          <label className="text-xs text-slate-500">
            Valor (COP)
            <input name="amount" type="number" min="1" required className={`${input} mt-1 block`} />
          </label>
          <label className="text-xs text-slate-500">
            Fecha
            <input
              name="spentAt"
              type="date"
              defaultValue={toInput(new Date())}
              className={`${input} mt-1 block`}
            />
          </label>
          <label className="text-xs text-slate-500">
            Nota (opcional)
            <input name="notes" className={`${input} mt-1 block`} />
          </label>
          <button className={button}>Registrar</button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Últimos gastos</h2>
          <span className="text-sm text-slate-500">
            Total mostrado: <strong>{cop.format(total)}</strong>
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-slate-500">
                    Todavía no hay gastos registrados.
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
                  <td className="px-4 py-2 font-medium">{e.concept}</td>
                  <td className="px-4 py-2">{cop.format(e.amount)}</td>
                  <td className="px-4 py-2 text-slate-500">{e.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}