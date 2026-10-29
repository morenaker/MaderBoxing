import { mkdirSync, writeFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { formatDateCz, PublicError, trainingsLabel } from './voucher.mjs';

// Odeslání poukazu e-mailem přes SMTP (výchozí Seznam).
// Proměnné v Netlify: SMTP_USER, SMTP_PASS, volitelně SMTP_HOST, SMTP_PORT, MAIL_FROM_NAME, MAIL_BCC.
// MB_DEV_MAIL_DIR → e-mail se jen uloží jako .eml soubor (lokální testování).

function transport() {
    if (process.env.MB_DEV_MAIL_DIR) {
        return nodemailer.createTransport({ streamTransport: true, buffer: true });
    }
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
        throw new PublicError('Odesílání e-mailů ještě není nastavené: v Netlify chybí SMTP_USER a SMTP_PASS.', 503);
    }
    const port = Number(process.env.SMTP_PORT || 465);
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.seznam.cz',
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function message(voucher) {
    const what = `${trainingsLabel(voucher.count)} boxu`;
    const forWhom = voucher.recipient ? ` Poukaz je vystavený na jméno ${voucher.recipient}.` : '';
    const valid = formatDateCz(voucher.validUntil);

    const text = [
        'Dobrý den,',
        '',
        `děkuji za platbu. V příloze posílám dárkový poukaz na ${what}.${forWhom}`,
        '',
        `Poukaz platí do ${valid}. Termín tréninku si stačí domluvit na +420 724 396 877 nebo přes Instagram @sam_mader_.`,
        'Tréninky probíhají v BOX CLUB Hradec Králové, Československé armády 216/41.',
        '',
        'Ať se trénink líbí!',
        '',
        'Samuel Mader',
        'Mader Boxing · https://maderboxing.cz',
    ].join('\n');

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b">
<p>Dobrý den,</p>
<p>děkuji za platbu. V příloze posílám <strong>dárkový poukaz na ${escapeHtml(what)}</strong>.${escapeHtml(forWhom)}</p>
<p>Poukaz platí do <strong>${escapeHtml(valid)}</strong>. Termín tréninku si stačí domluvit na
<a href="tel:+420724396877">+420 724 396 877</a> nebo přes Instagram
<a href="https://www.instagram.com/sam_mader_/">@sam_mader_</a>.<br>
Tréninky probíhají v BOX CLUB Hradec Králové, Československé armády 216/41.</p>
<p>Ať se trénink líbí!</p>
<p>Samuel Mader<br><a href="https://maderboxing.cz" style="color:#003459">Mader Boxing · maderboxing.cz</a></p>
</div>`;

    return { subject: `Dárkový poukaz na ${what} – Mader Boxing`, text, html };
}

export async function sendVoucherEmail(voucher, pdfBytes) {
    const sender = process.env.SMTP_USER || 'dev@maderboxing.cz';
    const { subject, text, html } = message(voucher);
    const info = await transport().sendMail({
        from: { name: process.env.MAIL_FROM_NAME || 'Samuel Mader – Mader Boxing', address: sender },
        to: voucher.email,
        bcc: process.env.MAIL_BCC === 'off' ? undefined : process.env.MAIL_BCC || sender, // kopie pro mě
        replyTo: sender,
        subject,
        text,
        html,
        attachments: [
            { filename: 'Darkovy-poukaz-Mader-Boxing.pdf', content: Buffer.from(pdfBytes), contentType: 'application/pdf' },
        ],
    });

    if (process.env.MB_DEV_MAIL_DIR) {
        mkdirSync(process.env.MB_DEV_MAIL_DIR, { recursive: true });
        writeFileSync(`${process.env.MB_DEV_MAIL_DIR}/${Date.now()}.eml`, info.message);
    }
}
