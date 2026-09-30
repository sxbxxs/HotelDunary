import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function createGuest(formData: FormData) {
  "use server";
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "").trim();
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;

  if (!firstName || !lastName || !documentType || !documentNumber) {
    redirect("/huespedes?error=" + encodeURIComponent("Faltan datos obligatorios."));
  }

  const exists = await prisma.guest.findUnique({
    where: { documentType_documentNumber: { documentType, documentNumber } },
  });
  if (exists) {
    redirect(
      "/huespedes?error=" +
        encodeURIComponent(
          `Ya existe un huésped con ese documento: ${exists.firstName} ${exists.lastName}.`
        )
    );
  }

  await prisma.guest.create({
    data: {
      firstName,
      lastName,
      documentType,
      documentNumber,
      nationality,
      phone,
      email,
    },
  });

  revalidatePath("/huespedes");
  redirect("/huespedes?ok=1");
}

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";
const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export default async function HuespedesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; ok?: string }>;
}) {
  const { q, error, ok } = await searchParams;
  const search = q?.trim();

  const guests = await prisma.guest.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { documentNumber: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Huéspedes</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Huésped guardado.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Nuevo huésped</h2>
        <form action={createGuest} className="flex flex-wrap gap-3">
          <input name="firstName" placeholder="Nombres" required className={input} />
          <input name="lastName" placeholder="Apellidos" required className={input} />
          <select name="documentType" required className={input}>
            <option value="CC">Cédula (CC)</option>
            <option value="CE">Cédula de extranjería (CE)</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="TI">Tarjeta de identidad (TI)</option>
            <option value="OTRO">Otro</option>
          </select>
          <input name="documentNumber" placeholder="Número de documento" required className={input} />
          <input name="nationality" placeholder="Nacionalidad" className={input} />
          <input name="phone" placeholder="Teléfono" className={input} />
          <input name="email" type="email" placeholder="Correo" className={input} />
          <button className={button}>Guardar huésped</button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Listado</h2>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={search ?? ""}
              placeholder="Buscar por nombre o documento"
              className={input}
            />
            <button className={button}>Buscar</button>
          </form>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Documento</th>
                <th className="px-4 py-2">Nacionalidad</th>
                <th className="px-4 py-2">Teléfono</th>
                <th className="px-4 py-2">Correo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-slate-500">
                    {search
                      ? "No se encontraron huéspedes."
                      : "Todavía no hay huéspedes registrados."}
                  </td>
                </tr>
              )}
              {guests.map((g) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">
                    {g.firstName} {g.lastName}
                  </td>
                  <td className="px-4 py-2">
                    {g.documentType} {g.documentNumber}
                  </td>
                  <td className="px-4 py-2">{g.nationality ?? "-"}</td>
                  <td className="px-4 py-2">{g.phone ?? "-"}</td>
                  <td className="px-4 py-2">{g.email ?? "-"}</td>
                  <td className="px-4 py-2">
                    <Link href={`/huespedes/${g.id}`} className={smallButton}>
                      Editar
                    </Link>
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