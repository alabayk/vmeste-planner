import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 3000);
const host = process.env.IP || process.env.HOST || '127.0.0.1';
const pool = process.env.DATABASE_URL ? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
}) : null;
const people = new Set(['vanya', 'ksusha']);
const spaces = new Set(['vanya', 'ksusha', 'shared']);
const streams = new Set();

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function currentUser(req) {
  const value = req.headers['x-planner-user'];
  return people.has(value) ? value : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => {
      value += chunk;
      if (value.length > 100_000) reject(new Error('too_large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(value || '{}')); } catch { reject(new Error('bad_json')); }
    });
  });
}

function notify() {
  for (const stream of streams) stream.write('data: {"type":"changed"}\n\n');
}

async function api(req, res, url) {
  const user = currentUser(req) || (url.pathname === '/api/stream' && people.has(url.searchParams.get('user')) ? url.searchParams.get('user') : null);
  if (!user) return send(res, 401, { error: 'Выберите, кто вы' });
  if (!pool) return send(res, 503, { error: 'База данных ещё не подключена' });

  if (req.method === 'GET' && url.pathname === '/api/events') {
    const { rows } = await pool.query(`SELECT id,title,notes,starts_at AS "startsAt",
      duration_minutes AS "durationMinutes",space,created_by AS "createdBy",done,deleted,
      version,updated_at AS "updatedAt" FROM planner_events ORDER BY starts_at`);
    return send(res, 200, { events: rows });
  }

  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('data: {"type":"ready"}\n\n');
    streams.add(res);
    req.on('close', () => streams.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/events') {
    const event = await readBody(req);
    if (!event || typeof event.id !== 'string' || !event.title?.trim() || event.title.length > 120 ||
        !spaces.has(event.space) || Number.isNaN(Date.parse(event.startsAt))) {
      return send(res, 400, { error: 'Проверьте название, дату и место' });
    }
    if (event.space !== 'shared' && event.space !== user) {
      return send(res, 403, { error: 'Нельзя менять личный план другого человека' });
    }
    const values = [event.id, event.title.trim(), String(event.notes || '').slice(0, 600), event.startsAt,
      Number(event.durationMinutes || 30), event.space, user, Boolean(event.done), Boolean(event.deleted), Number(event.version || 0)];
    const { rows } = await pool.query(`INSERT INTO planner_events
      (id,title,notes,starts_at,duration_minutes,space,created_by,done,deleted,version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)
      ON CONFLICT (id) DO UPDATE SET title=$2,notes=$3,starts_at=$4,duration_minutes=$5,
      space=$6,done=$8,deleted=$9,version=planner_events.version+1,updated_at=now()
      WHERE planner_events.version <= $10
      RETURNING id,title,notes,starts_at AS "startsAt",duration_minutes AS "durationMinutes",
      space,created_by AS "createdBy",done,deleted,version,updated_at AS "updatedAt"`, values);
    if (!rows[0]) return send(res, 409, { error: 'Этот план уже изменён на другом устройстве' });
    notify();
    return send(res, 200, { event: rows[0] });
  }
  send(res, 404, { error: 'Не найдено' });
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(path.resolve(root))) return send(res, 403, { error: 'Нет доступа' });
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream',
        'cache-control': relative === 'sw.js' ? 'no-cache' : 'public, max-age=3600' });
      res.end(data);
    });
  } catch (error) {
    console.error(error);
    send(res, 500, { error: 'Ошибка сервера' });
  }
}).listen(port, host, () => console.log(`Planner listening on ${host}:${port}`));
