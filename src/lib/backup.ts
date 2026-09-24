import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const PREFIX = "hotel-dunary_";
const KEEP = 30; // cuántas copias se conservan

export function backupDir() {
  const dir =
    process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours()
  )}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export function listBackups() {
  const dir = backupDir();
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(".db"))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, date: stat.mtime };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function pruneBackups() {
  const dir = backupDir();
  for (const old of listBackups().slice(KEEP)) {
    fs.rmSync(path.join(dir, old.name), { force: true });
  }
}

export async function createBackup() {
  const file = path.join(backupDir(), `${PREFIX}${stamp()}.db`);
  const sqlPath = file.replace(/\\/g, "/").replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);
  pruneBackups();
  return file;
}

// Crea una copia solo si la última tiene más de X horas
export async function backupIfNeeded(maxAgeHours = 24) {
  const last = listBackups()[0];
  const ageMs = last ? Date.now() - last.date.getTime() : Infinity;
  if (ageMs >= maxAgeHours * 60 * 60 * 1000) {
    await createBackup();
    return true;
  }
  return false;
}