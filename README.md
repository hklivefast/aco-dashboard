# ACO Dashboard

A comprehensive dashboard for Automated Checkout (ACO) services with Discord OAuth2 authentication.

## Features

- 🎴 **Pokemon Products** - Target-exclusive Pokemon TCG products
- 🏀 **Sports Cards** - Panini Prizm, Select, Mosaic, and more
- 🏴‍☠️ **One Piece TCG** - All One Piece Card Game products
- 🔐 **Discord OAuth2** - Secure server membership verification
- 📦 **Checkout Tracking** - Track your automated checkouts
- 📅 **Release Management** - Upcoming releases with Google Form signups
- ⚙️ **Admin Panel** - Full product, release, and member management

## Prerequisites

- Node.js 18+ 
- npm or yarn
- A Discord Application (for OAuth2)

## Setup

### 1. Clone and Install

```bash
cd aco-dashboard
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your Discord credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=3000
SESSION_SECRET=your-secure-random-string

# Discord OAuth2 (get from https://discord.com/developers/applications)
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret

# Your Discord Server ID (right-click server name > Copy ID)
DISCORD_GUILD_ID=your-guild-id

DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback
```

### 3. Set Up Discord Application

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "OAuth2" in the sidebar
4. Add a redirect: `http://localhost:3000/auth/discord/callback`
5. Copy the Client ID and Client Secret to your `.env`

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

Visit `http://localhost:3000` in your browser.

## Project Structure

```
aco-dashboard/
├── server.js              # Main Express server
├── models/
│   └── database.js        # SQLite database setup
├── views/
│   ├── index.ejs          # Home page
│   ├── login.ejs          # Login page
│   ├── dashboard.ejs      # User dashboard
│   ├── products.ejs       # Product catalog
│   ├── releases.ejs       # Releases page
│   ├── error.ejs          # Error page
│   └── admin/
│       ├── index.ejs      # Admin dashboard
│       ├── products.ejs   # Manage products
│       ├── releases.ejs   # Manage releases
│       ├── signups.ejs    # View signups
│       ├── checkouts.ejs  # All checkouts
│       └── members.ejs    # Member list
├── public/
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   └── js/
│       └── app.js         # Frontend JavaScript
├── data/
│   └── aco.db             # SQLite database (auto-created)
├── package.json
├── .env.example
└── README.md
```

## Default Admin Access

After the first user logs in via Discord, you can manually promote them to admin by:

1. Accessing the database:
   ```bash
   sqlite3 data/aco.db
   ```

2. Running:
   ```sql
   UPDATE users SET is_admin = 1 WHERE id = 'their-discord-id';
   ```

Or implement an admin creation script.

## Available Categories

### Pokemon - Target
- Scarlet & Violet Booster Boxes
- Elite Trainer Boxes
- Pokemon Center Exclusives

### Sports Cards
- Panini Prizm (Football, Basketball, Baseball)
- Panini Select
- Panini Mosaic
- Topps Chrome

### One Piece TCG
- Romance Dawn, Paramount War, Pillars of Strength
- Kingdoms of Intrigue, Wings of the Captain
- 500 Years Quest
- Starter Decks

## API Routes

### User Routes
- `GET /` - Home page
- `GET /login` - Login page
- `GET /auth/discord` - Discord OAuth login
- `GET /auth/discord/callback` - OAuth callback
- `GET /logout` - Logout
- `GET /dashboard` - User dashboard
- `GET /products` - Product catalog
- `POST /checkouts` - Add checkout
- `GET /releases` - View releases
- `POST /releases/:id/signup` - Sign up for release

### Admin Routes
- `GET /admin` - Admin dashboard
- `GET /admin/products` - Manage products
- `POST /admin/products` - Add product
- `PUT /admin/products/:id` - Update product
- `DELETE /admin/products/:id` - Delete product
- `GET /admin/releases` - Manage releases
- `POST /admin/releases` - Add release
- `PUT /admin/releases/:id` - Update release
- `DELETE /admin/releases/:id` - Delete release
- `GET /admin/signups` - View all signups
- `GET /admin/checkouts` - View all checkouts
- `GET /admin/members` - Member list
- `POST /admin/members/:id/promote` - Promote to admin
- `POST /admin/members/:id/demote` - Demote from admin

## Customization

### Adding New Categories

Edit `models/database.js` and add to the product seeding section:

```javascript
{ name: 'New Product', sku: 'new-sku', category: 'New Category', description: 'Description', active: 1 }
```

### Styling

Edit `public/css/style.css` to customize the look. The theme uses CSS variables:

```css
:root {
  --primary: #5865F2;
  --secondary: #3BA55C;
  --danger: #ED4245;
  --dark: #2C2F33;
  /* ... */
}
```

### Adding New Pages

1. Create an EJS template in `views/`
2. Add a route in `server.js`
3. Add navigation link in `views/partials/layout.ejs`

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a secure `SESSION_SECRET`
3. Set up HTTPS (required for Discord OAuth in production)
4. Update `DISCORD_CALLBACK_URL` to your production URL
5. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name aco-dashboard
   ```

## License

MIT License
