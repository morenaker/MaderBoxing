// Společné pomocné funkce pro poukazy (texty, data, validace)

export const MAX_TRAININGS = 10;
export const VALIDITY_MONTHS = 6;

// 1 trénink, 2–4 tréninky, 5+ tréninků
export function trainingsLabel(count) {
    if (count === 1) return '1 trénink';
    if (count >= 2 && count <= 4) return `${count} tréninky`;
    return `${count} tréninků`;
}

// Dnešní datum v Praze jako YYYY-MM-DD
export function todayIso() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
}

export function addMonthsIso(iso, months) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + months, d));
    return date.toISOString().slice(0, 10);
}

export function formatDateCz(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${Number(d)}. ${Number(m)}. ${y}`;
}

export class PublicError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.publicMessage = message;
        this.status = status;
    }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Vstup z administrace → bezpečný objekt poukazu
export function normalizeVoucher(input = {}, { requireEmail = true } = {}) {
    const email = String(input.email || '').trim();
    if (requireEmail && !EMAIL.test(email)) throw new PublicError('Zadejte platný e-mail.');

    const count = Math.trunc(Number(input.count));
    if (!(count >= 1 && count <= MAX_TRAININGS)) {
        throw new PublicError(`Počet vstupů musí být 1 až ${MAX_TRAININGS}.`);
    }

    const issuedAt = ISO_DATE.test(input.issuedAt || '') ? input.issuedAt : todayIso();
    const validUntil = ISO_DATE.test(input.validUntil || '') ? input.validUntil : addMonthsIso(issuedAt, VALIDITY_MONTHS);

    return {
        email,
        count,
        recipient: String(input.recipient || '').trim().slice(0, 60),
        dedication: String(input.dedication || '').trim().slice(0, 120),
        issuedAt,
        validUntil,
        orderId: input.orderId ? String(input.orderId) : null,
    };
}
