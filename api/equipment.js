// List equipment from Vercel Postgres
// GET /api/equipment

const { sql } = require('@vercel/postgres')

const SAMPLE = [
  { id: 1, name: 'كاميرا Sony A7', category: 'كاميرات', total_qty: 5, available_qty: 3 },
  { id: 2, name: 'عدسة 24-70mm', category: 'عدسات', total_qty: 8, available_qty: 6 },
]

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  try {
    // Expect a table "equipment" with columns: id, name, category, total_qty, available_qty
    const result = await sql`SELECT id, name, category, total_qty, available_qty FROM equipment ORDER BY name ASC`
    res.status(200).json({ ok: true, data: result.rows })
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: err.message,
      hint: 'تأكد من إعداد Vercel Postgres وإضافة POSTGRES_URL في متغيرات البيئة داخل Vercel',
      sample: SAMPLE,
    })
  }
}
