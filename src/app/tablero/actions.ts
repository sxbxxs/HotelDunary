"use server";

import type { Guest } from "@/generated/prisma/client";
export type { Guest };
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

export async function occupyNow(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  const guestId = Number(formData.get("guestId"));
  const nights = Number(formData.get("nights")) || 1;

  if (!roomId || !guestId || nights < 1) {
    redirect("/tablero?error=" + encodeURIComponent("Faltan datos para ocupar la habitación."));
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

    const guest = await tx.guest.findUnique({ where: { id: guestId } });
    if (!guest) return "El huésped no existe.";

    await tx.reservation.create({
      data: {
        roomId,
        guestId,
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

export async function reserveForLater(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  const guestId = Number(formData.get("guestId"));
  const checkInRaw = String(formData.get("checkIn") ?? "");
  const checkOutRaw = String(formData.get("checkOut") ?? "");
  const adults = Number(formData.get("adults")) || 1;
  const children = Number(formData.get("children")) || 0;

  const checkIn = /^\d{4}-\d{2}-\d{2}$/.test(checkInRaw)
    ? new Date(`${checkInRaw}T00:00:00.000Z`)
    : null;
  const checkOut = /^\d{4}-\d{2}-\d{2}$/.test(checkOutRaw)
    ? new Date(`${checkOutRaw}T00:00:00.000Z`)
    : null;

  if (!roomId || !guestId || !checkIn || !checkOut) {
    redirect("/tablero?error=" + encodeURIComponent("Faltan datos para reservar."));
  }
  if (checkOut <= checkIn) {
    redirect("/tablero?error=" + encodeURIComponent("La salida debe ser después de la entrada."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!room || !room.active) return "La habitación no está disponible.";

    const conflict = await tx.reservation.findFirst({
      where: {
        roomId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (conflict) return "Esa habitación ya tiene una reserva que se cruza con esas fechas.";

    const guest = await tx.guest.findUnique({ where: { id: guestId } });
    if (!guest) return "El huésped no existe.";

    await tx.reservation.create({
      data: {
        roomId,
        guestId,
        checkIn,
        checkOut,
        adults,
        children,
        status: "CONFIRMED",
        nightlyRate: room.roomType.nightlyRate,
      },
    });
    return null;
  });

  if (error) redirect("/tablero?error=" + encodeURIComponent(error));
  revalidateAll();
  redirect("/tablero?ok=1");
}

export async function quickReserve(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestDocument = String(formData.get("guestDocument") ?? "").trim();
  const nights = Number(formData.get("nights")) || 1;

  if (!roomId || !guestName || !guestDocument || nights < 1) {
    redirect(
      "/tablero?error=" +
        encodeURIComponent("Faltan datos para hacer la reserva.")
    );
  }

  const error = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });

    if (!room || !room.active) {
      return "La habitación no está disponible.";
    }

    if (room.status !== "CLEAN") {
      return "La habitación no está limpia y disponible.";
    }

    const now = new Date();

    const checkIn = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    );

    const checkOut = new Date(
      checkIn.getTime() + nights * 24 * 60 * 60 * 1000
    );

    const conflict = await tx.reservation.findFirst({
      where: {
        roomId,
        status: {
          notIn: ["CANCELLED", "NO_SHOW"],
        },
        checkIn: {
          lt: checkOut,
        },
        checkOut: {
          gt: checkIn,
        },
      },
    });

    if (conflict) {
      return "Esa habitación ya tiene una reserva que se cruza con hoy.";
    }

    let guest = await tx.guest.findFirst({
      where: {
        documentNumber: guestDocument,
      },
    });

    if (!guest) {
      const nameParts = guestName.split(/\s+/);

      const firstName = nameParts.shift() ?? "";
      const lastName = nameParts.join(" ") || firstName;

      guest = await tx.guest.create({
        data: {
          firstName,
          lastName,
          documentType: "CC",
          documentNumber: guestDocument,
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

  if (error) {
    redirect(
      "/tablero?error=" +
        encodeURIComponent(error)
    );
  }

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

export async function addConsumptionFromBoard(formData: FormData) {
  const reservationId = Number(formData.get("reservationId"));
  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity"));

  if (!reservationId || !productId || !(quantity > 0)) {
    redirect("/tablero?error=" + encodeURIComponent("Elige un producto y una cantidad válida."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) return "La reserva no existe.";
    if (reservation.status !== "CHECKED_IN") {
      return "Solo se puede registrar consumo mientras el huésped está hospedado.";
    }

    const stock = await tx.roomStock.findUnique({
      where: { roomId_productId: { roomId: reservation.roomId, productId } },
      include: { product: true },
    });
    if (!stock) return "Ese producto no está en la canasta de esta habitación.";
    if (stock.quantity < quantity) {
      return `Solo quedan ${stock.quantity} unidades de ${stock.product.name} en esta habitación.`;
    }

    await tx.roomStock.update({
      where: { roomId_productId: { roomId: reservation.roomId, productId } },
      data: { quantity: { decrement: quantity } },
    });

    await tx.consumption.create({
      data: { reservationId, productId, quantity, unitPrice: stock.product.price },
    });
    return null;
  });

  if (error) redirect("/tablero?error=" + encodeURIComponent(error));
  revalidateAll();
  revalidatePath("/inventario");
  redirect("/tablero?ok=1");
}

export async function registerPaymentFromBoard(formData: FormData) {
  const reservationId = Number(formData.get("reservationId"));
  const amount = Math.round(Number(formData.get("amount")));
  const method = String(formData.get("method"));

  if (!reservationId || !(amount > 0) || !["CASH", "CARD", "TRANSFER", "OTHER"].includes(method)) {
    redirect("/tablero?error=" + encodeURIComponent("Ingresa un valor válido."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { payments: true, consumptions: true },
    });
    if (!reservation) return "La reserva no existe.";

    const nights = Math.round(
      (reservation.checkOut.getTime() - reservation.checkIn.getTime()) / (24 * 60 * 60 * 1000)
    );
    const consumed = reservation.consumptions.reduce(
      (sum, c) => sum + c.quantity * c.unitPrice,
      0
    );
    const total = nights * reservation.nightlyRate + consumed;
    const paid = reservation.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = total - paid;

    if (amount > balance) return `El pago supera el saldo pendiente (${balance}).`;

    await tx.payment.create({
      data: { reservationId, amount, method: method as "CASH" | "CARD" | "TRANSFER" | "OTHER" },
    });
    return null;
  });

  if (error) redirect("/tablero?error=" + encodeURIComponent(error));
  revalidateAll();
  redirect("/tablero?ok=1");
}

export async function sellFromDesk(formData: FormData) {
  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity"));
  const method = String(formData.get("method"));

  if (!productId || !(quantity > 0) || !["CASH", "CARD", "TRANSFER", "OTHER"].includes(method)) {
    redirect("/tablero?error=" + encodeURIComponent("Elige un producto y una cantidad válida."));
  }

  const error = await prisma.$transaction(async (tx) => {
    const stock = await tx.frontDeskStock.findUnique({
      where: { productId },
      include: { product: true },
    });
    if (!stock) return "Ese producto no existe en la exhibidora.";
    if (stock.quantity < quantity) {
      return `Solo quedan ${stock.quantity} unidades de ${stock.product.name}.`;
    }

    await tx.frontDeskStock.update({
      where: { productId },
      data: { quantity: { decrement: quantity } },
    });

    await tx.sale.create({
      data: {
        productId,
        quantity,
        unitPrice: stock.product.price,
        method: method as "CASH" | "CARD" | "TRANSFER" | "OTHER",
      },
    });
    return null;
  });

  if (error) redirect("/tablero?error=" + encodeURIComponent(error));
  revalidatePath("/tablero");
  revalidatePath("/inventario");
  redirect("/tablero?ok=1");
}

export async function findGuestByDocument(documentNumber: string) {
  const doc = documentNumber.trim();
  if (!doc) return null;
  return prisma.guest.findFirst({ where: { documentNumber: doc } });
}

export async function createGuestInline(data: {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
}) {
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  const documentType = data.documentType.trim();
  const documentNumber = data.documentNumber.trim();

  if (!firstName || !lastName || !documentType || !documentNumber) {
    return { error: "Faltan datos del huésped." as const };
  }

  const exists = await prisma.guest.findFirst({ where: { documentNumber } });
  if (exists) return { guest: exists };

  const guest = await prisma.guest.create({
    data: { firstName, lastName, documentType, documentNumber },
  });
  return { guest };
}