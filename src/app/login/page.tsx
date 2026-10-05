import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/session";
import { getHotelSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=" + encodeURIComponent("Escribe usuario y clave."));
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    redirect("/login?error=" + encodeURIComponent("Usuario o clave incorrectos."));
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    redirect("/login?error=" + encodeURIComponent("Usuario o clave incorrectos."));
  }

  await createSession({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });

  redirect("/");
}

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm w-full";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 w-full";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const { error } = await searchParams;
  const settings = await getHotelSettings();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">{settings.hotelName}</h1>
        <p className="mb-6 text-sm text-slate-500">Inicia sesión para continuar</p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form action={login} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Usuario</label>
            <input name="username" required autoFocus className={`${input} mt-1`} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Clave</label>
            <input name="password" type="password" required className={`${input} mt-1`} />
          </div>
          <button className={button}>Entrar</button>
        </form>
      </div>
    </div>
  );
}