import { prisma } from "@/lib/prisma";

export async function getHotelSettings() {
  const settings = await prisma.hotelSettings.findUnique({ where: { id: 1 } });
  if (settings) return settings;

  // Si todavía no existe, se crea con los valores por defecto
  return prisma.hotelSettings.create({ data: { id: 1 } });
}