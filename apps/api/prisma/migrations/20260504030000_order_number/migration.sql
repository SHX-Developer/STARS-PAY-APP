-- Sequence + column для человеко-читаемых номеров заказов.
-- Существующие ряды получат уникальные номера автоматически (PostgreSQL
-- инкрементит при ADD COLUMN ... DEFAULT nextval(...)).

CREATE SEQUENCE IF NOT EXISTS "Order_number_seq" START 100;

ALTER TABLE "Order"
  ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('"Order_number_seq"');

ALTER SEQUENCE "Order_number_seq" OWNED BY "Order"."number";

CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");
