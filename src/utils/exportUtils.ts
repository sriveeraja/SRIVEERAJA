import { Customer, DetectedLanguage, Transaction } from '../types/ledger';
import { formatINR } from './localization';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsCsv(
  transactions: Transaction[],
  customers: Customer[],
  shopName: string,
  filePrefix = 'khatawas-ledger'
): void {
  const customerMap = new Map<string, Customer>();
  for (const c of customers) customerMap.set(c.id, c);

  const headers = [
    'Transaction ID',
    'Date',
    'Recorded At',
    'Customer Name',
    'Area',
    'Phone',
    'Type',
    'Amount (INR)',
    'Note',
    'Source Command',
    'Language',
    'Confidence (%)',
  ];

  const rows = [...transactions]
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)))
    .map((tx) => {
      const cust = customerMap.get(tx.customerId);
      return [
        tx.id,
        tx.date,
        new Date(tx.createdAt).toLocaleString('en-IN'),
        cust?.name || 'Unknown',
        cust?.area || '',
        cust?.phone || '',
        tx.type === 'CREDIT' ? 'Credit (Udhaar)' : 'Payment (Jama)',
        tx.amount,
        tx.note,
        tx.sourceCommand || '',
        tx.detectedLanguage || '',
        tx.confidence ?? '',
      ]
        .map(escapeCsvCell)
        .join(',');
    });

  const csvContent = `\uFEFF${headers.map(escapeCsvCell).join(',')}\r\n${rows.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `${filePrefix}-${slug}-${dateStr}.csv`);
}

function sanitizePdfAscii(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a valid single/multi-page PDF 1.4 statement file for a customer
 * using Helvetica + Courier standard Type1 fonts with zero external dependencies.
 */
export function downloadCustomerStatementPdf(
  customer: Customer,
  transactions: Transaction[],
  shopName: string
): void {
  const customerTxs = [...transactions]
    .filter((t) => t.customerId === customer.id)
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)));

  const totalCredit = customerTxs
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPayment = customerTxs
    .filter((t) => t.type === 'PAYMENT')
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalCredit - totalPayment;

  const linesPerPage = 38;
  const txChunks: Transaction[][] = [];
  for (let i = 0; i < Math.max(1, customerTxs.length); i += linesPerPage) {
    txChunks.push(customerTxs.slice(i, i + linesPerPage));
  }

  const pageContentStreams: string[] = txChunks.map((chunk, pageIdx) => {
    const cmds: string[] = [];
    let y = 785;

    const addText = (font: 'F1' | 'F2', size: number, x: number, posY: number, txt: string) => {
      cmds.push(`BT /${font} ${size} Tf ${x} ${posY} Td (${sanitizePdfAscii(txt)}) Tj ET`);
    };

    // Header
    addText('F2', 16, 48, y, `KHATAWAS - ${shopName}`);
    y -= 18;
    addText('F1', 10, 48, y, `Customer Ledger Statement  |  Generated: ${new Date().toLocaleDateString('en-IN')}  |  Page ${pageIdx + 1}/${txChunks.length}`);
    y -= 12;
    cmds.push(`0.8 w 48 ${y} m 547 ${y} l S`);
    y -= 20;

    if (pageIdx === 0) {
      addText('F2', 12, 48, y, `Customer: ${customer.name} (${customer.area})`);
      y -= 15;
      addText('F1', 10, 48, y, `Phone: ${customer.phone}   |   Note: ${customer.note}`);
      y -= 18;
      addText(
        'F2',
        11,
        48,
        y,
        `Total Credit: Rs.${formatINR(totalCredit)}   |   Total Paid: Rs.${formatINR(totalPayment)}   |   Net Balance: Rs.${formatINR(Math.abs(netBalance))} ${
          netBalance > 0 ? '(Due)' : netBalance < 0 ? '(Advance)' : '(Settled)'
        }`
      );
      y -= 16;
      cmds.push(`0.5 w 48 ${y} m 547 ${y} l S`);
      y -= 18;
    }

    // Table header
    addText('F2', 9, 48, y, 'DATE');
    addText('F2', 9, 125, y, 'TYPE');
    addText('F2', 9, 215, y, 'AMOUNT');
    addText('F2', 9, 300, y, 'NOTE / PARTICULARS');
    y -= 8;
    cmds.push(`0.4 w 48 ${y} m 547 ${y} l S`);
    y -= 14;

    if (chunk.length === 0) {
      addText('F1', 10, 48, y, 'No transactions recorded yet.');
    } else {
      for (const tx of chunk) {
        const typeStr = tx.type === 'CREDIT' ? 'CREDIT' : 'PAYMENT';
        const amtStr = `${tx.type === 'CREDIT' ? '+' : '-'}Rs.${formatINR(tx.amount)}`;
        const noteStr = (tx.note || tx.sourceCommand || '-').slice(0, 44);
        addText('F1', 9, 48, y, tx.date);
        addText('F2', 9, 125, y, typeStr);
        addText('F2', 9, 215, y, amtStr);
        addText('F1', 9, 300, y, noteStr);
        y -= 16;
      }
    }

    return cmds.join('\n');
  });

  // Assemble valid PDF objects
  const objects: string[] = [];
  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // 2: Pages (kids filled after knowing page obj ids)
  const pageObjIds: number[] = [];
  const nextBaseId = 5; // 3 = Helvetica, 4 = Helvetica-Bold
  pageContentStreams.forEach((_, idx) => {
    pageObjIds.push(nextBaseId + idx * 2);
  });
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj`
  );
  // 3: F1 Helvetica
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  // 4: F2 Helvetica-Bold
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');

  pageContentStreams.forEach((stream, idx) => {
    const pageId = nextBaseId + idx * 2;
    const contentId = pageId + 1;
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const slug = `${customer.name}-${customer.area}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerBlobDownload(blob, `khatawas-statement-${slug}.pdf`);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildWhatsAppReminderMessage(
  customer: Customer,
  balance: number,
  shopName: string,
  lang: DetectedLanguage
): string {
  const amt = formatINR(Math.abs(balance));
  if (balance <= 0) {
    if (lang === 'kn') {
      return `Namaskara ${customer.name} avare, ${shopName} khateyalli nimma balance clear aagide (₹0). Dhanyavadagalu!`;
    }
    if (lang === 'hi' || lang === 'hinglish') {
      return `Namaste ${customer.name} ji, ${shopName} mein aapka khata clear hai (₹0). Dhanyavaad!`;
    }
    return `Hello ${customer.name}, your account balance at ${shopName} is settled (₹0). Thank you!`;
  }

  if (lang === 'kn') {
    return `Namaskara ${customer.name} avare, ${shopName} khateyalli nimma udhaara baaki ₹${amt} ide. Dayavittu anukoolavadaga jama maadi. Dhanyavadagalu!`;
  }
  if (lang === 'hi' || lang === 'hinglish') {
    return `Namaste ${customer.name} ji, ${shopName} mein aapka ₹${amt} udhaar baaki hai. Kripya suvidha anusar jama karein. Dhanyavaad!`;
  }
  return `Hello ${customer.name}, a gentle reminder that your pending balance at ${shopName} is ₹${amt}. Kindly settle at your convenience. Thank you!`;
}

export function buildWhatsAppShareUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;
  const encodedText = encodeURIComponent(message);
  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}
