import { createDb } from "@wavefinder/db";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set");
}

export const db = createDb(
  connectionString ?? "postgresql://wavefinder:wavefinder@localhost:5432/wavefinder",
);
