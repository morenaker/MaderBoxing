import { isAuthorized, login } from './lib/auth.mjs';
import { sendVoucherEmail } from './lib/mail.mjs';
import { listJSON, newId, store } from './lib/store.mjs';
import { normalizeVoucher, PublicError } from './lib/voucher.mjs';
import { renderVoucherPdf } from './lib/voucher-pdf.mjs';

// API administrace (/api/admin/...). Všechno kromě přihlášení vyžaduje token.

export const config = { path: '/api/admin/*' };

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });

const pdfResponse = (bytes) =>
    new Response(bytes, {
        headers: {
            'content-type': 'application/pdf',
            'content-disposition': 'inline; filename="Darkovy-poukaz-Mader-Boxing.pdf"',
            'cache-control': 'no-store',
        },
    });

async function readJson(req) {
    try {
        return await req.json();
    } catch {
        return {};
    }
}

async function getOr404(blobStore, id, notFoundMessage) {
    const item = await blobStore.get(id, { type: 'json' });
    if (!item) throw new PublicError(notFoundMessage, 404);
    return item;
}

export default async (req) => {
    const route = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');
    const method = req.method;
    let match;

    try {
        if (route === 'login' && method === 'POST') {
            const { password } = await readJson(req);
            const token = await login(password);
            return token ? json({ token }) : json({ error: 'Špatné heslo.' }, 401);
        }

        if (!isAuthorized(req.headers.get('authorization'))) {
            return json({ error: 'Nejste přihlášený.' }, 401);
        }

        const orders = store('orders');
        const vouchers = store('vouchers');

        // --- Objednávky z formuláře na webu ---
        if (route === 'orders' && method === 'GET') {
            return json(await listJSON(orders));
        }

        if ((match = route.match(/^orders\/([\w-]+)$/))) {
            const order = await getOr404(orders, match[1], 'Objednávka nebyla nalezena.');
            if (method === 'PATCH') {
                const { status } = await readJson(req);
                if (!['new', 'cancelled'].includes(status)) throw new PublicError('Neplatný stav.');
                order.status = status;
                await orders.setJSON(order.id, order);
                return json(order);
            }
            if (method === 'DELETE') {
                await orders.delete(order.id);
                return json({ ok: true });
            }
        }

        // --- Poukazy ---
        if (route === 'vouchers' && method === 'GET') {
            return json(await listJSON(vouchers));
        }

        if (route === 'vouchers/preview' && method === 'POST') {
            const voucher = normalizeVoucher(await readJson(req), { requireEmail: false });
            return pdfResponse(await renderVoucherPdf(voucher));
        }

        if (route === 'vouchers' && method === 'POST') {
            const input = normalizeVoucher(await readJson(req));
            const voucher = { id: newId(), createdAt: new Date().toISOString(), used: 0, ...input };
            await sendVoucherEmail(voucher, await renderVoucherPdf(voucher));
            voucher.sentAt = new Date().toISOString();
            await vouchers.setJSON(voucher.id, voucher);

            if (voucher.orderId) {
                const order = await orders.get(voucher.orderId, { type: 'json' });
                if (order) {
                    order.status = 'sent';
                    order.voucherId = voucher.id;
                    order.sentAt = voucher.sentAt;
                    await orders.setJSON(order.id, order);
                }
            }
            return json(voucher, 201);
        }

        if ((match = route.match(/^vouchers\/([\w-]+)(?:\/(pdf|resend))?$/))) {
            const voucher = await getOr404(vouchers, match[1], 'Poukaz nebyl nalezen.');
            const action = match[2];

            if (action === 'pdf' && method === 'GET') {
                return pdfResponse(await renderVoucherPdf(voucher));
            }
            if (action === 'resend' && method === 'POST') {
                await sendVoucherEmail(voucher, await renderVoucherPdf(voucher));
                voucher.sentAt = new Date().toISOString();
                await vouchers.setJSON(voucher.id, voucher);
                return json(voucher);
            }
            if (!action && method === 'PATCH') {
                const { used } = await readJson(req);
                const value = Math.trunc(Number(used));
                if (!(value >= 0 && value <= voucher.count)) throw new PublicError('Neplatný počet využitých vstupů.');
                voucher.used = value;
                await vouchers.setJSON(voucher.id, voucher);
                return json(voucher);
            }
            if (!action && method === 'DELETE') {
                await vouchers.delete(voucher.id);
                return json({ ok: true });
            }
        }

        return json({ error: 'Nenalezeno.' }, 404);
    } catch (error) {
        if (error.publicMessage) return json({ error: error.publicMessage }, error.status || 400);
        console.error(error);
        return json({ error: `Něco se pokazilo: ${error.message}` }, 500);
    }
};
