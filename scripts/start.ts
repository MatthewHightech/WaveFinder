#!/usr/bin/env bun
/**
 * Start all WaveFinder services: PostGIS (Docker) → migrate → ML worker → web.
 * Usage: bun start
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Subprocess } from "bun";

const root = join(import.meta.dir, "..");
const webEnvPath = join(root, "apps/web/.env");
const webEnvLocalPath = join(root, "apps/web/.env.local");
const mlDir = join(root, "services/ml");

const children: Subprocess[] = [];
let shuttingDown = false;

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function mergedEnv(): Record<string, string> {
  const web = {
    ...loadEnvFile(webEnvPath),
    ...loadEnvFile(webEnvLocalPath),
  };
  const ml = loadEnvFile(join(mlDir, ".env"));
  const mapbox =
    ml.MAPBOX_ACCESS_TOKEN ??
    web.MAPBOX_ACCESS_TOKEN ??
    web.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return {
    ...process.env,
    ...web,
    ...ml,
    ...(mapbox ? { MAPBOX_ACCESS_TOKEN: mapbox } : {}),
  };
}

function log(msg: string) {
  console.log(`\x1b[36m[start]\x1b[0m ${msg}`);
}

async function run(cmd: string[], opts: { cwd?: string; label: string }) {
  const env = mergedEnv();
  const proc = Bun.spawn({
    cmd,
    cwd: opts.cwd ?? root,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  children.push(proc);

  const prefix = `\x1b[33m[${opts.label}]\x1b[0m`;
  void streamLines(proc.stdout, prefix);
  void streamLines(proc.stderr, `${prefix} \x1b[31m`);

  proc.exited.then((code) => {
    if (shuttingDown) return;
    console.error(`\x1b[31m[${opts.label}] exited with code ${code}\x1b[0m`);
    shutdown(code);
  });

  return proc;
}

async function streamLines(
  stream: ReadableStream<Uint8Array> | null | undefined,
  prefix: string,
) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length) console.log(`${prefix} ${line}`);
    }
  }
  if (buffer.length) console.log(`${prefix} ${buffer}`);
}

async function waitForPostgres() {
  log("Waiting for PostGIS…");
  for (let i = 0; i < 45; i++) {
    const result = await Bun.$`docker compose exec -T db pg_isready -U wavefinder -d wavefinder`
      .cwd(root)
      .quiet()
      .nothrow();
    if (result.exitCode === 0) {
      log("PostGIS is ready");
      return;
    }
    await Bun.sleep(1000);
  }
  throw new Error("PostGIS did not become ready within 45s. Is Docker running?");
}

function resolvePython(): string {
  const venvPython = join(mlDir, ".venv/bin/python");
  if (existsSync(venvPython)) return venvPython;
  return "python3";
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Shutting down…");
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already dead */
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  log("Starting WaveFinder stack…");

  const dockerUp = await Bun.$`docker compose up -d`.cwd(root).nothrow();
  if (dockerUp.exitCode !== 0) {
    console.error("Failed to start Docker. Is Docker Desktop running?");
    process.exit(1);
  }

  await waitForPostgres();

  log("Running database migrations…");
  const migrate = await Bun.$`bun run db:migrate`.cwd(root).env(mergedEnv()).nothrow();
  if (migrate.exitCode !== 0) {
    console.error("Database migration failed");
    process.exit(1);
  }

  const python = resolvePython();
  if (!existsSync(join(mlDir, ".venv"))) {
    log("No services/ml/.venv found — using system python3. Run: cd services/ml && python3 -m venv .venv && pip install -e .");
  }

  log("Starting ML worker on http://localhost:8000");
  await run(
    [python, "-m", "uvicorn", "wavefinder.main:app", "--reload", "--port", "8000"],
    { cwd: mlDir, label: "ml" },
  );

  log("Starting web app on http://localhost:3000");
  await run(["bun", "run", "dev"], { cwd: join(root, "apps/web"), label: "web" });

  log("All services running. Press Ctrl+C to stop (PostGIS container keeps running).");
}

main().catch((err) => {
  console.error(err);
  shutdown(1);
});
