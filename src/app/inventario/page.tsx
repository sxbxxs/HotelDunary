import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CATEGORIES = ["MINIBAR", "EXHIBIDORA_BEBIDAS", "EXHIBIDORA_COMIDA"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryLabel: Record<Category, string> = {
  MINIBAR: "Minibar (habitaciones)",
  EXHIBIDORA_BEBIDAS: "Exhibidora de bebidas",
  EXHIBIDORA_COMIDA: "Exhibidora de comida",
};

async function createProduct(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));
  const category = String(formData.get("category")) as Category;
  if (!name || price < 0 || !CATEGORIES.includes(category)) return;

  const exists = await prisma.product.findUnique({ where: { name } });
  if (exists) return;

  const product = await prisma.product.create({ data: { name, price, category } });

  if (category === "MINIBAR") {
    // Empieza en 0 en todas las habitaciones; se reabastece por habitación
    const rooms = await prisma.room.findMany({ select: { id: true } });
    await prisma.roomStock.createMany({
      data: rooms.map((r) => ({ roomId: r.id, productId: product.id, quantity: 0 })),
    });
  } else {
    await prisma.frontDeskStock.create({
      data: { productId: product.id, quantity: 0 },
    });
  }

  revalidatePath("/inventario");
}

async function restockDesk(formData: FormData) {
  "use server";
  const productId = Number(formData.get("productId"));
  const add = Number(formData.get("add"));
  if (!productId || !(add > 0)) return;

  await prisma.frontDeskStock.update({
    where: { productId },
    data: { quantity: { increment: add } },
  });
  revalidatePath("/inventario");
}

async function restockRoom(formData: FormData) {
  "use server";
  const roomId = Number(formData.get("roomId"));
  const productId = Number(formData.get("productId"));
  const add = Number(formData.get("add"));
  if (!roomId || !productId || !(add > 0)) return;

  await prisma.roomStock.update({
    where: { roomId_productId: { roomId, productId } },
    data: { quantity: { increment: add } },
  });
  revalidatePath("/inventario");
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const input = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const button =
  "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700";
const smallInput =
  "w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs";
const smallButton =
  "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100";

export default async function InventarioPage() {
  const [products, rooms] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { deskStock: true },
    }),
    prisma.room.findMany({
      orderBy: { number: "asc" },
      include: { roomStocks: { include: { product: true } } },
    }),
  ]);

  const deskProducts = products.filter((p) => p.category !== "MINIBAR");
  const minibarProducts = products.filter((p) => p.category === "MINIBAR");

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Inventario</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Nuevo producto</h2>
        <form action={createProduct} className="flex flex-wrap gap-3">
          <input name="name" placeholder="Nombre (ej. Chitos)" required className={input} />
          <input name="price" type="number" min="0" placeholder="Precio (COP)" required className={input} />
          <select name="category" required className={input}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
          <button className={button}>Agregar producto</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Exhibidoras de recepción</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Grupo</th>
                <th className="px-4 py-2">Precio</th>
                <th className="px-4 py-2">Existencias</th>
                <th className="px-4 py-2">Reabastecer</th>
              </tr>
            </thead>
            <tbody>
              {deskProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-slate-500">
                    Todavía no hay productos de exhibidora.
                  </td>
                </tr>
              )}
              {deskProducts.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">{categoryLabel[p.category]}</td>
                  <td className="px-4 py-2">{cop.format(p.price)}</td>
                  <td className="px-4 py-2">{p.deskStock?.quantity ?? 0}</td>
                  <td className="px-4 py-2">
                    <form action={restockDesk} className="flex gap-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <input name="add" type="number" min="1" placeholder="Cant." className={smallInput} />
                      <button className={smallButton}>Agregar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Canastas de minibar por habitación</h2>
        {minibarProducts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay productos de minibar.
          </p>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room.id} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 font-medium">
                  Habitación {room.number}
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Producto</th>
                      <th className="px-4 py-2">Existencias</th>
                      <th className="px-4 py-2">Reabastecer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.roomStocks
                      .filter((rs) => rs.product.active)
                      .map((rs) => (
                        <tr key={rs.productId} className="border-t border-slate-100">
                          <td className="px-4 py-2">{rs.product.name}</td>
                          <td className="px-4 py-2">{rs.quantity}</td>
                          <td className="px-4 py-2">
                            <form action={restockRoom} className="flex gap-2">
                              <input type="hidden" name="roomId" value={room.id} />
                              <input type="hidden" name="productId" value={rs.productId} />
                              <input name="add" type="number" min="1" placeholder="Cant." className={smallInput} />
                              <button className={smallButton}>Agregar</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}