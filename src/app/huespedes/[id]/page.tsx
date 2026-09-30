import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
    </div>
  );
}