-- CreateTable
CREATE TABLE "ParkingEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleType" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "color" TEXT,
    "entryAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitAt" DATETIME,
    "billingMode" TEXT,
    "amount" INTEGER,
    "method" TEXT
);
