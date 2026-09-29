require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const path = require('path');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 14 }
}));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const emailOk = s => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
const userView = u => ({ id: u.id, name: u.name, email: u.email, createdAt: u.created_at });
const requireAuth = (req, res, next) => req.session.userId ? next() : res.status(401).json({ error: 'Silakan login terlebih dahulu.' });

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'jft-a2' });
}));
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: 'Nama harus 2–80 karakter.' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Password harus 10–128 karakter.' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,lower($2),$3) RETURNING id,name,email,created_at', [name.trim(), email.trim(), hash]);
    req.session.userId = rows[0].id;
    res.status(201).json({ user: userView(rows[0]) });
  } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'Email sudah terdaftar.' }); throw e; }
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!emailOk(email) || typeof password !== 'string') return res.status(400).json({ error: 'Email atau password tidak valid.' });
  const { rows } = await pool.query('SELECT id,name,email,password_hash,created_at FROM users WHERE email=lower($1)', [email.trim()]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Email atau password salah.' });
  req.session.regenerate(err => { if (err) return res.status(500).json({ error: 'Gagal membuat sesi.' }); req.session.userId = rows[0].id; res.json({ user: userView(rows[0]) }); });
}));
app.post('/api/auth/logout', (req, res) => req.session.destroy(err => { if (err) return res.status(500).json({ error: 'Gagal logout.' }); res.clearCookie('connect.sid'); res.json({ ok: true }); }));
app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,created_at FROM users WHERE id=$1', [req.session.userId]);
  if (!rows[0]) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Akun tidak ditemukan.' }); }
  res.json({ user: userView(rows[0]) });
}));
app.get('/api/progress', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT category,completed,score,total,details,updated_at FROM progress WHERE user_id=$1 ORDER BY updated_at DESC', [req.session.userId]);
  res.json({ progress: rows });
}));
app.put('/api/progress/:category', requireAuth, asyncRoute(async (req, res) => {
  const category = req.params.category;
  if (!/^[a-z0-9_-]{1,50}$/.test(category)) return res.status(400).json({ error: 'Kategori tidak valid.' });
  const { completed = false, score = null, total = null, details = {} } = req.body || {};
  if (typeof completed !== 'boolean' || (score !== null && (!Number.isFinite(score) || score < 0)) || (total !== null && (!Number.isFinite(total) || total < 0)) || typeof details !== 'object' || details === null || Array.isArray(details)) return res.status(400).json({ error: 'Data progres tidak valid.' });
  const { rows } = await pool.query(`INSERT INTO progress(user_id,category,completed,score,total,details,updated_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(user_id,category) DO UPDATE SET completed=EXCLUDED.completed,score=EXCLUDED.score,total=EXCLUDED.total,details=EXCLUDED.details,updated_at=now() RETURNING category,completed,score,total,details,updated_at`, [req.session.userId, category, completed, score, total, JSON.stringify(details)]);
  res.json({ progress: rows[0] });
}));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Terjadi kesalahan server.' }); });
app.listen(port, () => console.log(`JFT A2 app listening on :${port}`));
