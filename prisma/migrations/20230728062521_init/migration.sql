/*
  Warnings:

  - Added the required column `email` to the `USER` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "USER" ADD COLUMN     "email" TEXT NOT NULL;
