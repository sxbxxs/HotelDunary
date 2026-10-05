import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHotelSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

async function saveFile(file: File, prefix: string) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(file.name) || "";
  const fileName = `${prefix}-${Date.now()}${ext}`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
  return `/uploads/${fileName}`;
}

async function updateSettings(formData: FormData) {
  "use server";
  const session = await getSession();
  if (session?.role !== "ADMIN") return;

  const hotelName = String(formData.get("hotelName") ?? "").trim() || "Mi Hotel";
  const nit = String(formData.get("nit") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const primaryColor = String(formData.get("primaryColor") ?? "#0f172a");
  const accentColor = String(formData.get("accentColor") ?? "#0ea5e9");

  const current = await getHotelSettings();

  let logoPath = current.logoPath;
  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    logoPath = await saveFile(logoFile, "logo");
  }

  await prisma.hotelSettings.update({
    where: { id: 1 },
    data: { hotelName, nit, address, phone, primaryColor, accentColor, logoPath },
  });

  await logAction("Actualizó configuración del hotel");

  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
  redirect("/configuracion?ok=1");
}

const input = "mt-1 block w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Solo un administrador puede ver esta pantalla.
      </div>
    );
  }

  const { ok } = await searchParams;
  const settings = await getHotelSettings();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Configuración del hotel</h1>

      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Configuración guardada.
        </div>
      )}

      <form action={updateSettings} className="space-y-4">
        <label className="block text-xs text-slate-500">
          Nombre del hotel
          <input name="hotelName" defaultValue={settings.hotelName} required className={input} />
        </label>
        <label className="block text-xs text-slate-500">
          NIT
          <input name="nit" defaultValue={settings.nit ?? ""} className={input} />
        </label>
        <label className="block text-xs text-slate-500">
          Dirección
          <input name="address" defaultValue={settings.address ?? ""} className={input} />
        </label>
        <label className="block text-xs text-slate-500">
          Teléfono
          <input name="phone" defaultValue={settings.phone ?? ""} className={input} />
        </label>

        <div className="flex gap-6">
          <label className="text-xs text-slate-500">
            Color principal
            <input
              name="primaryColor"
              type="color"
              defaultValue={settings.primaryColor}
              className="mt-1 block h-10 w-20 rounded-md border border-slate-300"
            />
          </label>
          <label className="text-xs text-slate-500">
            Color de acento
            <input
              name="accentColor"
              type="color"
              defaultValue={settings.accentColor}
              className="mt-1 block h-10 w-20 rounded-md border border-slate-300"
            />
          </label>
        </div>

        <label className="block text-xs text-slate-500">
          Logo del hotel (imagen)
          {settings.logoPath && (
            <img src={settings.logoPath} alt="Logo actual" className="my-2 h-16 w-auto" />
          )}
          <input name="logo" type="file" accept="image/*" className={input} />
        </label>



        <button className={button}>Guardar configuración</button>
      </form>
    </div>
  );
}