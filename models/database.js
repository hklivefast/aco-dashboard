const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'aco.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;
let initPromise = null;

// Get or load SQL.js (cached)
async function getSQL() {
  if (SQL) return SQL;
  
  SQL = await initSqlJs();
  return SQL;
}

async function initDatabase() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const SQLModule = await getSQL();
    
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQLModule.Database(fileBuffer);
    } else {
      db = new SQLModule.Database();
    }
    
    // Create tables if they don't exist
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.flat() : [];
    
    if (!tableNames.includes('users')) {
      db.run("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, discriminator TEXT, avatar TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }
    
    if (!tableNames.includes('products')) {
      db.run("CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT, category TEXT NOT NULL, description TEXT, active INTEGER DEFAULT 1, tcin TEXT, image TEXT, url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }
    
    if (!tableNames.includes('checkouts')) {
      db.run("CREATE TABLE checkouts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_id TEXT, sku TEXT, quantity INTEGER DEFAULT 1, status TEXT DEFAULT 'pending', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }
    
    if (!tableNames.includes('releases')) {
      db.run("CREATE TABLE releases (id TEXT PRIMARY KEY, name TEXT NOT NULL, release_date DATE NOT NULL, google_form_url TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }
    
    if (!tableNames.includes('release_signups')) {
      db.run("CREATE TABLE release_signups (id TEXT PRIMARY KEY, release_id TEXT NOT NULL, user_id TEXT NOT NULL, form_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }
    
    if (!tableNames.includes('product_selections')) {
      db.run("CREATE TABLE product_selections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }
    
    // Seed products if none exist
    const productCount = db.exec('SELECT COUNT(*) as count FROM products');
    const count = productCount.length > 0 ? productCount[0].values[0][0] : 0;
    
    if (count === 0) {
      const { v4: uuidv4 } = require('uuid');
      const products = [
        { name: 'Pokemon TCG Scarlet & Violet - Base Set Booster Box', sku: 'placeholder-sv-base', category: 'Pokemon - Target', description: '36 packs per box', active: 1 },
        { name: 'Pokemon TCG Scarlet & Violet - Paradox Rift Booster Box', sku: 'placeholder-sv-paradox', category: 'Pokemon - Target', description: '36 packs per box', active: 1 },
        { name: 'Pokemon TCG Scarlet & Violet - Obsidian Flames Booster Box', sku: 'placeholder-sv-obsidian', category: 'Pokemon - Target', description: '36 packs per box', active: 1 },
        { name: 'Pokemon TCG Scarlet & Violet - Paldean Fates Booster Box', sku: 'placeholder-sv-paldean', category: 'Pokemon - Target', description: '36 packs per box', active: 1 },
        { name: 'Pokemon TCG Elite Trainer Box - Scarlet & Violet', sku: 'placeholder-etb-sv', category: 'Pokemon - Target', description: 'Elite Trainer Box', active: 1 },
        { name: 'Pokemon TCG - Pokemon Center Elite Trainer Box', sku: 'placeholder-etb-pc', category: 'Pokemon - Target', description: 'Exclusive Pokemon Center ETB', active: 1 },
        { name: 'Panini Prizm Football Hobby Box', sku: 'placeholder-prizm-football', category: 'Sports Cards', description: '12 packs per box', active: 1 },
        { name: 'Panini Prizm Basketball Hobby Box', sku: 'placeholder-prizm-basketball', category: 'Sports Cards', description: '12 packs per box', active: 1 },
        { name: 'Panini Select Football Hobby Box', sku: 'placeholder-select-football', category: 'Sports Cards', description: '18 packs per box', active: 1 },
        { name: 'Panini Select Basketball Hobby Box', sku: 'placeholder-select-basketball', category: 'Sports Cards', description: '18 packs per box', active: 1 },
        { name: 'Panini Mosaic Football Hobby Box', sku: 'placeholder-mosaic-football', category: 'Sports Cards', description: '14 packs per box', active: 1 },
        { name: 'Panini Mosaic Basketball Hobby Box', sku: 'placeholder-mosaic-basketball', category: 'Sports Cards', description: '14 packs per box', active: 1 },
        { name: 'Topps Chrome Baseball Hobby Box', sku: 'placeholder-chrome-baseball', category: 'Sports Cards', description: '24 packs per box', active: 1 },
        { name: 'Panini Prizm Baseball Hobby Box', sku: 'placeholder-prizm-baseball', category: 'Sports Cards', description: '12 packs per box', active: 1 },
        { name: 'One Piece Card Game - Romance Dawn Booster Box', sku: 'placeholder-op-romance', category: 'One Piece', description: '36 packs per box', active: 1 },
        { name: 'One Piece Card Game - Paramount War Booster Box', sku: 'placeholder-op-paramount', category: 'One Piece', description: '36 packs per box', active: 1 },
        { name: 'One Piece Card Game - Pillars of Strength Booster Box', sku: 'placeholder-op-pillars', category: 'One Piece', description: '36 packs per box', active: 1 },
        { name: 'One Piece Card Game - Kingdoms of Intrigue Booster Box', sku: 'placeholder-op-kingdoms', category: 'One Piece', description: '36 packs per box', active: 1 },
        { name: 'One Piece Card Game - Wings of the Captain Booster Box', sku: 'placeholder-op-wings', category: 'One Piece', description: '36 packs per box', active: 1 },
        { name: 'One Piece Card Game - 500 Years Quest Booster Box', sku: 'placeholder-op-500years', category: 'One Piece', description: '36 packs per box', active: 1 },
        { name: 'One Piece Card Game - Starter Deck', sku: 'placeholder-op-starter', category: 'One Piece', description: 'Pre-constructed starter deck', active: 1 },
        { name: 'One Piece Card Game - Booster Box Case', sku: 'placeholder-op-case', category: 'One Piece', description: 'Full case (6 boxes)', active: 1 }
      ];
      
      for (const product of products) {
        try {
          db.run('INSERT INTO products (id, name, sku, category, description, active) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), product.name, product.sku, product.category, product.description, product.active]);
        } catch (e) {
          // Ignore duplicate errors
        }
      }
      console.log('Database seeded with initial products');
    }
    
    saveDatabase();
    return db;
  })();
  
  return initPromise;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

async function getDbWithSQL() {
  if (!initPromise) {
    // If initDatabase hasn't been called yet, initialize now
    await initDatabase();
  }
  await initPromise; // Wait for initialization
  return { db, SQL };
}

module.exports = { initDatabase, saveDatabase, getDb, getDbWithSQL, getSQL };
