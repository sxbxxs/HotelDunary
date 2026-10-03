import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Solo un administrador puede ver esta pantalla.
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Auditoría</h1>
      <p className="text-sm text-slate-500">Últimas 200 acciones registradas en el sistema.</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Acción</th>
              <th className="px-4 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-slate-500">
                  Todavía no hay registros.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap">
                  {log.createdAt.toLocaleString("es-CO", {
                    timeZone: "America/Bogota",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-2 font-medium">{log.username}</td>
                <td className="px-4 py-2">{log.action}</td>
                <td className="px-4 py-2 text-slate-500">{log.details ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}