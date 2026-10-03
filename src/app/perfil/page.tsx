import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function changePassword(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next || !confirm) {
    redirect("/perfil?error=" + encodeURIComponent("Completa todos los campos."));
  }
  if (next.length < 6) {
    redirect("/perfil?error=" + encodeURIComponent("La nueva clave debe tener al menos 6 caracteres."));
  }
  if (next !== confirm) {
    redirect("/perfil?error=" + encodeURIComponent("La confirmación no coincide."));
  }

  const user = await prisma.user.findUnique({ where: { id: session!.userId } });
  if (!user) redirect("/login");

  const ok = await bcrypt.compare(current, user!.passwordHash);
  if (!ok) {
    redirect("/perfil?error=" + encodeURIComponent("Tu clave actual no es correcta."));
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.user.update({ where: { id: user!.id }, data: { passwordHash } });

  redirect("/perfil?ok=1");
}

const input = "mt-1 block w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { error, ok } = await searchParams;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <p className="text-sm text-slate-500">{session.name} · {session.username}</p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Clave actualizada.
        </div>
      )}

      <form action={changePassword} className="space-y-3">
        <label className="text-xs text-slate-500">
          Clave actual
          <input name="current" type="password" required className={input} />
        </label>
        <label className="text-xs text-slate-500">
          Nueva clave
          <input name="next" type="password" required className={input} />
        </label>
        <label className="text-xs text-slate-500">
          Confirmar nueva clave
          <input name="confirm" type="password" required className={input} />
        </label>
        <button className={button}>Cambiar clave</button>
      </form>
    </div>
  );
}