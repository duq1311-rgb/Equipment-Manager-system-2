# Equipment Manager (Web)

Small React + Vite frontend to manage checkout/return of photography equipment. Integrates with Supabase.

Quick start:

1. Fill `.env` values (see `.env.example`) with your Supabase project values.
2. In the project folder run:

```powershell
npm install
npm run dev
```

3. Open the link shown by Vite (usually http://localhost:5173)

Notes:
- There's an `supabase.sql` file with table schema you can import into Supabase.
- Use the Import page to upload an Excel/CSV of equipment (the Excel contains name and quantity columns).
- Admin users can view all transactions. User creation/role management from the site has been removed as requested.
