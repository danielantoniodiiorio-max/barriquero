const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'keto_tracker.db');
const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    name TEXT NOT NULL,
    carbs REAL NOT NULL DEFAULT 0,
    fiber REAL NOT NULL DEFAULT 0,
    net_carbs REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    calories REAL NOT NULL DEFAULT 0,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS garmin_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    steps INTEGER DEFAULT 0,
    active_calories INTEGER DEFAULT 0,
    bmr_calories INTEGER DEFAULT 1600,
    total_calories INTEGER DEFAULT 1600,
    resting_hr INTEGER DEFAULT 60,
    last_synced TEXT NOT NULL,
    source TEXT DEFAULT 'demo'
  );

  CREATE TABLE IF NOT EXISTS ketone_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT
  );
`);

// Seed default settings if not exists
const initSetting = (key, defaultValue) => {
  const check = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!check) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, String(defaultValue));
  }
};

initSetting('net_carbs_target', '25');
initSetting('protein_target', '90');
initSetting('fat_target', '140');
initSetting('calories_target', '1800');
initSetting('garmin_username', '');
initSetting('garmin_password', '');
initSetting('gemini_api_key', '');

module.exports = {
  db,
  
  // Settings
  getSettings() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    for (const r of rows) result[r.key] = r.value;
    return result;
  },

  updateSetting(key, value) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  },

  // Meals
  addMeal(meal) {
    const net_carbs = Math.max(0, (meal.carbs || 0) - (meal.fiber || 0));
    const timestamp = meal.timestamp || new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO meals (timestamp, name, carbs, fiber, net_carbs, protein, fat, calories, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      timestamp,
      meal.name,
      meal.carbs || 0,
      meal.fiber || 0,
      net_carbs,
      meal.protein || 0,
      meal.fat || 0,
      meal.calories || 0,
      meal.notes || ''
    );
    return { id: Number(info.lastInsertRowid), ...meal, net_carbs, timestamp };
  },

  getMealsForDate(dateStr) {
    const prefix = dateStr || new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT * FROM meals 
      WHERE timestamp LIKE ? 
      ORDER BY timestamp ASC
    `).all(`${prefix}%`);
  },

  getAllRecentMeals(limit = 50) {
    return db.prepare(`
      SELECT * FROM meals 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit);
  },

  deleteMeal(id) {
    return db.prepare('DELETE FROM meals WHERE id = ?').run(id);
  },

  // Garmin Metrics
  saveGarminMetrics(metrics) {
    const stmt = db.prepare(`
      INSERT INTO garmin_metrics (date, steps, active_calories, bmr_calories, total_calories, resting_hr, last_synced, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        steps = excluded.steps,
        active_calories = excluded.active_calories,
        bmr_calories = excluded.bmr_calories,
        total_calories = excluded.total_calories,
        resting_hr = excluded.resting_hr,
        last_synced = excluded.last_synced,
        source = excluded.source
    `);
    stmt.run(
      metrics.date,
      metrics.steps || 0,
      metrics.active_calories || 0,
      metrics.bmr_calories || 1600,
      metrics.total_calories || 1600,
      metrics.resting_hr || 60,
      new Date().toISOString(),
      metrics.source || 'demo'
    );
    return this.getGarminMetrics(metrics.date);
  },

  getGarminMetrics(dateStr) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    let row = db.prepare('SELECT * FROM garmin_metrics WHERE date = ?').get(targetDate);
    if (!row) {
      row = {
        date: targetDate,
        steps: 0,
        active_calories: 0,
        bmr_calories: 1650,
        total_calories: 1650,
        resting_hr: 62,
        last_synced: 'Sin sincronizar hoy',
        source: 'ninguno'
      };
    }
    return row;
  },

  // Ketone Logs
  addKetoneLog(log) {
    const timestamp = log.timestamp || new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO ketone_logs (timestamp, type, value, unit, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(timestamp, log.type, log.value, log.unit || 'mmol/L', log.notes || '');
    return { id: Number(info.lastInsertRowid), ...log, timestamp };
  },

  getKetoneLogs(limit = 20) {
    return db.prepare('SELECT * FROM ketone_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  }
};
