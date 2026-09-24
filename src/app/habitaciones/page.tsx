import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["CLEAN", "DIRTY", "CLEANING", "MAINTENANCE"] as const;
type Status = (typeof STATUSES)[number];

const statusLabel: Record<Status, string> = {
  CLEAN: "Limpia",
  DIRTY: "Sucia",
  CLEANING: "En limpieza",
  MAINTENANCE: "Mantenimiento",
};

async function createRoomType(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity"));
  const nightlyRate = Number(formData.get("nightlyRate"));
  if (!name || capacity < 1 || nightlyRate < 0) return;

  const exists = await prisma.roomType.findUnique({ where: { name } });
  if (!exists) {
    await prisma.roomType.create({ data: { name, capacity, nightlyRate } });
  }
  revalidatePath("/habitaciones");
}

async function createRoom(formData: FormData) {
  "use server";
  const number = String(formData.get("number") ?? "").trim();
  const floor = Number(formData.get("floor")) || null;
  const roomTypeId = Number(formData.get("roomTypeId"));
  if (!number || !roomTypeId) return;

  const exists = await prisma.room.findUnique({ where: { number } });
  if (!exists) {
    await prisma.room.create({ data: { number, floor, roomTypeId } });
  }
  revalidatePath("/habitaciones");
}

async function updateRoomStatus(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as Status;
  if (!id || !STATUSES.includes(status)) return;

  await prisma.room.update({ where: { id }, data: { status } });
  revalidatePath("/habitaciones");
  revalidatePath("/");
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const input =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";
const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export default async function HabitacionesPage() {
  const roomTypes = await prisma.roomType.findMany({ orderBy: { name: "asc" } });
  const rooms = await prisma.room.findMany({
    orderBy: { number: "asc" },
    include: { roomType: true },
  });

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Habitaciones</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Tipos de habitación</h2>
        <form action={createRoomType} className="mb-4 flex flex-wrap gap-3">
          <input name="name" placeholder="Nombre (ej. Doble)" required className={input} />
          <input name="capacity" type="number" min="1" placeholder="Capacidad" required className={input} />
          <input name="nightlyRate" type="number" min="0" placeholder="Tarifa por noche (COP)" required className={input} />
          <button className={button}>Agregar tipo</button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Capacidad</th>
                <th className="px-4 py-2">Tarifa por noche</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-slate-500">
                    Todavía no hay tipos de habitación.
                  </td>
                </tr>
              )}
              {roomTypes.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t.name}</td>
                  <td className="px-4 py-2">{t.capacity}</td>
                  <td className="px-4 py-2">{cop.format(t.nightlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Habitaciones</h2>
        {roomTypes.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">
            Primero agrega al menos un tipo de habitación.
          </p>
        ) : (
          <form action={createRoom} className="mb-4 flex flex-wrap gap-3">
            <input name="number" placeholder="Número (ej. 101)" required className={input} />
            <input name="floor" type="number" placeholder="Piso" className={input} />
            <select name="roomTypeId" required className={input}>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className={button}>Agregar habitación</button>
          </form>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Número</th>
                <th className="px-4 py-2">Piso</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Tarifa</th>
                <th className="px-4 py-2">Estado de limpieza</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    Todavía no hay habitaciones.
                  </td>
                </tr>
              )}
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{r.number}</td>
                  <td className="px-4 py-2">{r.floor ?? "-"}</td>
                  <td className="px-4 py-2">{r.roomType.name}</td>
                  <td className="px-4 py-2">{cop.format(r.roomType.nightlyRate)}</td>
                  <td className="px-4 py-2">
                    <form action={updateRoomStatus} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <select
                        name="status"
                        defaultValue={r.status}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel[s]}
                          </option>
                        ))}
                      </select>
                      <button className={smallButton}>Guardar</button>
                    </form>
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