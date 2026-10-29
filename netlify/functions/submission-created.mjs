import { connectLambda } from '@netlify/blobs';
import { store } from './lib/store.mjs';

// Netlify tuto funkci spustí po každém ověřeném odeslání formuláře.
// Objednávky poukazů a zájemce o trénink ukládá do úložiště, odkud je čte administrace.

export const handler = async (event) => {
    if (!process.env.MB_MEMORY_STORE) connectLambda(event);

    const { payload } = JSON.parse(event.body || '{}');
    if (!payload) return { statusCode: 200, body: 'ignored' };

    const data = payload.data || {};
    const id = String(payload.id || `${Date.now().toString(36)}`);
    const createdAt = payload.created_at || new Date().toISOString();

    if (payload.form_name === 'trenink') {
        await store('leads').setJSON(id, {
            id,
            createdAt,
            name: String(data.jmeno || '').trim(),
            email: String(data.email || '').trim(),
            phone: String(data.telefon || '').trim(),
            type: String(data.typ || ''),
            experience: String(data.zkusenosti || ''),
            when: String(data.kdy || '').trim(),
            message: String(data.zprava || '').trim(),
            status: 'new', // new → contacted
        });
        return { statusCode: 200, body: 'ok' };
    }

    if (payload.form_name !== 'poukaz') return { statusCode: 200, body: 'ignored' };
    const count = parseInt(data.poukaz, 10);

    await store('orders').setJSON(id, {
        id,
        createdAt,
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
