// Browser replacement for server/db.js (same API) — the offline build keeps saves in localStorage.
const KEY = 'tenend-offline-db-v1';
export const db = { accounts: {}, chars: {}, guilds: {}, market: [], season: { id: 1, started: Date.now() }, seq: 1 };
export function loadDB() { try { const s = localStorage.getItem(KEY); if (s) Object.assign(db, JSON.parse(s)); } catch { /* storage unavailable: play without saving */ } }
export function saveDB() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } }
export function resetDB() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export const nextId = (p) => `${p}${(db.seq++).toString(36)}${Math.random().toString(16).slice(2, 6)}`;
function h(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); }
export function hashPass(pass, salt = Math.random().toString(36).slice(2)) { return { salt, hash: h(salt + pass) }; }
export function checkPass(pass, acc) { return h(acc.salt + pass) === acc.hash; }
export function newToken() { return Math.random().toString(36).slice(2); }
