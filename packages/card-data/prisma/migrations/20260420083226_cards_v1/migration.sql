/*
  Warnings:

  - You are about to drop the column `setCode` on the `Card` table. All the data in the column will be lost.
  - Added the required column `attributes` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `colors` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effectText` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imagePath` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rarity` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `setId` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `setName` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceUrl` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cost" INTEGER,
    "power" INTEGER,
    "counter" INTEGER,
    "life" INTEGER,
    "colors" TEXT NOT NULL,
    "attributes" TEXT NOT NULL,
    "effectText" TEXT NOT NULL,
    "triggerText" TEXT,
    "imagePath" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Card" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE INDEX "Card_setId_idx" ON "Card"("setId");
CREATE INDEX "Card_type_idx" ON "Card"("type");
CREATE INDEX "Card_cost_idx" ON "Card"("cost");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
