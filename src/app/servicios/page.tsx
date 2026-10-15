import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getHotelSettings } from "@/lib/settings";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const vehicleTypeLabel: Record<string, string> = {
  CAR: "Carro",
  MOTORCYCLE: "Moto",
  TRUCK: "Camión",
};

async function sellPoolPass(formData: FormData) {
  "use server";
  const guestName = String(formData.get("guestName") ?? "").trim();
  const isGuestOfHotel = formData.get("isGuestOfHotel") === "on";
  const reservationId = Number(formData.get("reservationId")) || null;
  const method = String(formData.get("method") ?? "CASH");

  if (!guestName) {
    redirect("/servicios?error=" + encodeURIComponent("Escribe el nombre."));
  }

  const settings = await getHotelSettings();
  const amount = isGuestOfHotel && settings.poolGuestsFree ? 0 : settings.poolPrice;

  await prisma.poolPass.create({
    data: {
      guestName,
      isGuestOfHotel,
      reservationId,
      amount,
      method: amount > 0 ? (method as "CASH" | "CARD" | "TRANSFER" | "OTHER") : null,
    },
  });

  await logAction(
    "Vendió manilla de piscina",
    `${guestName}${amount > 0 ? ` · ${amount.toLocaleString("es-CO")}` : " · Gratis (huésped)"}`
  );

  revalidatePath("/servicios");
  redirect("/servicios?ok=1");
}

async function registerParkingEntry(formData: FormData) {
  "use server";
  const vehicleType = String(formData.get("vehicleType") ?? "CAR");
  const plate = String(formData.get("plate") ?? "").trim().toUpperCase();
  const color = String(formData.get("color") ?? "").trim() || null;

  if (!plate) {
    redirect("/servicios?error=" + encodeURIComponent("Escribe la placa."));
  }

  await prisma.parkingEntry.create({ data: { vehicleType, plate, color } });
  await logAction("Entrada al parqueadero", `${vehicleTypeLabel[vehicleType]} · ${plate}`);

  revalidatePath("/servicios");
  redirect("/servicios?ok=1");
}

async function closeParkingEntry(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const billingMode = String(formData.get("billingMode") ?? "HOUR");
  const method = String(formData.get("method") ?? "CASH");
  if (!id) return;

  const entry = await prisma.parkingEntry.findUnique({ where: { id } });
  if (!entry || entry.exitAt) {
    redirect("/servicios?error=" + encodeURIComponent("Ese vehículo ya no está en el parqueadero."));
  }

  const settings = await getHotelSettings();
  const rates: Record<string, { hour: number; day: number }> = {
    CAR: { hour: settings.parkingCarHour, day: settings.parkingCarDay },
    MOTORCYCLE: { hour: settings.parkingMotoHour, day: settings.parkingMotoDay },
    TRUCK: { hour: settings.parkingTruckHour, day: settings.parkingTruckDay },
  };
  const rate = rates[entry!.vehicleType] ?? rates.CAR;

  const now = new Date();
  const hoursParked = Math.max(1, Math.ceil((now.getTime() - entry!.entryAt.getTime()) / (60 * 60 * 1000)));
  const amount =
    billingMode === "DAY"
      ? Math.max(1, Math.ceil(hoursParked / 24)) * rate.day
      : hoursParked * rate.hour;

  await prisma.parkingEntry.update({
    where: { id },
    data: {
      exitAt: now,
      billingMode,
      amount,
      method: method as "CASH" | "CARD" | "TRANSFER" | "OTHER",
    },
  });

  await logAction(
    "Salida de parqueadero",
    `${vehicleTypeLabel[entry!.vehicleType]} · ${entry!.plate} · ${amount.toLocaleString("es-CO")}`
  );

  revalidatePath("/servicios");
  redirect("/servicios?ok=1");
}

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const settings = await getHotelSettings();

  const occupiedReservations = await prisma.reservation.findMany({
    where: { status: "CHECKED_IN" },
    include: { room: true, guest: true },
    orderBy: { room: { number: "asc" } },
  });

  const recentPasses = await prisma.poolPass.findMany({
    orderBy: { soldAt: "desc" },
    take: 10,
  });

  const activeParking = await prisma.parkingEntry.findMany({
    where: { exitAt: null },
    orderBy: { entryAt: "desc" },
  });

  const recentParking = await prisma.parkingEntry.findMany({
    where: { exitAt: { not: null } },
    orderBy: { exitAt: "desc" },
    take: 10,
  });

  const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
  const button = "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";
  const smallButton = "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold text-white drop-shadow-md">Servicios</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Registrado.
        </div>
      )}

      {!settings.hasPool && !settings.hasParking && (
        <p className="text-sm text-white/80 drop-shadow">
          El hotel no tiene piscina ni parqueadero activados en Configuración.
        </p>
      )}

      {settings.hasPool && (
        <section className="rounded-lg bg-[#F5EFE1] p-4">
          <h2 className="mb-3 text-lg font-medium text-[#2E2015]">Piscina</h2>
          <form action={sellPoolPass} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Nombre
              <input name="guestName" required className={`${input} mt-1 block`} />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="isGuestOfHotel" />
              Es huésped del hotel
            </label>
            <label className="text-xs text-slate-500">
              Si es huésped, su habitación (opcional)
              <select name="reservationId" className={`${input} mt-1 block`}>
                <option value="">Sin seleccionar</option>
                {occupiedReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    Hab. {r.room.number} · {r.guest.firstName} {r.guest.lastName}
                  </option>
                ))}
              </select>
            </label>
            <select name="method" className={input}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="OTHER">Otro</option>
            </select>
            <button className={button}>Vender manilla</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Precio: {cop.format(settings.poolPrice)}
            {settings.poolGuestsFree ? " (gratis para huéspedes)" : " (todos pagan)"}
          </p>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Huésped</th>
                  <th className="px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recentPasses.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{p.guestName}</td>
                    <td className="px-4 py-2">{p.isGuestOfHotel ? "Sí" : "No"}</td>
                    <td className="px-4 py-2">
                      {p.amount > 0 ? cop.format(p.amount) : "Gratis"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {settings.hasParking && (
        <section className="rounded-lg bg-[#F5EFE1] p-4">
          <h2 className="mb-3 text-lg font-medium text-[#2E2015]">Parqueadero</h2>
          <p className="mb-3 text-xs text-slate-500">
            Solo para vehículos que no son de huéspedes (los huéspedes ya quedan registrados al
            ocupar su habitación).
          </p>

          <form action={registerParkingEntry} className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Tipo
              <select name="vehicleType" className={`${input} mt-1 block`}>
                <option value="CAR">Carro</option>
                <option value="MOTORCYCLE">Moto</option>
                <option value="TRUCK">Camión</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Placa
              <input name="plate" required className={`${input} mt-1 block w-28 uppercase`} />
            </label>
            <label className="text-xs text-slate-500">
              Color (opcional)
              <input name="color" className={`${input} mt-1 block w-28`} />
            </label>
            <button className={button}>Registrar entrada</button>
          </form>

          <h3 className="mb-2 text-sm font-medium text-[#2E2015]">Vehículos en el parqueadero</h3>
          <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Placa</th>
                  <th className="px-4 py-2">Entrada</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeParking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-slate-500">
                      No hay vehículos de pago en el parqueadero.
                    </td>
                  </tr>
                )}
                {activeParking.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{vehicleTypeLabel[p.vehicleType]}</td>
                    <td className="px-4 py-2">{p.plate}</td>
                    <td className="px-4 py-2">
                      {p.entryAt.toLocaleString("es-CO", {
                        timeZone: "America/Bogota",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <form action={closeParkingEntry} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="billingMode" className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                          <option value="HOUR">Por hora</option>
                          <option value="DAY">Por día</option>
                        </select>
                        <select name="method" className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                          <option value="CASH">Efectivo</option>
                          <option value="CARD">Tarjeta</option>
                          <option value="TRANSFER">Transferencia</option>
                          <option value="OTHER">Otro</option>
                        </select>
                        <button className={smallButton}>Cobrar y sacar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 text-sm font-medium text-[#2E2015]">Últimas salidas</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Placa</th>
                  <th className="px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recentParking.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-slate-500">
                      Todavía no hay salidas registradas.
                    </td>
                  </tr>
                )}
                {recentParking.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{vehicleTypeLabel[p.vehicleType]}</td>
                    <td className="px-4 py-2">{p.plate}</td>
                    <td className="px-4 py-2">{cop.format(p.amount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}