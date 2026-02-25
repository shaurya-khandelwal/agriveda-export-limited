# Agriveda Export Limited Website

Business-ready full-stack website for **Agriveda Export Limited** with:
- Product showcase (Turmeric, Ashvagandha, Moringa, Cumin)
- Enquiry flow via Email + WhatsApp
- Role-based authentication (`admin`, `customer`)
- Backend-managed product details
- Admin product editing dashboard

## Tech Stack
- Frontend: HTML, CSS, Vanilla JS
- Backend: Node.js built-in `http` server (no external package required)
- Database: JSON file storage at `data/db.json`

## Run Locally
1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Start server:
   ```bash
   npm run dev
   ```
3. Open:
   - `http://localhost:3000`

## Default Accounts
- Admin:
  - Email: `admin@agrivedaexports.com`
  - Password: `Admin@123`
- Customer:
  - Email: `customer@agrivedaexports.com`
  - Password: `Customer@123`

Change these after first login for production usage.

## API Endpoints
- `POST /api/auth/register` - register customer
- `POST /api/auth/login` - login
- `GET /api/me` - current user
- `GET /api/products` - public list (guest) / full details (logged-in)
- `PUT /api/products/:id` - update product (admin only)
- `POST /api/enquiries` - create enquiry
- `GET /api/enquiries` - list enquiries (admin only)

## Free Hosting (Recommended)

### Option A: Render (Web Service, Free Plan)
1. Push this code to GitHub.
2. Open [Render Dashboard](https://dashboard.render.com) and click **New + > Blueprint**.
3. Select this repo. Render will detect `render.yaml` automatically.
4. Click **Apply** to create and deploy the service.
5. After deploy, open the generated `onrender.com` URL.

`render.yaml` already includes:
- Free plan
- Start command (`npm start`)
- Health check (`/api/health`)
- Environment variables template

### Option B: Railway
1. Push to GitHub.
2. Import repo on [Railway](https://railway.app).
3. Set start command: `npm start`
4. Add environment variables.
5. Deploy.

## GitHub Push Commands
Run these in project folder:

```bash
git init
git add .
git commit -m "Initial business-ready Agriveda Export Limited website"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Production Notes
- Set a strong `JWT_SECRET` in production.
- Set `APP_ORIGIN` to your exact public frontend URL (for example `https://agriveda-export-limited.onrender.com`).
- Use real business `CONTACT_EMAIL` and `WHATSAPP_NUMBER`.
- Enable HTTPS on hosting platform.
- Update default seeded accounts immediately:
  - `admin@agrivedaexports.com / Admin@123`
  - `customer@agrivedaexports.com / Customer@123`
- Current JSON storage (`data/db.json`) is acceptable for demo/MVP only; for true production reliability use a managed database (PostgreSQL/MySQL) because free web services can lose local file data during redeploy/restart.
