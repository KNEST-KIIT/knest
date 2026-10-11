CREATE TABLE "app"."lab_departments" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."labs" ADD COLUMN "department_id" text;--> statement-breakpoint
ALTER TABLE "app"."labs" ADD COLUMN "escalate_after_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."lab_departments" ADD CONSTRAINT "lab_departments_parent_id_lab_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "app"."lab_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_departments_slug_idx" ON "app"."lab_departments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lab_departments_parent_idx" ON "app"."lab_departments" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "app"."labs" ADD CONSTRAINT "labs_department_id_lab_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "app"."lab_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "labs_department_idx" ON "app"."labs" USING btree ("department_id");--> statement-breakpoint
ALTER TABLE "app"."labs" ADD CONSTRAINT "labs_escalate_positive" CHECK ("app"."labs"."escalate_after_hours" > 0);