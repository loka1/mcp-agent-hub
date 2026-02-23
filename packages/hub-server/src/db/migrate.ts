import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationDir = path.resolve(currentDir, "./migrations");
  const files = fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const hasMigrationStmt = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const insertMigrationStmt = db.prepare(
    "INSERT INTO schema_migrations(version, applied_at) VALUES(?, datetime('now'))",
  );

  for (const file of files) {
    const alreadyApplied = hasMigrationStmt.get(file);
    if (alreadyApplied) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      insertMigrationStmt.run(file);
    });
    tx();
  }
}
