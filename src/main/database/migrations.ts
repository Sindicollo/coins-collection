import type Database from 'better-sqlite3'

const MIGRATIONS: string[] = [
  // V1: Initial schema
  `
    CREATE TABLE IF NOT EXISTS countries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coins (
      id TEXT PRIMARY KEY,
      country_id TEXT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      denomination TEXT NOT NULL,
      year INTEGER,
      condition TEXT,
      purchase_date INTEGER,
      purchase_place TEXT,
      price REAL,
      shipping_cost REAL,
      notes TEXT,
      extra_data TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      coin_id TEXT NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_coins_country ON coins(country_id, denomination, year, id);
    CREATE INDEX IF NOT EXISTS idx_photos_coin ON photos(coin_id, position);
  `,
  // V2: Currency support + preferences
  `
    ALTER TABLE coins ADD COLUMN currency TEXT;

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO preferences (key, value) VALUES ('currency', 'RUB');
  `
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `)

  const applied = db
    .prepare('SELECT version FROM _migrations ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined

  const currentVersion = applied?.version ?? 0

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    const version = i + 1
    const migration = MIGRATIONS[i]

    db.transaction(() => {
      db.exec(migration)
      db.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(
        version,
        Date.now()
      )
    })()
  }
}
