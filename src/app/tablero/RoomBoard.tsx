"use client";

import { useState } from "react";
import {
  checkInReservation,
  checkOutReservation,
  markRoomClean,
  addConsumptionFromBoard,
  registerPaymentFromBoard,
  sellFromDesk,
  occupyNow,
  reserveForLater,
  findGuestByDocument,
  createGuestInline,
  type Guest,
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

type DeskProduct = { productId: number; name: string; price: number; quantity: number };

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

export default function RoomBoard({
  rooms,
  deskProducts,
}: {
  rooms: RoomCard[];
  deskProducts: DeskProduct[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const matches =
    term.length > 0
      ? rooms.filter((r) => r.guestName.toLowerCase().includes(term))
      : [];

  const [filter, setFilter] = useState<"all" | "free" | "occupied" | "dirty" | "arriving">("all");
  const filteredRooms = rooms.filter((r) => {
    if (filter === "free") return !r.isOccupied && !r.isArriving && r.status === "CLEAN";
    if (filter === "occupied") return r.isOccupied;
    if (filter === "dirty") return !r.isOccupied && !r.isArriving && r.status === "DIRTY";
    if (filter === "arriving") return r.isArriving;
    return true;
  });

  const floors = Array.from(new Set(filteredRooms.map((r) => r.floor))).sort(
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
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            filter === "all"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white hover:bg-slate-100"
          }`}
        >
          Todas ({rooms.length})
        </button>
        <button
          onClick={() => setFilter("free")}
          className={`rounded-md border-2 px-3 py-1.5 text-sm ${
            filter === "free"
              ? "border-sky-500 bg-sky-500 text-white"
              : "border-sky-500 bg-white text-sky-700 hover:bg-sky-50"
          }`}
        >
          Libres ({rooms.filter((r) => !r.isOccupied && !r.isArriving && r.status === "CLEAN").length})
        </button>
        <button
          onClick={() => setFilter("occupied")}
          className={`rounded-md border border-sky-500 bg-sky-500 px-3 py-1.5 text-sm text-white ${
            filter === "occupied" ? "ring-2 ring-offset-2 ring-sky-700" : ""
          }`}
        >
          Ocupadas ({rooms.filter((r) => r.isOccupied).length})
        </button>
        <button
          onClick={() => setFilter("dirty")}
          className={`rounded-md border border-amber-400 bg-amber-400 px-3 py-1.5 text-sm text-amber-950 ${
            filter === "dirty" ? "ring-2 ring-offset-2 ring-amber-600" : ""
          }`}
        >
          Sucias ({rooms.filter((r) => !r.isOccupied && !r.isArriving && r.status === "DIRTY").length})
        </button>
        <button
          onClick={() => setFilter("arriving")}
          className={`rounded-md border-2 border-dashed px-3 py-1.5 text-sm ${
            filter === "arriving"
              ? "border-sky-500 bg-sky-100 text-sky-800"
              : "border-sky-500 bg-white text-sky-700 hover:bg-sky-50"
          }`}
        >
          Reservadas hoy ({rooms.filter((r) => r.isArriving).length})
        </button>
      </div>

      {deskProducts.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-600">
            Venta en recepción (exhibidoras)
          </h2>
          <form action={sellFromDesk} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              Producto
              <select name="productId" required className={`${input} mt-1 block`}>
                {deskProducts.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} ({p.quantity} disp., {p.price.toLocaleString("es-CO")})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Cantidad
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
                className={`${input} mt-1 block w-20`}
              />
            </label>
            <select name="method" className={input}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="OTHER">Otro</option>
            </select>
            <button className={button}>Vender</button>
          </form>
        </div>
      )}

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar huésped por nombre"
          className={`${input} w-full max-w-sm`}
        />
        {term.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {matches.length === 0 ? (
              <span className="text-sm text-slate-500">Sin resultados.</span>
            ) : (
              matches.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={smallButton}
                >
                  Hab. {r.number} · {r.guestName}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {floors.map((floor) => (
        <div key={floor} className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-slate-600">
            {floor === 0 ? "Sin piso asignado" : `Piso ${floor}`}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {filteredRooms
              .filter((r) => r.floor === floor)
              .map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedId(room.id)}
                  className={`flex min-h-24 flex-col justify-between rounded-lg p-3 text-left text-sm transition ${cardClass(
                    room
                  )} ${
                    selectedId === room.id || matches.some((m) => m.id === room.id)
                      ? "ring-2 ring-offset-2 ring-slate-900"
                      : ""
                  }`}
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedId(null)}
              className="absolute right-4 top-4 text-sm text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>

            <div className="mb-3 pr-8">
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
              <FreeRoomPanel roomId={selected.id} />
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
        </div>
      )}
    </div>
  );
}

function FreeRoomPanel({ roomId }: { roomId: number }) {
  const [tab, setTab] = useState<"occupy" | "reserve">("occupy");
  const [docNumber, setDocNumber] = useState("");
  const [searched, setSearched] = useState(false);
  const [foundGuest, setFoundGuest] = useState<Guest | null>(null);
  const [showNewGuestForm, setShowNewGuestForm] = useState(false);
  const [chosenGuest, setChosenGuest] = useState<Guest | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    setSearching(true);
    const guest = await findGuestByDocument(docNumber);
    setFoundGuest(guest);
    setSearched(true);
    setShowNewGuestForm(!guest);
    setSearching(false);
  }

    async function handleCreateGuest(formData: FormData) {
    const result = await createGuestInline({
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      documentType: String(formData.get("documentType") ?? "CC"),
      documentNumber: docNumber,
      originCity: String(formData.get("originCity") ?? ""),
      nationality: String(formData.get("nationality") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    });
    if (result.guest) setChosenGuest(result.guest);
  }

  if (chosenGuest) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Huésped: <span className="font-medium">{chosenGuest.firstName} {chosenGuest.lastName}</span>{" "}
          <button
            onClick={() => setChosenGuest(null)}
            className="text-xs text-slate-400 underline hover:text-slate-700"
          >
            cambiar
          </button>
        </p>

        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab("occupy")}
            className={`px-3 py-2 text-sm ${
              tab === "occupy"
                ? "border-b-2 border-slate-900 font-medium"
                : "text-slate-500"
            }`}
          >
            Ocupar ahora
          </button>
          <button
            onClick={() => setTab("reserve")}
            className={`px-3 py-2 text-sm ${
              tab === "reserve"
                ? "border-b-2 border-slate-900 font-medium"
                : "text-slate-500"
            }`}
          >
            Reservar para otra fecha
          </button>
        </div>

        {tab === "occupy" ? (
          <form action={occupyNow} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="guestId" value={chosenGuest.id} />
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
            <button className={button}>Ocupar habitación</button>
          </form>
        ) : (
          <form action={reserveForLater} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="guestId" value={chosenGuest.id} />
            <label className="text-xs text-slate-500">
              Entrada
              <input name="checkIn" type="date" required className={`${input} mt-1 block`} />
            </label>
            <label className="text-xs text-slate-500">
              Salida
              <input name="checkOut" type="date" required className={`${input} mt-1 block`} />
            </label>
            <label className="text-xs text-slate-500">
              Adultos
              <input
                name="adults"
                type="number"
                min="1"
                defaultValue="1"
                className={`${input} mt-1 block w-16`}
              />
            </label>
            <label className="text-xs text-slate-500">
              Niños
              <input
                name="children"
                type="number"
                min="0"
                defaultValue="0"
                className={`${input} mt-1 block w-16`}
              />
            </label>
            <button className={button}>Reservar</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={docNumber}
          onChange={(e) => {
            setDocNumber(e.target.value);
            setSearched(false);
            setFoundGuest(null);
            setShowNewGuestForm(false);
          }}
          placeholder="Número de documento del huésped"
          className={`${input} flex-1`}
        />
        <button onClick={handleSearch} disabled={!docNumber || searching} className={smallButton}>
          {searching ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {searched && foundGuest && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-2">
            Encontrado: <span className="font-medium">{foundGuest.firstName} {foundGuest.lastName}</span>
          </p>
          <button onClick={() => setChosenGuest(foundGuest)} className={button}>
            Usar este huésped
          </button>
        </div>
      )}

            {searched && !foundGuest && showNewGuestForm && (
        <form action={handleCreateGuest} className="space-y-2 rounded-md border border-slate-200 p-3">
          <p className="text-sm text-slate-600">No existe. Regístralo:</p>
          <div className="flex flex-wrap gap-2">
            <input name="firstName" placeholder="Nombres" required className={input} />
            <input name="lastName" placeholder="Apellidos" required className={input} />
            <select name="documentType" className={input}>
              <option value="CC">Cédula (CC)</option>
              <option value="CE">Cédula de extranjería (CE)</option>
              <option value="PASAPORTE">Pasaporte</option>
              <option value="TI">Tarjeta de identidad (TI)</option>
              <option value="OTRO">Otro</option>
            </select>
            <input name="originCity" placeholder="Lugar de procedencia" className={input} />
            <input name="nationality" placeholder="Nacionalidad" className={input} />
            <input name="phone" placeholder="Teléfono" className={input} />
            <button className={button}>Registrar y continuar</button>
          </div>
        </form>
      )}
    </div>
  );
}