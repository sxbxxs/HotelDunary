import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { reservationBalance } from "@/lib/billing";

export const dynamic = "force-dynamic";

async function updateGuest(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "").trim();
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const back = `/huespedes/${id}`;

  if (!id || !firstName || !lastName || !documentType || !documentNumber) {
    redirect(back + "?error=" + encodeURIComponent("Faltan datos obligatorios."));
  }

  // Que el documento no lo tenga ya otro huésped
  const duplicate = await prisma.guest.findFirst({
    where: { documentType, documentNumber, NOT: { id } },
  });
  if (duplicate) {
    redirect(
      back +
        "?error=" +
        encodeURIComponent(
          `Ese documento ya pertenece a ${duplicate.firstName} ${duplicate.lastName}.`
        )
    );
  }

  await prisma.guest.update({
    where: { id },
    data: {
      firstName,
      lastName,
      documentType,
      documentNumber,
      nationality,
      phone,
      email,
      notes,
    },
  });

  revalidatePath("/huespedes");
  revalidatePath("/reservas");
  redirect("/huespedes");
}

const input = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "text-xs text-slate-500";

export default async function EditarHuespedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const guestId = Number(id);
  if (!guestId) notFound();

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) notFound();
  
  const reservations = await prisma.reservation.findMany({
    where: { guestId },
    orderBy: { checkIn: "desc" },
    include: { room: true, payments: true, consumptions: true },
  });

  const statusLabel: Record<string, { text: string; className: string }> = {
    CONFIRMED: { text: "Reservada", className: "bg-sky-100 text-sky-800" },
    CHECKED_IN: { text: "Hospedado", className: "bg-emerald-100 text-emerald-800" },
    CHECKED_OUT: { text: "Salió", className: "bg-slate-200 text-slate-700" },
    CANCELLED: { text: "Cancelada", className: "bg-red-100 text-red-800" },
    NO_SHOW: { text: "No llegó", className: "bg-amber-100 text-amber-800" },
  };

  const cop = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

  const totalStays = reservations.filter((r) => r.status === "CHECKED_OUT").length;
  const pendingDebt = reservations.reduce((sum, r) => {
    if (r.status === "CANCELLED" || r.status === "NO_SHOW") return sum;
    const b = reservationBalance(r);
    return sum + (b > 0 ? b : 0);
  }, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/huespedes" className="text-sm text-slate-500 hover:underline">
          ← Volver a huéspedes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Editar: {guest.firstName} {guest.lastName}
        </h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form action={updateGuest} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={guest.id} />

        <label className={label}>
          Nombres
          <input name="firstName" defaultValue={guest.firstName} required className={input} />
        </label>
        <label className={label}>
          Apellidos
          <input name="lastName" defaultValue={guest.lastName} required className={input} />
        </label>
        <label className={label}>
          Tipo de documento
          <select name="documentType" defaultValue={guest.documentType} className={input}>
            <option value="CC">Cédula (CC)</option>
            <option value="CE">Cédula de extranjería (CE)</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="TI">Tarjeta de identidad (TI)</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className={label}>
          Número de documento
          <input name="documentNumber" defaultValue={guest.documentNumber} required className={input} />
        </label>
        <label className={label}>
          Nacionalidad
          <input name="nationality" defaultValue={guest.nationality ?? ""} className={input} />
        </label>
        <label className={label}>
          Teléfono
          <input name="phone" defaultValue={guest.phone ?? ""} className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Correo
          <input name="email" type="email" defaultValue={guest.email ?? ""} className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Notas
          <textarea name="notes" defaultValue={guest.notes ?? ""} rows={3} className={input} />
        </label>

                <div className="sm:col-span-2">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700">
            Guardar cambios
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Historial de estadías</h2>
          <span className="text-sm text-slate-500">
            {totalStays} estadía{totalStays !== 1 ? "s" : ""} completada
            {totalStays !== 1 ? "s" : ""}
            {pendingDebt > 0 && (
              <>
                {" "}
                · Deuda pendiente:{" "}
                <span className="font-medium text-red-600">{cop.format(pendingDebt)}</span>
              </>
            )}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Entrada</th>
                <th className="px-4 py-2">Salida</th>
                <th className="px-4 py-2">Habitación</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    Este huésped no tiene reservas todavía.
                  </td>
                </tr>
              )}
              {reservations.map((r) => {
                const balance = reservationBalance(r);
                const st = statusLabel[r.status];
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      {r.checkIn.toLocaleDateString("es-CO", {
                        timeZone: "UTC",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      {r.checkOut.toLocaleDateString("es-CO", {
                        timeZone: "UTC",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2">{r.room.number}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${st.className}`}>
                        {st.text}
                      </span>
                    </td>
                      <td className="px-4 py-2">
                      {r.status === "CANCELLED" || r.status === "NO_SHOW" ? (
                        <span className="text-slate-400">—</span>
                      ) : balance > 0 ? (
                        <span className="font-medium text-red-600">{cop.format(balance)}</span>
                      ) : (
                        <span className="text-emerald-600">Al día</span>
                      )}
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