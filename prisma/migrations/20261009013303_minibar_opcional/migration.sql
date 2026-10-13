-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "floor" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'CLEAN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hasMinibar" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "roomTypeId" INTEGER NOT NULL,
    CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("active", "floor", "id", "notes", "number", "roomTypeId", "status") SELECT "active", "floor", "id", "notes", "number", "roomTypeId", "status" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
