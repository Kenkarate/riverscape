-- CreateEnum
CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED', 'VOID');

-- CreateEnum
CREATE TYPE "FolioDepartment" AS ENUM ('ROOM', 'ADDON', 'SPA', 'RESTAURANT', 'MINIBAR', 'LAUNDRY', 'ACTIVITY', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "FolioChargeSource" AS ENUM ('BOOKING', 'POS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FolioPaymentDirection" AS ENUM ('PAYMENT', 'REFUND');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "folioSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Folio" (
    "id" TEXT NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "guestId" TEXT,
    "parentFolioId" TEXT,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "chargesTotal" INTEGER NOT NULL DEFAULT 0,
    "paymentsTotal" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioCharge" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "department" "FolioDepartment" NOT NULL DEFAULT 'OTHER',
    "source" "FolioChargeSource" NOT NULL DEFAULT 'POS',
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "gstRate" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "reference" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioPayment" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "direction" "FolioPaymentDirection" NOT NULL DEFAULT 'PAYMENT',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Folio_folioNumber_key" ON "Folio"("folioNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_bookingId_key" ON "Folio"("bookingId");

-- CreateIndex
CREATE INDEX "Folio_propertyId_status_idx" ON "Folio"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Folio_guestId_idx" ON "Folio"("guestId");

-- CreateIndex
CREATE INDEX "Folio_parentFolioId_idx" ON "Folio"("parentFolioId");

-- CreateIndex
CREATE INDEX "FolioCharge_folioId_voided_idx" ON "FolioCharge"("folioId", "voided");

-- CreateIndex
CREATE INDEX "FolioCharge_department_idx" ON "FolioCharge"("department");

-- CreateIndex
CREATE INDEX "FolioCharge_createdAt_idx" ON "FolioCharge"("createdAt");

-- CreateIndex
CREATE INDEX "FolioPayment_folioId_idx" ON "FolioPayment"("folioId");

-- CreateIndex
CREATE INDEX "FolioPayment_method_idx" ON "FolioPayment"("method");

-- CreateIndex
CREATE INDEX "FolioPayment_createdAt_idx" ON "FolioPayment"("createdAt");

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_parentFolioId_fkey" FOREIGN KEY ("parentFolioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
