import { connectLambda } from '@netlify/blobs';
import { store } from './lib/store.mjs';

// Netlify tuto funkci spustí po každém ověřeném odeslání formuláře.
// Objednávky poukazů ukládá do úložiště, odkud je čte administrace.

export const handler = async (event) => {
    if (!process.env.MB_MEMORY_STORE) connectLambda(event);

    const { payload } = JSON.parse(event.body || '{}');
    if (!payload || payload.form_name !== 'poukaz') {
        return { statusCode: 200, body: 'ignored' };
    }

    const data = payload.data || {};
    const id = String(payload.id || `${Date.now().toString(36)}`);
    const count = parseInt(data.poukaz, 10);

    await store('orders').setJSON(id, {
        id,
        createdAt: payload.created_at || new Date().toISOString(),
        name: String(data.jmeno || '').trim(),
        email: String(data.email || '').trim(),
        phone: String(data.telefon || '').trim(),
        voucher: String(data.poukaz || ''),
        count: count >= 1 ? count : 1,
        recipient: String(data.pro_koho || '').trim(),
        note: String(data.poznamka || '').trim(),
        status: 'new', // new → sent / cancelled
    });

    return { statusCode: 200, body: 'ok' };
};
