"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function revalidateAll() {
  revalidatePath("/tablero");
  revalidatePath("/reservas");
  revalidatePath("/pagos");
  revalidatePath("/hoy");
  revalidatePath("/");
}

export async function quickReserve(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  const name = String(formData.get("guestName") ?? "").trim();
  const document = String(formData.get("guestDocument") ?? "").trim();
  const nights = Number(formData.get("nights")) || 1;

  if (!roomId || !name || !document || nights < 1) {
    redirect("/tablero?error=" + encodeURIComponent("Faltan datos para reservar."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!room || !room.active) return "La habitación no está disponible.";

    const now = new Date();
    const checkIn = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);

    const conflict = await tx.reservation.findFirst({
      where: {
        roomId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (conflict) return "Esa habitación ya tiene una reserva que se cruza con hoy.";

    // Busca al huésped por nombre completo + documento; si no existe, lo crea con datos mínimos
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || firstName;

    let guest = await tx.guest.findFirst({
      where: { documentNumber: document },
    });
    if (!guest) {
      guest = await tx.guest.create({
        data: {
          firstName,
          lastName,
          documentType: "CC",
          documentNumber: document,
        },
      });
    }

    await tx.reservation.create({
      data: {
        roomId,
        guestId: guest.id,
        checkIn,
        checkOut,
        status: "CHECKED_IN",
        nightlyRate: room.roomType.nightlyRate,
      },
    });
    return null;
  });

  if (error) redirect("/tablero?error=" + encodeURIComponent(error));
  revalidateAll();
  redirect("/tablero?ok=1");
}

export async function checkInReservation(formData: FormData) {
  const reservationId = Number(formData.get("reservationId"));
  if (!reservationId) return;
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CHECKED_IN" },
  });
  revalidateAll();
}

export async function checkOutReservation(formData: FormData) {
  const reservationId = Number(formData.get("reservationId"));
  if (!reservationId) return;

  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "CHECKED_OUT" },
  });
  await prisma.room.update({
    where: { id: reservation.roomId },
    data: { status: "DIRTY" },
  });
  revalidateAll();
}

export async function markRoomClean(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  if (!roomId) return;
  await prisma.room.update({ where: { id: roomId }, data: { status: "CLEAN" } });
  revalidateAll();
}