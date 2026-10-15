-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reservation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "nightlyRate" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancelReason" TEXT,
    "lateFee" INTEGER NOT NULL DEFAULT 0,
    "hasVehicle" BOOLEAN NOT NULL DEFAULT false,
    "vehiclePlate" TEXT,
    "vehicleColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "roomId" INTEGER NOT NULL,
    "guestId" INTEGER NOT NULL,
    CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("adults", "cancelReason", "checkIn", "checkOut", "children", "createdAt", "guestId", "id", "lateFee", "nightlyRate", "notes", "roomId", "status", "updatedAt") SELECT "adults", "cancelReason", "checkIn", "checkOut", "children", "createdAt", "guestId", "id", "lateFee", "nightlyRate", "notes", "roomId", "status", "updatedAt" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
CREATE INDEX "Reservation_roomId_checkIn_checkOut_idx" ON "Reservation"("roomId", "checkIn", "checkOut");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
