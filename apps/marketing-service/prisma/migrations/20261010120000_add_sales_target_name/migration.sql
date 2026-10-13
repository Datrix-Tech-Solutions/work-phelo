-- A name for a sales target. Targets created together for several reps share it; older ones have none.
ALTER TABLE "marketing"."MarketingSalesTarget"
  ADD COLUMN "name" TEXT;
