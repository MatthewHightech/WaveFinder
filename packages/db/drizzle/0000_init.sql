CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "public"."job_type" AS ENUM('scan', 'train');
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed');
CREATE TYPE "public"."seed_status" AS ENUM('pending', 'approved', 'rejected');
CREATE TYPE "public"."label_source" AS ENUM('seed_review', 'free_explore', 'empty_chip');

CREATE TABLE "model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(64) NOT NULL,
	"weights_path" text NOT NULL,
	"metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_versions_version_unique" UNIQUE("version")
);

CREATE TABLE "chips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chip_key" varchar(128) NOT NULL,
	"bounds" jsonb NOT NULL,
	"image_path" text,
	"is_empty" boolean DEFAULT false NOT NULL,
	"labeled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chips_chip_key_unique" UNIQUE("chip_key")
);

CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chip_id" uuid NOT NULL,
	"bbox" jsonb NOT NULL,
	"source" "label_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "seed_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"source" varchar(128) NOT NULL,
	"external_id" varchar(256),
	"status" "seed_status" DEFAULT 'pending' NOT NULL,
	"label_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);

CREATE TABLE "pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"score" double precision NOT NULL,
	"model_version_id" uuid,
	"suppressed" boolean DEFAULT false NOT NULL,
	"suppress_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"bounds" jsonb,
	"tile_count" integer,
	"progress" integer DEFAULT 0,
	"result" jsonb,
	"error" text,
	"model_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);

ALTER TABLE "labels" ADD CONSTRAINT "labels_chip_id_chips_id_fk" FOREIGN KEY ("chip_id") REFERENCES "public"."chips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "seed_imports" ADD CONSTRAINT "seed_imports_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "pins" ADD CONSTRAINT "pins_model_version_id_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_model_version_id_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "chips_empty_idx" ON "chips" USING btree ("is_empty");
CREATE INDEX "labels_chip_idx" ON "labels" USING btree ("chip_id");
CREATE INDEX "seed_status_idx" ON "seed_imports" USING btree ("status");
CREATE INDEX "seed_coords_idx" ON "seed_imports" USING btree ("lat","lon");
CREATE INDEX "pins_coords_idx" ON "pins" USING btree ("lat","lon");
CREATE INDEX "pins_suppressed_idx" ON "pins" USING btree ("suppressed");
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");
