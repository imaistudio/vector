ALTER TABLE "issue" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_key_unique" UNIQUE("key");