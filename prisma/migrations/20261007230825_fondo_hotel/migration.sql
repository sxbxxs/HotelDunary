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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HotelSettings" ("accentColor", "address", "hotelName", "id", "introVideoPath", "logoPath", "nit", "phone", "primaryColor", "updatedAt") SELECT "accentColor", "address", "hotelName", "id", "introVideoPath", "logoPath", "nit", "phone", "primaryColor", "updatedAt" FROM "HotelSettings";
DROP TABLE "HotelSettings";
ALTER TABLE "new_HotelSettings" RENAME TO "HotelSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
