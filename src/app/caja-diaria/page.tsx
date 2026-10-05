import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

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

async function openShift(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/login");

  const startingCash = Math.round(Number(formData.get("startingCash")));
  if (!(startingCash >= 0)) {
    redirect("/caja-diaria?error=" + encodeURIComponent("Ingresa un valor válido."));
  }

  const open = await prisma.shift.findFirst({ where: { closedAt: null } });
  if (open) {
    redirect("/caja-diaria?error=" + encodeURIComponent("Ya hay un turno abierto."));
  }

  await prisma.shift.create({
    data: { openedById: session!.userId, openedByName: session!.name, startingCash },
  });

  await logAction("Abrió turno", `Caja inicial: ${cop.format(startingCash)}`);

  revalidatePath("/caja-diaria");
  redirect("/caja-diaria?ok=1");
}

async function closeShift(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/login");

  const id = Number(formData.get("id"));
  const countedCash = Math.round(Number(formData.get("countedCash")));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || !(countedCash >= 0)) {
    redirect("/caja-diaria?error=" + encodeURIComponent("Ingresa un valor válido."));
  }

  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift || shift.closedAt) {
    redirect("/caja-diaria?error=" + encodeURIComponent("Ese turno ya no está abierto."));
  }

  const [payments, sales, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { method: "CASH", paidAt: { gte: shift!.openedAt } },
    }),
    prisma.sale.findMany({
      where: { method: "CASH", soldAt: { gte: shift!.openedAt } },
    }),
    prisma.expense.findMany({
      where: { spentAt: { gte: shift!.openedAt } },
    }),
  ]);

  const cashIncome =
    payments.reduce((s, p) => s + p.amount, 0) +
    sales.reduce((s, sale) => s + sale.quantity * sale.unitPrice, 0);
  const cashExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const expectedCash = shift!.startingCash + cashIncome - cashExpenses;
  const difference = countedCash - expectedCash;

  await prisma.shift.update({
    where: { id },
    data: {
      closedById: session!.userId,
      closedByName: session!.name,
      countedCash,
      expectedCash,
      difference,
      notes,
      closedAt: new Date(),
    },
  });

  await logAction(
    "Cerró turno",
    `Esperado: ${cop.format(expectedCash)} · Contado: ${cop.format(countedCash)} · Diferencia: ${cop.format(difference)}`
  );

  revalidatePath("/caja-diaria");
  redirect("/caja-diaria?ok=2");
}

export default async function CambioDeTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const openShiftRecord = await prisma.shift.findFirst({
    where: { closedAt: null },
    orderBy: { openedAt: "desc" },
  });

  const recentShifts = await prisma.shift.findMany({
    where: { closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
    take: 10,
  });

  let preview: {
    payments: { method: string; amount: number }[];
    sales: { method: string; quantity: number; unitPrice: number }[];
    expenses: { amount: number }[];
    cashIncome: number;
    cashExpenses: number;
    expectedCash: number;
  } | null = null;

  if (openShiftRecord) {
    const [payments, sales, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { paidAt: { gte: openShiftRecord.openedAt } },
        select: { method: true, amount: true },
      }),
      prisma.sale.findMany({
        where: { soldAt: { gte: openShiftRecord.openedAt } },
        select: { method: true, quantity: true, unitPrice: true },
      }),
      prisma.expense.findMany({
        where: { spentAt: { gte: openShiftRecord.openedAt } },
        select: { amount: true },
      }),
    ]);

    const cashIncome =
      payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0) +
      sales
        .filter((s) => s.method === "CASH")
        .reduce((s, sale) => s + sale.quantity * sale.unitPrice, 0);
    const cashExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    preview = {
      payments,
      sales,
      expenses,
      cashIncome,
      cashExpenses,
      expectedCash: openShiftRecord.startingCash + cashIncome - cashExpenses,
    };
  }

  const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
  const button = "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Cambio de turno</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {ok === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Turno abierto.
        </div>
      )}
      {ok === "2" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Turno cerrado.
        </div>
      )}

      {!openShiftRecord ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-600">
            No hay un turno abierto. Cuenta el efectivo que hay en caja ahora mismo y abre tu turno.
          </p>
          <form action={openShift} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Efectivo en caja al empezar
              <input
                name="startingCash"
                type="number"
                min="0"
                required
                className={`${input} mt-1 block`}
              />
            </label>
            <button className={button}>Abrir turno</button>
          </form>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Turno abierto por <span className="font-medium">{openShiftRecord.openedByName}</span> ·{" "}
              {openShiftRecord.openedAt.toLocaleString("es-CO", {
                timeZone: "America/Bogota",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Caja inicial: <span className="font-medium">{cop.format(openShiftRecord.startingCash)}</span>
            </p>
          </div>

          {preview && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm text-slate-500">Ingresos en efectivo</div>
                <div className="text-xl font-semibold text-emerald-600">
                  {cop.format(preview.cashIncome)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm text-slate-500">Egresos del turno</div>
                <div className="text-xl font-semibold text-red-600">
                  {cop.format(preview.cashExpenses)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm text-slate-500">Efectivo esperado en caja</div>
                <div className="text-xl font-semibold">{cop.format(preview.expectedCash)}</div>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-medium">Cerrar turno y entregar</h2>
            <form action={closeShift} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={openShiftRecord.id} />
              <label className="text-xs text-slate-500">
                Efectivo contado ahora
                <input
                  name="countedCash"
                  type="number"
                  min="0"
                  required
                  className={`${input} mt-1 block`}
                />
              </label>
              <label className="text-xs text-slate-500">
                Nota (opcional)
                <input name="notes" className={`${input} mt-1 block`} />
              </label>
              <button className={button}>Cerrar mi turno</button>
            </form>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Últimos turnos cerrados</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Abrió</th>
                <th className="px-4 py-2">Cerró</th>
                <th className="px-4 py-2">Esperado</th>
                <th className="px-4 py-2">Contado</th>
                <th className="px-4 py-2">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {recentShifts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    Todavía no hay turnos cerrados.
                  </td>
                </tr>
              )}
              {recentShifts.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {s.openedByName} ·{" "}
                    {s.openedAt.toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    {s.closedByName} ·{" "}
                    {s.closedAt?.toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-2">{cop.format(s.expectedCash ?? 0)}</td>
                  <td className="px-4 py-2">{cop.format(s.countedCash ?? 0)}</td>
                  <td
                    className={`px-4 py-2 font-medium ${
                      (s.difference ?? 0) === 0
                        ? "text-emerald-600"
                        : (s.difference ?? 0) > 0
                        ? "text-sky-600"
                        : "text-red-600"
                    }`}
                  >
                    {cop.format(s.difference ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}