# ACO Dashboard - Project Memory

*Last updated: 2026-01-27*

## Project Overview
Automated Checkout (ACO) Dashboard for managing checkout services, product selection, and release signups.

**URL:** https://aco-dashboard-production.up.railway.app/
**GitHub:** https://github.com/hklivefast/aco-dashboard

## Tech Stack
- **Backend:** Express.js, Node.js
- **Database:** SQLite (sql.js - pure JS, no native compilation needed)
- **Auth:** Discord OAuth2 (Passport.js)
- **Views:** EJS templates
- **Styling:** Custom CSS with dark theme and neon accents
- **Deployment:** Railway

## Features Implemented

### For Members
- Discord OAuth2 login with server membership verification
- Product catalog with 3 categories:
  - 🎴 Pokemon - Target (6 products, placeholder SKUs)
  - 🏀 Sports Cards (8 products, Panini Prizm/Select/Mosaic)
  - 🏴‍☠️ One Piece TCG (8 products)
- Checkout tracking (add, view status)
- Release calendar with Google Form signups
- Dashboard with stats and quick actions

### For Admins
- Manage products (add/edit/delete)
- Manage releases (add/edit/delete with Google Form URLs)
- View all signups
- View all checkouts
- Member list with promote/demote admin

## Product Categories & Placeholders

### Pokemon - Target
- Pokemon TCG Scarlet & Violet - Base Set Booster Box
- Pokemon TCG Scarlet & Violet - Paradox Rift Booster Box
- Pokemon TCG Scarlet & Violet - Obsidian Flames Booster Box
- Pokemon TCG Scarlet & Violet - Paldean Fates Booster Box
- Pokemon TCG Elite Trainer Box - Scarlet & Violet
- Pokemon TCG - Pokémon Center Elite Trainer Box

### Sports Cards
- Panini Prizm Football Hobby Box
- Panini Prizm Basketball Hobby Box
- Panini Select Football Hobby Box
- Panini Select Basketball Hobby Box
- Panini Mosaic Football Hobby Box
- Panini Mosaic Basketball Hobby Box
- Topps Chrome Baseball Hobby Box
- Panini Prizm Baseball Hobby Box

### One Piece TCG
- Romance Dawn Booster Box
- Paramount War Booster Box
- Pillars of Strength Booster Box
- Kingdoms of Intrigue Booster Box
- Wings of the Captain Booster Box
- 500 Years Quest Booster Box
- Starter Deck
- Booster Box Case

## Environment Variables Required

| Variable | Value |
|----------|-------|
| `DISCORD_CLIENT_ID` | From Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | From Discord Developer Portal |
| `DISCORD_GUILD_ID` | Discord server ID for membership check |
| `DISCORD_CALLBACK_URL` | `https://aco-dashboard-production.up.railway.app/auth/discord/callback` |
| `SESSION_SECRET` | `ISZrjtglpI/wg2u+uZmFAQ2o0qj4pBWeLsBCiTldwJ8=` |
| `PORT` | `3000` |

## Discord OAuth Setup

1. Create app at https://discord.com/developers/applications
2. OAuth2 → Add Redirect:
   - `https://aco-dashboard-production.up.railway.app/auth/discord/callback`
3. Copy Client ID and Secret to Railway variables

## Design Decisions

### UI/UX
- **Theme:** Dark mode (#0a0a0f background)
- **Accents:** Neon purple (#8b5cf6) and cyan (#06b6d4) gradient
- **Font:** Inter (Google Fonts)
- **Card-based layout** with glow effects and hover animations
- **Responsive design** for mobile

### Known Issues Fixed
- Views initially created as partial HTML fragments without full structure
- Fixed by adding complete HTML skeleton to all EJS templates
- Each view now has `<!DOCTYPE html>`, `<head>`, `<body>`, navigation, and footer

## Future Tasks / To Do
- Replace placeholder SKUs with real Target/Sports/One Piece SKUs
- Add real Google Form URLs for releases
- Consider adding email notifications for releases
- Potentially add checkout status email/SMS notifications

## Key Files
- `/server.js` - Main Express application
- `/models/database.js` - SQLite database with sql.js
- `/public/css/style.css` - Dark theme styling
- `/views/*.ejs` - All page templates (now with full HTML structure)

## Notes
- All users who log in are initially granted admin access
- Member roles can be managed via `/admin/members` page
- The `partials/layout.ejs` exists but wasn't being used; each view now includes full HTML structure directly
