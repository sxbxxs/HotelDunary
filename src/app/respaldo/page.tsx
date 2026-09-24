import { redirect } from "next/navigation";
import { backupDir, createBackup, listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";

async function runBackup() {
  "use server";
  let error: string | null = null;

  try {
    await createBackup();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido.";
  }

  if (error) redirect("/respaldo?error=" + encodeURIComponent(error));
  redirect("/respaldo?ok=1");
}

const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

export default async function RespaldoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const dir = backupDir();
  const backups = listBackups().slice(0, 20);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Copias de seguridad</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudo crear la copia: {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Copia creada.
        </div>
      )}

      <section className="space-y-3">
        <p className="text-sm text-slate-600">
          Las copias se guardan en: <strong>{dir}</strong>
        </p>
        <form action={runBackup}>
          <button className={button}>Crear copia ahora</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Últimas copias</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Archivo</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Tamaño</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-slate-500">
                    Todavía no hay copias.
                  </td>
                </tr>
              )}
              {backups.map((b) => (
                <tr key={b.name} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{b.name}</td>
                  <td className="px-4 py-2">
                    {b.date.toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-2">{Math.round(b.size / 1024)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}