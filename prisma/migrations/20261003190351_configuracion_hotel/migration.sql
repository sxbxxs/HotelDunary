-- CreateTable
CREATE TABLE "HotelSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "hotelName" TEXT NOT NULL DEFAULT 'Mi Hotel',
    "nit" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "logoPath" TEXT,
    "introVideoPath" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "accentColor" TEXT NOT NULL DEFAULT '#0ea5e9',
    "updatedAt" DATETIME NOT NULL
);
