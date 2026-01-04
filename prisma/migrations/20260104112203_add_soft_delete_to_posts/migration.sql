-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "posts_deleted_at_idx" ON "posts"("deleted_at");
