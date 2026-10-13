const DAY_MS = 24 * 60 * 60 * 1000;

type ReservationForTotal = {
  checkIn: Date;
  checkOut: Date;
  nightlyRate: number;
  payments: { amount: number }[];
  consumptions: { quantity: number; unitPrice: number }[];
};

export function nightsOf(r: { checkIn: Date; checkOut: Date }) {
  return Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS);
}

export function roomChargeOf(r: { checkIn: Date; checkOut: Date; nightlyRate: number }) {
  return nightsOf(r) * r.nightlyRate;
}

export function consumptionsTotalOf(r: { consumptions: { quantity: number; unitPrice: number }[] }) {
  return r.consumptions.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
}

export function paidOf(r: { payments: { amount: number }[] }) {
  return r.payments.reduce((sum, p) => sum + p.amount, 0);
}

// Total real de la reserva: noches + lo consumido del minibar
export function reservationTotal(r: ReservationForTotal & { lateFee?: number }) {
  return roomChargeOf(r) + consumptionsTotalOf(r) + (r.lateFee ?? 0);
}

export function reservationBalance(r: ReservationForTotal & { lateFee?: number }) {
  return reservationTotal(r) - paidOf(r);
}


// --- Check-out con hora límite y recargo por atraso ---

function checkOutDateParts(checkOut: Date) {
  return { y: checkOut.getUTCFullYear(), m: checkOut.getUTCMonth(), d: checkOut.getUTCDate() };
}

function bogotaTodayParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  return {
    y: Number(parts.find((p) => p.type === "year")!.value),
    m: Number(parts.find((p) => p.type === "month")!.value) - 1,
    d: Number(parts.find((p) => p.type === "day")!.value),
  };
}

// No se puede hacer check-out antes del día de salida programado
export function canCheckOutNow(checkOut: Date) {
  const target = checkOutDateParts(checkOut);
  const today = bogotaTodayParts();
  const key = (p: { y: number; m: number; d: number }) => p.y * 10000 + p.m * 100 + p.d;
  return key(today) >= key(target);
}

// $10.000 por cada hora después de las 2pm del día de salida
const LATE_FEE_PER_HOUR = 10000;
const CHECKOUT_CUTOFF_HOUR_UTC = 19; // 2pm Bogotá = 19:00 UTC

export function computeLateFeeNow(checkOut: Date) {
  const { y, m, d } = checkOutDateParts(checkOut);
  const cutoff = new Date(Date.UTC(y, m, d, CHECKOUT_CUTOFF_HOUR_UTC, 0, 0));
  const now = new Date();
  if (now.getTime() <= cutoff.getTime()) return 0;
  const hoursLate = Math.ceil((now.getTime() - cutoff.getTime()) / (60 * 60 * 1000));
  return hoursLate * LATE_FEE_PER_HOUR;
}


// Vista previa en vivo: mientras el huésped sigue ocupando la habitación y ya pasó
// la hora límite del día de salida, el recargo se muestra sin necesidad de hacer check-out todavía.
type ReservationForLive = ReservationForTotal & { status: string; lateFee: number };

function effectiveLateFee(r: ReservationForLive) {
  if (r.status === "CHECKED_OUT") return r.lateFee; // ya se congeló al hacer check-out
  if (r.status === "CHECKED_IN") return computeLateFeeNow(r.checkOut); // sigue hospedado, se calcula en vivo
  return 0; // reservada, cancelada o no llegó: no aplica recargo
}

export function reservationTotalLive(r: ReservationForLive) {
  return roomChargeOf(r) + consumptionsTotalOf(r) + effectiveLateFee(r);
}

export function reservationBalanceLive(r: ReservationForLive) {
  return reservationTotalLive(r) - paidOf(r);
}