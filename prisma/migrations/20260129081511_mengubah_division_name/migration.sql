/*
  Warnings:

  - You are about to drop the column `division_id` on the `users` table. All the data in the column will be lost.
  - Added the required column `division_code` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_division_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "division_id",
ADD COLUMN     "division_code" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_division_code_fkey" FOREIGN KEY ("division_code") REFERENCES "divisions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
