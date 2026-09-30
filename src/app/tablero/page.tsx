import { prisma } from "@/lib/prisma";
import { reservationBalance } from "@/lib/billing";
import RoomBoard from "./RoomBoard"; 

export const dynamic = "force-dynamic";

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

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

  const cards = rooms.map((room) => {
    const reservation = room.reservations[0];
    const isOccupied = reservation?.status === "CHECKED_IN";
    const isArriving =
      reservation?.status === "CONFIRMED" &&
      reservation.checkIn.getTime() <= today.getTime();

    const balance = reservation
      ? reservationBalance({
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          nightlyRate: reservation.nightlyRate,
          payments: reservation.payments,
          consumptions: reservation.consumptions,
        })
      : 0;

    return {
      id: room.id,
      number: room.number,
      floor: room.floor ?? 0,
      roomTypeName: room.roomType.name,
      status: room.status,
      reservationId: reservation?.id ?? null,
      guestName: reservation
        ? `${reservation.guest.firstName} ${reservation.guest.lastName}`
        : "",
      isOccupied,
      isArriving,
      balance,
    };
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Tablero de habitaciones</h1>
      <p className="mb-4 text-sm text-slate-500">Estado de hoy</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {decodeURIComponent(error)}
        </div>
      )}
      {ok && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Listo.
        </div> 
      )}

      <RoomBoard rooms={cards} />
    </div>
  );
}