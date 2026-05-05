-- Sequence + column для человеко-читаемых номеров заказов.
-- ::regclass cast гарантирует case-sensitive lookup (важно для имён в кавычках).

CREATE SEQUENCE IF NOT EXISTS "Order_number_seq" START 100;

ALTER TABLE "Order"
  ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('"Order_number_seq"'::regclass);

ALTER SEQUENCE "Order_number_seq" OWNED BY "Order"."number";

CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");
