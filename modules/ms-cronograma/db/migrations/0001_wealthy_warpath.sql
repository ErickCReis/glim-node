ALTER TABLE "cronogramas" ADD COLUMN "ids" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "cronogramas" DROP COLUMN "id";