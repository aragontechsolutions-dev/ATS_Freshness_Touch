-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('STANDARD', 'DEEP', 'MOVE_IN_OUT', 'POST_CONSTRUCTION', 'AIRBNB_TURNOVER', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ServiceZone" AS ENUM ('A', 'B', 'C', 'D', 'OUT_OF_RANGE');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'es');

-- CreateEnum
CREATE TYPE "QuoteSource" AS ENUM ('WEB', 'ADMIN', 'PHONE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'COMPANY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DEPOSIT_HOLD', 'FINAL_CHARGE', 'TIP', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'REQUIRES_CAPTURE', 'SUCCEEDED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'DISPATCHER', 'CLEANER');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'STAFF', 'CUSTOMER');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "authUserId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL DEFAULT 'GA',
    "postalCode" VARCHAR(10) NOT NULL,
    "accessNotes" TEXT,
    "distanceMiles" DOUBLE PRECISION,
    "zone" "ServiceZone",
    "distanceProvider" TEXT,
    "distanceComputedAt" TIMESTAMPTZ(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "customerId" UUID,
    "source" "QuoteSource" NOT NULL DEFAULT 'WEB',
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "service" "ServiceType" NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "squareFeet" INTEGER NOT NULL,
    "addOns" JSONB NOT NULL DEFAULT '[]',
    "postalCode" VARCHAR(10) NOT NULL,
    "state" CHAR(2) NOT NULL DEFAULT 'GA',
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "zone" "ServiceZone" NOT NULL,
    "lines" JSONB NOT NULL,
    "serviceCents" INTEGER NOT NULL,
    "addOnsCents" INTEGER NOT NULL,
    "surchargesCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "pricingVersion" TEXT NOT NULL,
    "manualReviewReasons" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "customerId" UUID NOT NULL,
    "addressId" UUID NOT NULL,
    "quoteId" UUID,
    "seriesId" UUID,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "service" "ServiceType" NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "squareFeet" INTEGER NOT NULL,
    "addOns" JSONB NOT NULL DEFAULT '[]',
    "scheduledStart" TIMESTAMPTZ(3) NOT NULL,
    "scheduledEnd" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "zone" "ServiceZone" NOT NULL,
    "lines" JSONB NOT NULL,
    "serviceCents" INTEGER NOT NULL,
    "addOnsCents" INTEGER NOT NULL,
    "surchargesCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL,
    "balanceDueCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "pricingVersion" TEXT NOT NULL,
    "customerNotes" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledBy" "CancelledBy",
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_series" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "addressId" UUID NOT NULL,
    "status" "SeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" "Frequency" NOT NULL,
    "service" "ServiceType" NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "squareFeet" INTEGER NOT NULL,
    "addOns" JSONB NOT NULL DEFAULT '[]',
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurring_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" VARCHAR(4),
    "amountAuthorizedCents" INTEGER NOT NULL,
    "amountCapturedCents" INTEGER NOT NULL DEFAULT 0,
    "amountRefundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "authorizedAt" TIMESTAMPTZ(3),
    "capturedAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "authUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "StaffRole" NOT NULL DEFAULT 'CLEANER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_assignments" (
    "bookingId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_assignments_pkey" PRIMARY KEY ("bookingId","staffId")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" INET,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_authUserId_key" ON "customers"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_createdAt_idx" ON "customers"("createdAt");

-- CreateIndex
CREATE INDEX "addresses_customerId_idx" ON "addresses"("customerId");

-- CreateIndex
CREATE INDEX "addresses_postalCode_idx" ON "addresses"("postalCode");

-- CreateIndex
CREATE INDEX "quotes_customerId_idx" ON "quotes"("customerId");

-- CreateIndex
CREATE INDEX "quotes_createdAt_idx" ON "quotes"("createdAt");

-- CreateIndex
CREATE INDEX "quotes_postalCode_idx" ON "quotes"("postalCode");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_quoteId_key" ON "bookings"("quoteId");

-- CreateIndex
CREATE INDEX "bookings_scheduledStart_status_idx" ON "bookings"("scheduledStart", "status");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_zone_scheduledStart_idx" ON "bookings"("zone", "scheduledStart");

-- CreateIndex
CREATE INDEX "recurring_series_customerId_idx" ON "recurring_series"("customerId");

-- CreateIndex
CREATE INDEX "recurring_series_status_idx" ON "recurring_series"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "webhook_events_type_idx" ON "webhook_events"("type");

-- CreateIndex
CREATE INDEX "webhook_events_processedAt_idx" ON "webhook_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_authUserId_key" ON "staff"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_isActive_idx" ON "staff"("isActive");

-- CreateIndex
CREATE INDEX "booking_assignments_staffId_idx" ON "booking_assignments"("staffId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "recurring_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
