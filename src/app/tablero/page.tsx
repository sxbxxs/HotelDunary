import { prisma } from "@/lib/prisma";
import { reservationBalance } from "@/lib/billing";

export const dynamic = "force-dynamic";

const housekeepingLabel: Record<string, string> = {
  CLEAN: "Libre",
  DIRTY: "Sucia",
  CLEANING: "En limpieza",
  MAINTENANCE: "Mantenimiento",
};

const cardClass: Record<string, string> = {
  CLEAN: "border-2 border-sky-500 bg-white",
  DIRTY: "bg-amber-400 text-amber-950",
  CLEANING: "bg-amber-200 text-amber-900",
  MAINTENANCE: "bg-slate-200 text-slate-500",
};

export default async function TableroPage() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const rooms = await prisma.room.findMany({
    where: { active: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
    include: {
      roomType: true,
      reservations: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          checkIn: { lt: tomorrow },
          checkOut: { gt: today },
        },
        include: { guest: true, payments: true, consumptions: true },
      },
    },
  });

  const floors = Array.from(new Set(rooms.map((r) => r.floor ?? 0))).sort(
    (a, b) => a - b
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Tablero de habitaciones</h1>
      <p className="mb-4 text-sm text-slate-500">Estado de hoy</p>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border-2 border-sky-500 bg-white" /> Libre
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-sky-500" /> Ocupada
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-amber-400" /> Sucia
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border-2 border-dashed border-sky-500 bg-white" />{" "}
          Llega hoy
        </span>
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-slate-200" /> Mantenimiento
        </span>
      </div>

      {floors.map((floor) => (
        <div key={floor} className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-slate-600">
            {floor === 0 ? "Sin piso asignado" : `Piso ${floor}`}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {rooms
              .filter((r) => (r.floor ?? 0) === floor)
              .map((room) => {
                const reservation = room.reservations[0];
                const isOccupied = reservation?.status === "CHECKED_IN";
                const isArriving =
                  reservation?.status === "CONFIRMED" &&
                  reservation.checkIn.getTime() <= today.getTime();

                let visualStatus = room.status;
                let cls = cardClass[room.status] ?? cardClass.CLEAN;
                if (isOccupied) cls = "bg-sky-500 text-white";
                else if (isArriving)
                  cls = "border-2 border-dashed border-sky-500 bg-white";

                const balance = reservation ? reservationBalance({
                  checkIn: reservation.checkIn,
                  checkOut: reservation.checkOut,
                  nightlyRate: reservation.nightlyRate,
                  payments: reservation.payments,
                  consumptions: reservation.consumptions,
                }) : 0;

                return (
                  <div
                    key={room.id}
                    className={`flex min-h-24 flex-col justify-between rounded-lg p-3 text-sm ${cls}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-semibold">{room.number}</span>
                      <span className="text-xs opacity-80">{room.roomType.name}</span>
                    </div>
                    <div>
                      {isOccupied || isArriving ? (
                        <>
                          <div className="truncate text-xs font-medium">
                            {isArriving ? "Llega hoy" : "Ocupada"}
                          </div>
                          <div className="truncate text-xs">
                            {reservation.guest.firstName} {reservation.guest.lastName}
                          </div>
                          {isOccupied && balance > 0 && (
                            <div className="text-xs font-medium">
                              Debe {balance.toLocaleString("es-CO")}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs font-medium">
                          {housekeepingLabel[visualStatus]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}