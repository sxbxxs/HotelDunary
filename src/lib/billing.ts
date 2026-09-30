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
export function reservationTotal(r: ReservationForTotal) {
  return roomChargeOf(r) + consumptionsTotalOf(r);
}

export function reservationBalance(r: ReservationForTotal) {
  return reservationTotal(r) - paidOf(r);
}