// Simple JSON-file persistence (swap with a real DB later: keep the same functions)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIR = process.env.DATA_DIR || path.resolve('data');
const FILE = path.join(DIR, 'db.json');

export const db = { accounts: {}, chars: {}, guilds: {}, market: [], season: { id: 1, started: Date.now() }, seq: 1 };

export function loadDB() {
  try {
    if (fs.existsSync(FILE)) Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8')));
    console.log(`[db] loaded ${Object.keys(db.accounts).length} accounts, ${Object.keys(db.chars).length} chars`);
  } catch (e) { console.error('[db] load failed', e); }
}
let saving = false;
export function saveDB() {
  if (saving) return; saving = true;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(FILE + '.tmp', FILE);
  } catch (e) { console.error('[db] save failed', e); }
  saving = false;
}
export const nextId = (p) => `${p}${(db.seq++).toString(36)}${crypto.randomBytes(2).toString('hex')}`;
export function hashPass(pass, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pass, salt, 32).toString('hex') };
}
export function checkPass(pass, acc) {
  const h = crypto.scryptSync(pass, acc.salt, 32);
  return crypto.timingSafeEqual(h, Buffer.from(acc.hash, 'hex'));
}
export function newToken() { return crypto.randomBytes(24).toString('hex'); }
