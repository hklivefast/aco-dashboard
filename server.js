require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const flash = require('connect-flash');
const path = require('path');
const { initDatabase, saveDatabase } = require('./models/database');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Method override for forms
app.use((req, res, next) => {
  if (req.body && req.body._method) {
    req.method = req.body._method;
    delete req.body._method;
  }
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport configuration
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/discord/callback`;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
  passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds', 'guilds.members.read']
  }, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
  }));
}

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Global variables for views - middleware to add user.isAdmin
app.use(async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      const dbPath = path.join(__dirname, 'data', 'aco.db');
      if (fs.existsSync(dbPath)) {
        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);
        
        const result = db.exec(`SELECT is_admin FROM users WHERE id = '${req.user.id}'`);
        if (result.length > 0 && result[0].values.length > 0) {
          req.user.isAdmin = result[0].values[0][0] === 1 ? 1 : 0;
        } else {
          req.user.isAdmin = 0;
        }
      } else {
        req.user.isAdmin = 0;
      }
    } catch (e) {
      console.error('Error checking admin status:', e);
      req.user.isAdmin = 0;
    }
  }
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Helper to check if user is admin
async function isUserAdmin(userId) {
  try {
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      const result = db.exec(`SELECT is_admin FROM users WHERE id = '${userId}'`);
      if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] === 1;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Auth middleware
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

async function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.id) {
    try {
      const isAdmin = await isUserAdmin(req.user.id);
      if (isAdmin) {
        req.user.isAdmin = 1;
        return next();
      } else {
        req.flash('error_msg', 'You do not have admin access.');
        return res.redirect('/dashboard');
      }
    } catch (e) {
      console.error('Admin check error:', e);
      return res.redirect('/dashboard');
    }
  }
  res.redirect('/login');
}

// ============ ROUTES ============

// Home page
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// Login page
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('login');
});

// Discord OAuth routes
app.get('/auth/discord', (req, res, next) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    req.flash('error_msg', 'Discord OAuth is not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.');
    return res.redirect('/login');
  }
  passport.authenticate('discord')(req, res, next);
});

app.get('/auth/discord/callback', passport.authenticate('discord', {
  failureRedirect: '/login',
  failureFlash: true
}), async (req, res) => {
  // Check if user is in the allowed guild
  if (DISCORD_GUILD_ID) {
    const userGuilds = req.user.guilds || [];
    const isInGuild = userGuilds.some(g => g.id === DISCORD_GUILD_ID);
    
    if (!isInGuild) {
      req.flash('error_msg', 'You must be a member of the ACO Discord server to access this dashboard.');
      req.logout(() => {
        return res.redirect('/login');
      });
      return;
    }
  }
  
  // Store user in database (simplified - use direct db access)
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run('INSERT OR REPLACE INTO users (id, username, discriminator, avatar, is_admin) VALUES (?, ?, ?, ?, ?)', 
        [req.user.id, req.user.username, req.user.discriminator, req.user.avatar, 0]);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
  } catch (e) {
    console.error('Error saving user:', e);
  }
  
  res.redirect('/dashboard');
});

app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// User Dashboard
app.get('/dashboard', ensureAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('dashboard', { products: [], checkouts: [], releases: [], selections: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const productsResult = db.exec('SELECT * FROM products ORDER BY category, name');
    const products = productsResult.length > 0 ? productsResult[0].values.map(row => {
      const obj = {};
      productsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    const checkoutsResult = db.exec(`SELECT * FROM checkouts WHERE user_id = '${req.user.id}' ORDER BY created_at DESC LIMIT 10`);
    const checkouts = checkoutsResult.length > 0 ? checkoutsResult[0].values.map(row => {
      const obj = {};
      checkoutsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    const releasesResult = db.exec('SELECT * FROM releases WHERE release_date >= date("now") ORDER BY release_date ASC');
    const releases = releasesResult.length > 0 ? releasesResult[0].values.map(row => {
      const obj = {};
      releasesResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    const selectionsResult = db.exec(`SELECT * FROM product_selections WHERE user_id = '${req.user.id}'`);
    const selections = selectionsResult.length > 0 ? selectionsResult[0].values.map(row => {
      const obj = {};
      selectionsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('dashboard', { products, checkouts, releases, selections, user: req.user });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.render('dashboard', { products: [], checkouts: [], releases: [], selections: [], user: req.user });
  }
});

// Products page
app.get('/products', ensureAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('products', { products: [], selectedCategory: null, user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const category = req.query.category;
    let query = 'SELECT * FROM products WHERE active = 1';
    if (category) {
      query += ` AND category = '${category.replace(/'/g, "''")}'`;
    }
    query += ' ORDER BY category, name';
    
    const result = db.exec(query);
    const products = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('products', { products, selectedCategory: category, user: req.user });
  } catch (e) {
    console.error('Products error:', e);
    res.render('products', { products: [], selectedCategory: null, user: req.user });
  }
});

// Add checkout
app.post('/checkouts', ensureAuth, async (req, res) => {
  const { product_id, sku, quantity, status, notes } = req.body;
  const checkoutId = uuidv4();
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run('INSERT INTO checkouts (id, user_id, product_id, sku, quantity, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [checkoutId, req.user.id, product_id, sku, quantity, status || 'pending', notes]);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    req.flash('success_msg', 'Checkout added successfully!');
  } catch (e) {
    console.error('Checkout error:', e);
    req.flash('error_msg', 'Error adding checkout');
  }
  
  res.redirect('/dashboard');
});

// Update checkout status
app.put('/checkouts/:id', ensureAuth, async (req, res) => {
  const { status } = req.body;
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`UPDATE checkouts SET status = '${status}' WHERE id = '${req.params.id}' AND user_id = '${req.user.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Update checkout error:', e);
    res.json({ success: false });
  }
});

// Releases page
app.get('/releases', ensureAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('releases', { releases: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec('SELECT * FROM releases ORDER BY release_date ASC');
    const releases = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('releases', { releases, user: req.user });
  } catch (e) {
    console.error('Releases error:', e);
    res.render('releases', { releases: [], user: req.user });
  }
});

// Sign up for release
app.post('/releases/:id/signup', ensureAuth, async (req, res) => {
  const { google_form_url } = req.body;
  const signupId = uuidv4();
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run('INSERT INTO release_signups (id, release_id, user_id, form_url) VALUES (?, ?, ?, ?)',
        [signupId, req.params.id, req.user.id, google_form_url]);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    req.flash('success_msg', 'Successfully signed up for the release!');
  } catch (e) {
    console.error('Signup error:', e);
    req.flash('error_msg', 'Error signing up for release');
  }
  
  res.redirect('/releases');
});

// ============ ADMIN ROUTES ============

app.get('/admin', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/index', { stats: { totalUsers: 0, totalCheckouts: 0, totalProducts: 0, totalReleases: 0, recentSignups: [] }, user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const stats = {};
    
    const usersResult = db.exec('SELECT COUNT(*) as count FROM users');
    stats.totalUsers = usersResult.length > 0 ? usersResult[0].values[0][0] : 0;
    
    const productsResult = db.exec('SELECT COUNT(*) as count FROM products');
    stats.totalProducts = productsResult.length > 0 ? productsResult[0].values[0][0] : 0;
    
    const checkoutsResult = db.exec('SELECT COUNT(*) as count FROM checkouts');
    stats.totalCheckouts = checkoutsResult.length > 0 ? checkoutsResult[0].values[0][0] : 0;
    
    const releasesResult = db.exec('SELECT COUNT(*) as count FROM releases');
    stats.totalReleases = releasesResult.length > 0 ? releasesResult[0].values[0][0] : 0;
    
    const signupsResult = db.exec(`
      SELECT rs.*, r.name as release_name, u.username FROM release_signups rs 
      JOIN releases r ON rs.release_id = r.id 
      JOIN users u ON rs.user_id = u.id 
      ORDER BY rs.created_at DESC LIMIT 10
    `);
    
    if (signupsResult.length > 0) {
      stats.recentSignups = signupsResult[0].values.map(row => {
        const obj = {};
        signupsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
    } else {
      stats.recentSignups = [];
    }
    
    res.render('admin/index', { stats, user: req.user });
  } catch (e) {
    console.error('Admin error:', e);
    res.render('admin/index', { stats: { totalUsers: 0, totalCheckouts: 0, totalProducts: 0, totalReleases: 0, recentSignups: [] }, user: req.user });
  }
});

// Admin - Manage products
app.get('/admin/products', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/products', { products: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec('SELECT * FROM products ORDER BY category, name');
    const products = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/products', { products, user: req.user });
  } catch (e) {
    console.error('Admin products error:', e);
    res.render('admin/products', { products: [], user: req.user });
  }
});

app.post('/admin/products', ensureAdmin, async (req, res) => {
  const { name, sku, category, description, url, active } = req.body;
  const productId = uuidv4();
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run('INSERT INTO products (id, name, sku, category, description, url, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [productId, name, sku, category, description, url || null, active ? 1 : 0]);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    req.flash('success_msg', 'Product added successfully!');
  } catch (e) {
    console.error('Add product error:', e);
    req.flash('error_msg', 'Error adding product');
  }
  
  res.redirect('/admin/products');
});

app.put('/admin/products/:id', ensureAdmin, async (req, res) => {
  const { name, sku, category, description, url, active } = req.body;
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`UPDATE products SET name = '${name.replace(/'/g, "''")}', sku = '${sku.replace(/'/g, "''")}', category = '${category.replace(/'/g, "''")}', description = '${(description || '').replace(/'/g, "''")}', url = '${(url || '').replace(/'/g, "''")}', active = ${active ? 1 : 0} WHERE id = '${req.params.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Update product error:', e);
    res.json({ success: false });
  }
});

app.delete('/admin/products/:id', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`DELETE FROM products WHERE id = '${req.params.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Delete product error:', e);
    res.json({ success: false });
  }
});

// Admin - Manage releases
app.get('/admin/releases', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/releases', { releases: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec('SELECT * FROM releases ORDER BY release_date ASC');
    const releases = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/releases', { releases, user: req.user });
  } catch (e) {
    console.error('Admin releases error:', e);
    res.render('admin/releases', { releases: [], user: req.user });
  }
});

app.post('/admin/releases', ensureAdmin, async (req, res) => {
  const { name, release_date, google_form_url, description } = req.body;
  const releaseId = uuidv4();
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run('INSERT INTO releases (id, name, release_date, google_form_url, description) VALUES (?, ?, ?, ?, ?)',
        [releaseId, name, release_date, google_form_url, description]);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    req.flash('success_msg', 'Release added successfully!');
  } catch (e) {
    console.error('Add release error:', e);
    req.flash('error_msg', 'Error adding release');
  }
  
  res.redirect('/admin/releases');
});

app.put('/admin/releases/:id', ensureAdmin, async (req, res) => {
  const { name, release_date, google_form_url, description } = req.body;
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`UPDATE releases SET name = '${name.replace(/'/g, "''")}', release_date = '${release_date}', google_form_url = '${(google_form_url || '').replace(/'/g, "''")}', description = '${(description || '').replace(/'/g, "''")}' WHERE id = '${req.params.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Update release error:', e);
    res.json({ success: false });
  }
});

app.delete('/admin/releases/:id', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`DELETE FROM releases WHERE id = '${req.params.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Delete release error:', e);
    res.json({ success: false });
  }
});

// Admin - View signups
app.get('/admin/signups', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/signups', { signups: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec(`
      SELECT rs.*, r.name as release_name, u.username, u.id as user_discord_id
      FROM release_signups rs 
      JOIN releases r ON rs.release_id = r.id 
      JOIN users u ON rs.user_id = u.id 
      ORDER BY rs.created_at DESC
    `);
    
    const signups = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/signups', { signups, user: req.user });
  } catch (e) {
    console.error('Admin signups error:', e);
    res.render('admin/signups', { signups: [], user: req.user });
  }
});

// Admin - All checkouts
app.get('/admin/checkouts', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/checkouts', { checkouts: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec(`
      SELECT c.*, u.username, p.name as product_name 
      FROM checkouts c 
      JOIN users u ON c.user_id = u.id 
      LEFT JOIN products p ON c.product_id = p.id 
      ORDER BY c.created_at DESC
    `);
    
    const checkouts = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/checkouts', { checkouts, user: req.user });
  } catch (e) {
    console.error('Admin checkouts error:', e);
    res.render('admin/checkouts', { checkouts: [], user: req.user });
  }
});

// Admin - Members
app.get('/admin/members', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/members', { members: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec('SELECT * FROM users ORDER BY username');
    const members = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/members', { members, user: req.user });
  } catch (e) {
    console.error('Admin members error:', e);
    res.render('admin/members', { members: [], user: req.user });
  }
});

// Admin - Make admin
app.post('/admin/members/:id/promote', ensureAdmin, async (req, res) => {
  // Prevent self-demotion
  if (req.params.id === req.user.id) {
    req.flash('error_msg', 'You cannot demote yourself.');
    return res.redirect('/admin/members');
  }
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`UPDATE users SET is_admin = 1 WHERE id = '${req.params.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    req.flash('success_msg', 'User promoted to admin!');
  } catch (e) {
    console.error('Promote error:', e);
    req.flash('error_msg', 'Error promoting user');
  }
  
  res.redirect('/admin/members');
});

app.post('/admin/members/:id/demote', ensureAdmin, async (req, res) => {
  // Prevent self-demotion
  if (req.params.id === req.user.id) {
    req.flash('error_msg', 'You cannot demote yourself.');
    return res.redirect('/admin/members');
  }
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`UPDATE users SET is_admin = 0 WHERE id = '${req.params.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    req.flash('success_msg', 'Admin demoted!');
  } catch (e) {
    console.error('Demote error:', e);
    req.flash('error_msg', 'Error demoting admin');
  }
  
  res.redirect('/admin/members');
});

// Admin - Manage Admins dedicated page
app.get('/admin/manage-admins', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/manage-admins', { admins: [], nonAdmins: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const adminsResult = db.exec("SELECT * FROM users WHERE is_admin = 1 ORDER BY username");
    const admins = adminsResult.length > 0 ? adminsResult[0].values.map(row => {
      const obj = {};
      adminsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    const nonAdminsResult = db.exec("SELECT * FROM users WHERE is_admin = 0 ORDER BY username");
    const nonAdmins = nonAdminsResult.length > 0 ? nonAdminsResult[0].values.map(row => {
      const obj = {};
      nonAdminsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/manage-admins', { admins, nonAdmins, user: req.user });
  } catch (e) {
    console.error('Manage admins error:', e);
    res.render('admin/manage-admins', { admins: [], nonAdmins: [], user: req.user });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { error: err, user: req.user });
});

// Initialize database and start server
// ============ PRODUCT SELECTIONS ROUTES ============

// Add product selection
app.post('/selections', ensureAuth, async (req, res) => {
  console.log('POST /selections called', req.body);
  const { product_id, quantity } = req.body;
  
  if (!product_id) {
    console.log('No product_id provided');
    req.flash('error_msg', 'Please select a product');
    return res.redirect('/products');
  }
  
  const selectionId = uuidv4();
  const qtyValue = (quantity === 'No Limit' || !quantity || quantity === 'null') ? null : quantity;
  
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    console.log('Database path:', dbPath, 'Exists:', fs.existsSync(dbPath));
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      // Check if table exists
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tables.length > 0 ? tables[0].values.flat() : [];
      console.log('Tables:', tableNames);
      
      if (!tableNames.includes('product_selections')) {
        console.log('Creating product_selections table...');
        db.run("CREATE TABLE product_selections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
      }
      
      // Check if already selected
      const existing = db.exec(`SELECT * FROM product_selections WHERE user_id = '${req.user.id}' AND product_id = '${product_id}'`);
      console.log('Existing selection:', existing.length > 0 ? existing[0].values : 'none');
      
      if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE product_selections SET quantity = ? WHERE user_id = '${req.user.id}' AND product_id = '${product_id}'`, [qtyValue]);
        console.log('Updated existing selection');
      } else {
        db.run('INSERT INTO product_selections (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
          [selectionId, req.user.id, product_id, qtyValue]);
        console.log('Inserted new selection');
      }
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
      console.log('Database saved');
    }
    
    req.flash('success_msg', 'Product added to your selections!');
  } catch (e) {
    console.error('Selection error:', e);
    req.flash('error_msg', 'Error adding product selection: ' + e.message);
  }
  
  res.redirect('/products');
});

// Remove product selection
app.delete('/selections/:id', ensureAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      db.run(`DELETE FROM product_selections WHERE id = '${req.params.id}' AND user_id = '${req.user.id}'`);
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Delete selection error:', e);
    res.json({ success: false });
  }
});

// My Selections page
app.get('/my-selections', ensureAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('products', { products: [], selections: [], selectedCategory: null, user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec(`
      SELECT ps.*, p.name as product_name, p.sku, p.category, p.description, p.tcin
      FROM product_selections ps
      JOIN products p ON ps.product_id = p.id
      WHERE ps.user_id = '${req.user.id}'
      ORDER BY ps.created_at DESC
    `);
    
    const selections = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('my-selections', { selections, user: req.user });
  } catch (e) {
    console.error('My selections error:', e);
    res.render('my-selections', { selections: [], user: req.user });
  }
});

// ============ MY CHECKOUTS ROUTES ============

// My Checkouts page
app.get('/my-checkouts', ensureAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('my-checkouts', { checkouts: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec(`SELECT * FROM checkouts WHERE user_id = '${req.user.id}' ORDER BY created_at DESC`);
    const checkouts = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('my-checkouts', { checkouts, user: req.user });
  } catch (e) {
    console.error('My checkouts error:', e);
    res.render('my-checkouts', { checkouts: [], user: req.user });
  }
});

// ============ WEBHOOK ROUTES ============

// Checkout webhook from Discord bot
app.post('/webhooks/checkout', async (req, res) => {
  try {
    const { user_id, username, product_name, sku, quantity, status, price, timestamp } = req.body;
    
    if (!user_id || !product_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (fs.existsSync(dbPath)) {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      const checkoutId = uuidv4();
      db.run(
        'INSERT INTO checkouts (id, user_id, product_name, sku, quantity, status, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [checkoutId, user_id, product_name, sku || null, quantity || 1, status || 'success', price || null, timestamp || new Date().toISOString()]
      );
      
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ADMIN: VIEW MEMBER SELECTIONS ============

app.get('/admin/selections', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const initSqlJs = require('sql.js');
    const dbPath = path.join(__dirname, 'data', 'aco.db');
    
    if (!fs.existsSync(dbPath)) {
      return res.render('admin/selections', { selections: [], user: req.user });
    }
    
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec(`
      SELECT ps.*, p.name as product_name, p.sku, p.category, u.username
      FROM product_selections ps
      JOIN products p ON ps.product_id = p.id
      JOIN users u ON ps.user_id = u.id
      ORDER BY ps.created_at DESC
    `);
    
    const selections = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    
    res.render('admin/selections', { selections, user: req.user });
  } catch (e) {
    console.error('Admin selections error:', e);
    res.render('admin/selections', { selections: [], user: req.user });
  }
});

// Update dashboard to include selections
const originalDashboard = app._router.stack.find(r => r.route && r.route.path === '/dashboard' && r.route.methods.get);
if (originalDashboard) {
  const dashboardPath = originalDashboard.route.path;
  const dashboardHandler = originalDashboard.route.stack[0].handle;
  
  app.get(dashboardPath, ensureAuth, async (req, res) => {
    try {
      const fs = require('fs');
      const initSqlJs = require('sql.js');
      const dbPath = path.join(__dirname, 'data', 'aco.db');
      
      if (!fs.existsSync(dbPath)) {
        return dashboardHandler(req, res);
      }
      
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);
      
      const productsResult = db.exec('SELECT * FROM products ORDER BY category, name');
      const products = productsResult.length > 0 ? productsResult[0].values.map(row => {
        const obj = {};
        productsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      }) : [];
      
      const checkoutsResult = db.exec(`SELECT * FROM checkouts WHERE user_id = '${req.user.id}' ORDER BY created_at DESC LIMIT 10`);
      const checkouts = checkoutsResult.length > 0 ? checkoutsResult[0].values.map(row => {
        const obj = {};
        checkoutsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      }) : [];
      
      const releasesResult = db.exec('SELECT * FROM releases WHERE release_date >= date("now") ORDER BY release_date ASC');
      const releases = releasesResult.length > 0 ? releasesResult[0].values.map(row => {
        const obj = {};
        releasesResult[0].columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      }) : [];
      
      const selectionsResult = db.exec(`SELECT * FROM product_selections WHERE user_id = '${req.user.id}'`);
      const selections = selectionsResult.length > 0 ? selectionsResult[0].values.map(row => {
        const obj = {};
        selectionsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      }) : [];
      
      // Get product names for selections
      if (selections.length > 0) {
        const productIds = selections.map(s => `'${s.product_id}'`).join(',');
        const productNames = db.exec(`SELECT id, name FROM products WHERE id IN (${productIds})`);
        if (productNames.length > 0) {
          const nameMap = {};
          productNames[0].values.forEach(row => {
            nameMap[row[0]] = row[1];
          });
          selections.forEach(s => {
            s.product_name = nameMap[s.product_id] || 'Unknown';
          });
        }
      }
      
      res.render('dashboard', { products, checkouts, releases, selections, user: req.user });
    } catch (e) {
      console.error('Dashboard error:', e);
      res.render('dashboard', { products: [], checkouts: [], releases: [], selections: [], user: req.user });
    }
  });
}

async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');
    app.listen(PORT, () => {
      console.log(`ACO Dashboard running on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Failed to start:', e);
    process.exit(1);
  }
}

start();
