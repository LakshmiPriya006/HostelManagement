/*
  # Add unique constraint on rent_payments

  ## Problem
  Multiple rent payment records were being created for the same hosteller in the same month/year.
  This happened because the frontend inserts a new record if none is found, but race conditions
  (multiple renders/reloads) could trigger multiple inserts before any record existed.

  ## Changes
  - Add UNIQUE constraint on (hosteller_id, month, year) in rent_payments table
  - This ensures only one payment record can exist per hosteller per month

  ## Data Safety
  - First deduplicate existing duplicate records by keeping only the most recent one per group
  - Then add the constraint safely
*/

-- Step 1: Remove duplicate rows, keeping the one with the latest created_at (or paid if exists)
DELETE FROM rent_payments
WHERE id NOT IN (
  SELECT DISTINCT ON (hosteller_id, month, year) id
  FROM rent_payments
  ORDER BY hosteller_id, month, year,
    CASE WHEN status = 'paid' THEN 0 ELSE 1 END,
    created_at DESC
);

-- Step 2: Add unique constraint
ALTER TABLE rent_payments
  ADD CONSTRAINT rent_payments_hosteller_month_year_unique
  UNIQUE (hosteller_id, month, year);
