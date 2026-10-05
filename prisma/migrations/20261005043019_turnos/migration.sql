-- CreateTable
CREATE TABLE "Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openedById" INTEGER,
    "openedByName" TEXT NOT NULL,
    "startingCash" INTEGER NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "closedByName" TEXT,
    "countedCash" INTEGER,
    "expectedCash" INTEGER,
    "difference" INTEGER,
    "notes" TEXT,
    "closedAt" DATETIME
);
