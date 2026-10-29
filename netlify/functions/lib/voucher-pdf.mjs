import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as assets from './assets.mjs';
import { formatDateCz, trainingsLabel } from './voucher.mjs';

// PDF dárkového poukazu, A5 na šířku (stejný vzhled jako původní tisková verze)

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 148 * MM;
const MARGIN = 11 * MM;
const PHOTO_W = 64 * MM;

const color = (r, g, b) => rgb(r / 255, g / 255, b / 255);
const DARK = color(0, 52, 89);
const LIGHT = color(135, 206, 235);
const WHITE = color(255, 255, 255);
const SLATE_200 = color(226, 232, 240);
const SLATE_300 = color(203, 213, 225);
const SLATE_400 = color(148, 163, 184);

const bytes = (b64) => Buffer.from(b64, 'base64');

function wrap(text, font, size, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// Text s prostrkáním písmen (tracking)
function drawSpaced(page, text, { x, y, size, font, color: fill, spacing }) {
    let cursor = x;
    for (const char of text) {
        page.drawText(char, { x: cursor, y, size, font, color: fill });
        cursor += font.widthOfTextAtSize(char, size) + spacing;
    }
}

export async function renderVoucherPdf(voucher) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    doc.setTitle('Dárkový poukaz – Mader Boxing');
    doc.setAuthor('Samuel Mader');
    doc.setCreator('maderboxing.cz');

    const [regular, italic, bold, extraBold] = await Promise.all(
        [assets.regular, assets.italic, assets.bold, assets.extraBold].map((font) => doc.embedFont(bytes(font))),
    );
    const logo = await doc.embedPng(bytes(assets.logo));
    const photo = await doc.embedJpg(bytes(assets.photo));

    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: DARK });

    // Fotka vpravo (přechod do tmavého pozadí je už součástí obrázku)
    const photoX = PAGE_W - PHOTO_W;
    page.drawImage(photo, { x: photoX, y: 0, width: PHOTO_W, height: PAGE_H });

    const x = MARGIN;
    const textWidth = photoX - MARGIN - 8 * MM;

    // Logo
    const logoW = 42 * MM;
    const logoH = (logo.height / logo.width) * logoW;
    page.drawImage(logo, { x, y: PAGE_H - MARGIN - logoH, width: logoW, height: logoH });

    // Prostřední blok – nejdřív sestavit řádky, pak svisle vycentrovat
    const multiple = voucher.count > 1;
    const rows = [];
    rows.push({ type: 'eyebrow', height: 10 * 1.2, gapAfter: 2 * MM });
    rows.push({ type: 'title', text: `na ${trainingsLabel(voucher.count)} boxu`, height: 26 * 1.1, gapAfter: 2.5 * MM });
    const subtitle = `${multiple ? 'Soukromé lekce' : 'Soukromá lekce'} boxu (60 minut) s mistrem České republiky Samuelem Maderem`;
    for (const line of wrap(subtitle, regular, 10, textWidth)) rows.push({ type: 'subtitle', text: line, height: 10 * 1.45 });
    if (voucher.recipient) {
        rows.push({ type: 'gap', height: 5 * MM });
        rows.push({ type: 'recipient', text: voucher.recipient, height: 13 * 1.3 });
    }
    if (voucher.dedication) {
        rows.push({ type: 'gap', height: voucher.recipient ? 1 * MM : 5 * MM });
        for (const line of wrap(voucher.dedication, italic, 11, textWidth)) rows.push({ type: 'dedication', text: line, height: 11 * 1.35 });
    }
    if (multiple) {
        rows.push({ type: 'gap', height: 5 * MM });
        rows.push({ type: 'stamps', height: 8 * MM });
    }

    const blockHeight = rows.reduce((sum, row) => sum + row.height + (row.gapAfter || 0), 0);
    const regionTop = PAGE_H - MARGIN - logoH - 6 * MM;
    const regionBottom = MARGIN + 24 * MM;
    let cursor = regionTop - Math.max(0, (regionTop - regionBottom - blockHeight) / 2);

    for (const row of rows) {
        const baseline = cursor - row.height * 0.8;
        switch (row.type) {
            case 'eyebrow':
                drawSpaced(page, 'DÁRKOVÝ POUKAZ', { x, y: baseline, size: 10, font: bold, color: LIGHT, spacing: 3 });
                break;
            case 'title':
                page.drawText(row.text, { x, y: baseline, size: 26, font: extraBold, color: WHITE });
                break;
            case 'subtitle':
                page.drawText(row.text, { x, y: baseline, size: 10, font: regular, color: SLATE_300 });
                break;
            case 'recipient': {
                const label = 'Pro: ';
                page.drawText(label, { x, y: baseline, size: 13, font: regular, color: WHITE });
                page.drawText(row.text, { x: x + regular.widthOfTextAtSize(label, 13), y: baseline, size: 13, font: bold, color: WHITE });
                break;
            }
            case 'dedication':
                page.drawText(row.text, { x, y: baseline, size: 11, font: italic, color: SLATE_200 });
                break;
            case 'stamps': {
                const r = 4 * MM;
                for (let i = 0; i < voucher.count; i++) {
                    page.drawCircle({
                        x: x + r + i * (2 * r + 3 * MM),
                        y: cursor - r,
                        size: r - 0.75,
                        borderColor: LIGHT,
                        borderWidth: 1.5,
                    });
                }
                break;
            }
        }
        cursor -= row.height + (row.gapAfter || 0);
    }

    // Spodní blok: data a kontakt
    const contactLines = [
        'Termín si domluvte na +420 724 396 877 nebo přes Instagram @sam_mader_.',
        'BOX CLUB Hradec Králové, Československé armády 216/41 · maderboxing.cz',
    ];
    contactLines.forEach((line, i) => {
        page.drawText(line, { x, y: MARGIN + (contactLines.length - 1 - i) * 11, size: 8, font: regular, color: SLATE_300 });
    });

    const labelY = MARGIN + 2 * 11 + 6 * MM + 13;
    const valueY = labelY - 15;
    [
        ['VYSTAVENO', formatDateCz(voucher.issuedAt)],
        ['PLATÍ DO', formatDateCz(voucher.validUntil)],
    ].forEach(([label, value], i) => {
        const colX = x + i * 32 * MM;
        drawSpaced(page, label, { x: colX, y: labelY, size: 8, font: regular, color: SLATE_400, spacing: 0.8 });
        page.drawText(value, { x: colX, y: valueY, size: 12, font: bold, color: WHITE });
    });

    return doc.save();
}
