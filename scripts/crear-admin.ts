import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const username = "admin";
  const password = "cambiar123";

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    console.log("Ya existe un usuario 'admin'. No se creó ninguno nuevo.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      passwordHash,
      name: "Administrador",
      role: "ADMIN",
    },
  });

  console.log("Usuario creado:");
  console.log("  Usuario: admin");
  console.log("  Clave:   cambiar123");
  console.log("Cámbiala apenas inicies sesión.");
}

main().finally(() => process.exit());