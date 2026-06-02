import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** Bbox in chip pixel space + chip metadata for YOLO export */
export type LabelBbox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChipBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export const jobTypeEnum = pgEnum("job_type", ["scan", "train"]);
export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

export const seedStatusEnum = pgEnum("seed_status", [
  "pending",
  "approved",
  "rejected",
]);

export const labelSourceEnum = pgEnum("label_source", [
  "seed_review",
  "free_explore",
  "empty_chip",
]);

export const modelVersions = pgTable("model_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  version: varchar("version", { length: 64 }).notNull().unique(),
  weightsPath: text("weights_path").notNull(),
  metrics: jsonb("metrics").$type<Record<string, number>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chips = pgTable(
  "chips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable key from tile origin + zoom/GSD for dedup */
    chipKey: varchar("chip_key", { length: 128 }).notNull().unique(),
    bounds: jsonb("bounds").$type<ChipBounds>().notNull(),
    /** Path relative to ML data dir */
    imagePath: text("image_path"),
    isEmpty: boolean("is_empty").default(false).notNull(),
    labeledAt: timestamp("labeled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("chips_empty_idx").on(t.isEmpty)],
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chipId: uuid("chip_id")
      .notNull()
      .references(() => chips.id, { onDelete: "cascade" }),
    bbox: jsonb("bbox").$type<LabelBbox>().notNull(),
    source: labelSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("labels_chip_idx").on(t.chipId)],
);

export const seedImports = pgTable(
  "seed_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    externalId: varchar("external_id", { length: 256 }),
    status: seedStatusEnum("status").default("pending").notNull(),
    /** Set when approved and linked to a label */
    labelId: uuid("label_id").references(() => labels.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    index("seed_status_idx").on(t.status),
    index("seed_coords_idx").on(t.lat, t.lon),
  ],
);

export const pins = pgTable(
  "pins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    score: doublePrecision("score").notNull(),
    modelVersionId: uuid("model_version_id").references(() => modelVersions.id),
    suppressed: boolean("suppressed").default(false).notNull(),
    suppressReason: text("suppress_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("pins_coords_idx").on(t.lat, t.lon),
    index("pins_suppressed_idx").on(t.suppressed),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").default("pending").notNull(),
    /** Viewport / scan bounds as GeoJSON-like bbox */
    bounds: jsonb("bounds").$type<ChipBounds>(),
    tileCount: integer("tile_count"),
    progress: integer("progress").default(0),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    modelVersionId: uuid("model_version_id").references(() => modelVersions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);
