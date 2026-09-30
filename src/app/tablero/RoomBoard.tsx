"use client";
import { useState } from "react";
import {
  quickReserve,
  checkInReservation,
  checkOutReservation,
  markRoomClean,
  addConsumptionFromBoard,
  registerPaymentFromBoard,
} from "./actions";

type RoomCard = {
  id: number;
  number: string;
  floor: number;
  roomTypeName: string;
  status: "CLEAN" | "DIRTY" | "CLEANING" | "MAINTENANCE";
  reservationId: number | null;
  guestName: string;
  isOccupied: boolean;
  isArriving: boolean;
  balance: number;
  total: number;
  products: { productId: number; name: string; price: number; quantity: number }[];
};

const housekeepingLabel: Record<string, string> = {
  CLEAN: "Libre",
  DIRTY: "Sucia",
  CLEANING: "En limpieza",
  MAINTENANCE: "Mantenimiento",
};

const button =
  "rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700";
const smallButton =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100";
const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export default function RoomBoard({ rooms }: { rooms: RoomCard[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort(
    (a, b) => a - b
  );

  function cardClass(r: RoomCard) {
    if (r.isOccupied) return "bg-sky-500 text-white";
    if (r.isArriving) return "border-2 border-dashed border-sky-500 bg-white";
    if (r.status === "DIRTY") return "bg-amber-400 text-amber-950";
    if (r.status === "CLEANING") return "bg-amber-200 text-amber-900";
    if (r.status === "MAINTENANCE") return "bg-slate-200 text-slate-500";
    return "border-2 border-sky-500 bg-white";
  }

  return (
    <div>
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
              .filter((r) => r.floor === floor)
              .map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedId(room.id)}
                  className={`flex min-h-24 flex-col justify-between rounded-lg p-3 text-left text-sm transition ${cardClass(
                    room
                  )} ${selectedId === room.id ? "ring-2 ring-offset-2 ring-slate-900" : ""}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-semibold">{room.number}</span>
                    <span className="text-xs opacity-80">{room.roomTypeName}</span>
                  </div>
                  <div>
                    {room.isOccupied || room.isArriving ? (
                      <>
                        <div className="truncate text-xs font-medium">
                          {room.isArriving ? "Llega hoy" : "Ocupada"}
                        </div>
                        <div className="truncate text-xs">{room.guestName}</div>
                        {room.isOccupied && room.balance > 0 && (
                          <div className="text-xs font-medium">
                            Debe {room.balance.toLocaleString("es-CO")}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs font-medium">
                        {housekeepingLabel[room.status]}
                      </div>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {!selected ? (
          <p className="text-sm text-slate-500">
            Toca una habitación para ver sus opciones.
          </p>
        ) : (
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-lg font-medium">
                Habitación {selected.number} · {selected.roomTypeName}
              </h3>
              <span className="text-sm text-slate-500">
                {selected.isOccupied
                  ? "Ocupada"
                  : selected.isArriving
                  ? "Llega hoy"
                  : housekeepingLabel[selected.status]}
              </span>
            </div>

            {(selected.isOccupied || selected.isArriving) && (
              <p className="mb-3 text-sm">
                Huésped: <span className="font-medium">{selected.guestName}</span>
                  {selected.isOccupied && (
                  <>
                    {" "}
                    · Total: {selected.total.toLocaleString("es-CO")} · Saldo:{" "}
                    <span
                      className={
                        selected.balance > 0
                          ? "font-medium text-red-600"
                          : "font-medium text-emerald-600"
                      }
                    >
                      {selected.balance > 0
                        ? selected.balance.toLocaleString("es-CO")
                        : "Al día"}
                    </span>
                  </>
                )}
              </p>
            )}

            {!selected.isOccupied && !selected.isArriving && selected.status === "CLEAN" && (
              <form action={quickReserve} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="roomId" value={selected.id} />
                <label className="text-xs text-slate-500">
                  Nombre del huésped
                  <input name="guestName" required className={`${input} mt-1 block`} />
                </label>
                <label className="text-xs text-slate-500">
                  Cédula
                  <input name="guestDocument" required className={`${input} mt-1 block`} />
                </label>
                <label className="text-xs text-slate-500">
                  Noches
                  <input
                    name="nights"
                    type="number"
                    min="1"
                    defaultValue="1"
                    className={`${input} mt-1 block w-20`}
                  />
                </label>
                <button className={button}>Reservar y hacer check-in</button>
              </form>
            )}

            {selected.isArriving && selected.reservationId && (
              <form action={checkInReservation}>
                <input type="hidden" name="reservationId" value={selected.reservationId} />
                <button className={button}>Hacer check-in</button>
              </form>
            )}

                        {selected.isOccupied && selected.reservationId && (
              <div className="space-y-4">
                {selected.products.length > 0 && (
                  <form
                    action={addConsumptionFromBoard}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="reservationId" value={selected.reservationId} />
                    <label className="text-xs text-slate-500">
                      Consumo del minibar
                      <select name="productId" required className={`${input} mt-1 block`}>
                        {selected.products.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {p.name} ({p.quantity} disp., {p.price.toLocaleString("es-CO")})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-500">
                      Cant.
                      <input
                        name="quantity"
                        type="number"
                        min="1"
                        defaultValue="1"
                        className={`${input} mt-1 block w-16`}
                      />
                    </label>
                    <button className={smallButton}>Registrar consumo</button>
                  </form>
                )}

                {selected.balance > 0 && (
                  <form
                    action={registerPaymentFromBoard}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="reservationId" value={selected.reservationId} />
                    <label className="text-xs text-slate-500">
                      Registrar pago
                      <input
                        name="amount"
                        type="number"
                        min="1"
                        placeholder="Valor"
                        required
                        className={`${input} mt-1 block w-28`}
                      />
                    </label>
                    <select name="method" className={input}>
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="OTHER">Otro</option>
                    </select>
                    <button className={smallButton}>Registrar pago</button>
                  </form>
                )}

                <form action={checkOutReservation}>
                  <input type="hidden" name="reservationId" value={selected.reservationId} />
                  <button className={button}>Hacer check-out</button>
                </form>
              </div>
            )}

            {!selected.isOccupied && !selected.isArriving && selected.status !== "CLEAN" && (
              <form action={markRoomClean}>
                <input type="hidden" name="roomId" value={selected.id} />
                <button className={button}>Marcar como limpia</button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}