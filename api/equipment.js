// Endpoint disabled: project reverted to Supabase backend.
// This function now returns 410 Gone to indicate it is not in use.
module.exports = async (req, res) => {
  res.status(410).json({ ok: false, error: 'Endpoint disabled. Using Supabase backend.' })
}
