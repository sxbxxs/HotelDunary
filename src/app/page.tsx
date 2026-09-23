const DAYS = 14;

const rooms = [
  { id: 1, number: "101", type: "Sencilla" },
  { id: 2, number: "102", type: "Doble" },
  { id: 3, number: "103", type: "Doble" },
  { id: 4, number: "201", type: "Familiar" },
  { id: 5, number: "202", type: "Suite" },
];

// from: días desde hoy en que entra (negativo = ya entró). El día de salida queda libre.
const reservations = [
  { roomId: 1, guest: "María Pérez", from: -1, nights: 3, status: "CHECKED_IN" },
  { roomId: 2, guest: "Carlos Gómez", from: 2, nights: 2, status: "CONFIRMED" },
  { roomId: 3, guest: "Laura Rincón", from: 0, nights: 4, status: "CHECKED_IN" },
  { roomId: 4, guest: "Familia Torres", from: 1, nights: 5, status: "CONFIRMED" },
  { roomId: 1, guest: "Andrés Silva", from: 5, nights: 2, status: "CONFIRMED" },
];

const colors: Record<string, string> = {
  CHECKED_IN: "bg-emerald-500 text-white",
  CONFIRMED: "bg-sky-500 text-white",
};

export default function CalendarioPage() {
  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Calendario de ocupación</h1>
      <p className="mb-4 text-sm text-slate-500">
        Próximos {DAYS} días (datos de prueba)
      </p>

      <div className="mb-4 flex gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500" /> Hospedado
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-sky-500" /> Reservada
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-32 border-b border-r border-slate-200 bg-white px-3 py-2 text-left">
                Habitación
              </th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className={`min-w-20 border-b border-slate-200 px-2 py-2 font-medium ${
                    i === 0 ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="capitalize text-slate-500">
                    {d.toLocaleDateString("es-CO", { weekday: "short" })}
                  </div>
                  <div>{d.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-3">
                  <div className="font-medium">{room.number}</div>
                  <div className="text-slate-500">{room.type}</div>
                </td>
                {days.map((_, i) => {
                  const res = reservations.find(
                    (r) =>
                      r.roomId === room.id &&
                      i >= r.from &&
                      i < r.from + r.nights
                  );
                  const isFirst = res && i === Math.max(res.from, 0);
                  return (
                    <td
                      key={i}
                      className={`h-14 border-b border-slate-100 px-1 ${
                        res ? colors[res.status] : ""
                      }`}
                    >
                      {isFirst ? res.guest : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}