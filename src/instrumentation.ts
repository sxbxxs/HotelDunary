export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { backupTimer?: NodeJS.Timeout };
  if (g.backupTimer) return; // evita duplicar el temporizador al recargar

  const { backupIfNeeded } = await import("@/lib/backup");

  const run = async () => {
    try {
      const created = await backupIfNeeded(24);
      console.log(
        created
          ? "[respaldo] Copia automática creada."
          : "[respaldo] La última copia es reciente, no hace falta otra."
      );
    } catch (e) {
      console.error("[respaldo] Falló la copia automática:", e);
    }
  };

  run(); // al arrancar
  g.backupTimer = setInterval(run, 60 * 60 * 1000); // y luego cada hora
}