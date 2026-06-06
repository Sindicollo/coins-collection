import Database from 'better-sqlite3'
import { join } from 'path'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

function getDefaultDbPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron')
  return join(app.getPath('userData'), 'database.sqlite')
}

export function getDatabase(customPath?: string): Database.Database {
  if (!db) {
    const dbPath = customPath ?? getDefaultDbPath()
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

/**
 * Create a fresh database at a given path. Used for testing.
 * Does NOT set the singleton — call getDatabase() afterwards if needed.
 */
export function createDatabaseAt(path: string): Database.Database {
  const database = new Database(path)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  runMigrations(database)
  return database
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
