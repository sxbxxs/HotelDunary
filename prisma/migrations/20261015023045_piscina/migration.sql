-- CreateTable
CREATE TABLE "PoolPass" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guestName" TEXT NOT NULL,
    "isGuestOfHotel" BOOLEAN NOT NULL,
    "reservationId" INTEGER,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HotelSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "hotelName" TEXT NOT NULL DEFAULT 'Mi Hotel',
    "nit" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "logoPath" TEXT,
    "introVideoPath" TEXT,
    "backgroundPath" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2A1215',
    "accentColor" TEXT NOT NULL DEFAULT '#6B1F24',
    "hasPool" BOOLEAN NOT NULL DEFAULT false,
    "poolGuestsFree" BOOLEAN NOT NULL DEFAULT true,
    "poolPrice" INTEGER NOT NULL DEFAULT 0,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "parkingCarHour" INTEGER NOT NULL DEFAULT 0,
    "parkingCarDay" INTEGER NOT NULL DEFAULT 0,
    "parkingMotoHour" INTEGER NOT NULL DEFAULT 0,
    "parkingMotoDay" INTEGER NOT NULL DEFAULT 0,
    "parkingTruckHour" INTEGER NOT NULL DEFAULT 0,
    "parkingTruckDay" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HotelSettings" ("accentColor", "address", "backgroundPath", "hotelName", "id", "introVideoPath", "logoPath", "nit", "phone", "primaryColor", "updatedAt") SELECT "accentColor", "address", "backgroundPath", "hotelName", "id", "introVideoPath", "logoPath", "nit", "phone", "primaryColor", "updatedAt" FROM "HotelSettings";
DROP TABLE "HotelSettings";
ALTER TABLE "new_HotelSettings" RENAME TO "HotelSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
