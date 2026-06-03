-- CreateEnum
CREATE TYPE "CancellationInitiator" AS ENUM ('client', 'business', 'staff', 'system');

-- CreateEnum
CREATE TYPE "CancellationReasonCode" AS ENUM ('client_request', 'illness', 'scheduling_conflict', 'staff_unavailable', 'no_show', 'payment_issue', 'other');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancellation_initiator" "CancellationInitiator",
ADD COLUMN     "cancellation_reason_code" "CancellationReasonCode";
