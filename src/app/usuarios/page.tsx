import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function createUser(formData: FormData) {
  "use server";
  const session = await getSession();
  if (session?.role !== "ADMIN") return;

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "RECEPCION");

  if (!username || !password || !name || !["ADMIN", "RECEPCION"].includes(role)) {
    redirect("/usuarios?error=" + encodeURIComponent("Faltan datos."));
  }
  if (password.length < 6) {
    redirect("/usuarios?error=" + encodeURIComponent("La clave debe tener al menos 6 caracteres."));
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    redirect("/usuarios?error=" + encodeURIComponent("Ese nombre de usuario ya existe."));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { username, passwordHash, name, role: role as "ADMIN" | "RECEPCION" },
  });

  await logAction("Creó usuario", `${name} (${username}), rol: ${role}`);

  revalidatePath("/usuarios");
  redirect("/usuarios?ok=1");
}

async function resetPassword(formData: FormData) {
  "use server";
  const session = await getSession();
  if (session?.role !== "ADMIN") return;

  const id = Number(formData.get("id"));
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!id || newPassword.length < 6) {
    redirect("/usuarios?error=" + encodeURIComponent("La nueva clave debe tener al menos 6 caracteres."));
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const targetUser = await prisma.user.update({ where: { id }, data: { passwordHash } });

  await logAction("Reseteó clave", `Usuario: ${targetUser.username}`);

  revalidatePath("/usuarios");
  redirect("/usuarios?ok=2");
}

async function toggleActive(formData: FormData) {
  "use server";
  const session = await getSession();
  if (session?.role !== "ADMIN") return;

  const id = Number(formData.get("id"));
  if (!id || id === session.userId) return; // no te puedes desactivar a ti mismo

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  await prisma.user.update({ where: { id }, data: { active: !user.active } });

  await logAction(
    user.active ? "Desactivó usuario" : "Activó usuario",
    `Usuario: ${user.username}`
  );

  revalidatePath("/usuarios");
}

const roleLabel: Record<string, string> = { ADMIN: "Administrador", RECEPCION: "Recepción" };

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";
const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Solo un administrador puede ver esta pantalla.
      </div>
    );
  }

  const { error, ok } = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Usuarios</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
            {ok === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Usuario creado.
        </div>
      )}
      {ok === "2" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Clave actualizada.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Nuevo usuario</h2>
        <form action={createUser} className="flex flex-wrap gap-3">
          <input name="name" placeholder="Nombre completo" required className={input} />
          <input name="username" placeholder="Usuario (para iniciar sesión)" required className={input} />
          <input name="password" type="password" placeholder="Clave (mín. 6 caracteres)" required className={input} />
          <select name="role" className={input}>
            <option value="RECEPCION">Recepción</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <button className={button}>Crear usuario</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Listado</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2">{u.username}</td>
                  <td className="px-4 py-2">{roleLabel[u.role]}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        u.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {u.active ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                                    <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {u.id !== session.userId && (
                        <form action={toggleActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className={smallButton}>
                            {u.active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      )}
                      <form action={resetPassword} className="flex gap-1">
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="newPassword"
                          placeholder="Clave nueva"
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button className={smallButton}>Resetear clave</button>
                      </form>
                    </div>
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