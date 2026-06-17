/*
  Warnings:

  - You are about to drop the column `reset_token` on the `utilisateur` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_utilisateur" (
    "id_utilisateur" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "prenom" TEXT,
    "nom" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" DATETIME
);
INSERT INTO "new_utilisateur" ("created_at", "email", "id_utilisateur", "nom", "password", "prenom", "updated_at", "user_id") SELECT "created_at", "email", "id_utilisateur", "nom", "password", "prenom", "updated_at", "user_id" FROM "utilisateur";
DROP TABLE "utilisateur";
ALTER TABLE "new_utilisateur" RENAME TO "utilisateur";
CREATE UNIQUE INDEX "utilisateur_user_id_key" ON "utilisateur"("user_id");
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
