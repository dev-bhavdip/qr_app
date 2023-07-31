-- CreateTable
CREATE TABLE "qr_codes" (
    "id" SERIAL NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "scans" INTEGER NOT NULL,
    "createdAt" DATE NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);
