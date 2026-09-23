import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const input =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";

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

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Número</th>
                <th className="px-4 py-2">Piso</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Tarifa</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-slate-500">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}