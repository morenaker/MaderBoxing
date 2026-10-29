import crypto from 'node:crypto';
import { PublicError } from './voucher.mjs';

// Přihlášení do administrace: heslo z proměnné ADMIN_PASSWORD (nastavuje se v Netlify),
// po přihlášení podepsaný token platný 12 hodin. Změna hesla zneplatní všechny tokeny.

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function password() {
    const value = process.env.ADMIN_PASSWORD;
    if (!value) {
        throw new PublicError('Administrace ještě není nastavená: v Netlify chybí proměnná ADMIN_PASSWORD.', 503);
    }
    return value;
}

function sign(data) {
    const key = crypto.createHash('sha256').update(`mb-admin:${password()}`).digest();
    return crypto.createHmac('sha256', key).update(data).digest('base64url');
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();

export async function login(attempt) {
    if (!crypto.timingSafeEqual(sha256(attempt || ''), sha256(password()))) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // zpomalení hádání hesla
        return null;
    }
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function isAuthorized(header) {
    if (!header || !header.startsWith('Bearer ')) return false;
    const [payload, signature] = header.slice(7).split('.');
    if (!payload || !signature) return false;

    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
    } catch {
        return false;
    }
}
