import type { Outlet, UserRoleProfile } from '../types';
import shopForMeLogoUrl from '../../Admin-Pics/shop for me logo free.png';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchPaymentSettings, type PaymentSettings } from './paymentSettings';

const SFM_LOGO_URL = shopForMeLogoUrl;
const OPTIONAL_IMAGE_TIMEOUT_MS = 2000;
const BRAND_COLORS = {
  green: [22, 101, 52] as const,
  greenDark: [20, 83, 45] as const,
  orange: [249, 115, 22] as const,
  softGreen: [240, 253, 244] as const,
};
const PAYMENT_LOGO_URLS = {
  mtn: null as string | null,
  airtel: null as string | null,
};

type PaymentBrand = keyof typeof PAYMENT_LOGO_URLS;
type PaymentLogoImages = Partial<Record<PaymentBrand, PdfImageData>>;

export interface ShopListPdfItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface ShopListPdfData {
  orderId?: string;
  generatedAt?: Date | string;
  contactName?: string | null;
  contactPhone?: string | null;
  pickupLocation?: string | null;
  outlet: Outlet | null;
  attendant: UserRoleProfile | null;
  items: ShopListPdfItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod?: string | null;
}

type JsPDFDocument = {
  addImage: (imageData: string, format: string, x: number, y: number, w: number, h: number) => void;
  autoTable?: (options: AutoTableOptions) => void;
  lastAutoTable?: { finalY: number };
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (text: string | string[], x: number, y: number, options?: Record<string, unknown>) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addPage: () => void;
  save: (filename: string) => void;
};

type JsPDFConstructor = {
  new (): JsPDFDocument;
};

type AutoTableCell = {
  content: string;
  styles?: Record<string, unknown>;
};

type AutoTableOptions = {
  startY: number;
  head: string[][];
  body: Array<Array<string | AutoTableCell>>;
  margin?: Record<string, number>;
  theme?: string;
  styles?: Record<string, unknown>;
  headStyles?: Record<string, unknown>;
  columnStyles?: Record<number, Record<string, unknown>>;
  tableWidth?: number | string;
  pageBreak?: string;
  rowPageBreak?: string;
};

export async function generateShopListPDF(orderData: ShopListPdfData) {
  const doc = new jsPDF() as JsPDFDocument;
  const generatedAt = orderData.generatedAt ? new Date(orderData.generatedAt) : new Date();
  const contactName = orderData.contactName?.trim() || 'Not provided';
  const contactPhone = orderData.contactPhone?.trim() || 'Not provided';
  const pickupLocation = orderData.pickupLocation?.trim() || 'Pickup station to confirm';
  const outletName = orderData.outlet ? orderData.outlet.hub_market || orderData.outlet.name : 'Outlet to confirm';
  const outletDivision = orderData.outlet?.division || 'Division to confirm';
  const attendantName = orderData.attendant?.full_name || orderData.attendant?.email || 'Not assigned';
  const attendantPhone = orderData.attendant?.phone_number?.trim() || 'Not available';
  const [paymentSettings, attendantAvatar, paymentLogos, shopForMeLogo] = await Promise.all([
    fetchPaymentSettings({ fresh: true }),
    loadPdfImageData(orderData.attendant?.avatar_url),
    loadPaymentLogoImages(),
    loadPdfImageData(SFM_LOGO_URL),
  ]);
  const fileDate = generatedAt.toISOString().slice(0, 10);
  const fileOutlet = orderData.outlet?.outlet_code || 'outlet';

  let y = 18;

  doc.setFillColor(BRAND_COLORS.green[0], BRAND_COLORS.green[1], BRAND_COLORS.green[2]);
  doc.roundedRect(14, y, 182, 24, 3, 3, 'F');
  doc.setFillColor(BRAND_COLORS.orange[0], BRAND_COLORS.orange[1], BRAND_COLORS.orange[2]);
  doc.roundedRect(14, y + 21, 182, 3, 0.8, 0.8, 'F');
  if (shopForMeLogo) {
    doc.addImage(shopForMeLogo.dataUrl, shopForMeLogo.format, 21, y + 5, 13, 13);
  } else {
    drawShopForMeLogoFallback(doc, 21, y + 5);
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Shop For Me', 39, y + 10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(236, 253, 245);
  doc.text('Printable shop list / order summary', 39, y + 18);
  y += 30;

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Order Details', 14, y);
  y = drawOrderDetails(doc, y + 7, {
    date: generatedAt.toLocaleString(),
    orderId: orderData.orderId ? `#${orderData.orderId.slice(0, 8).toUpperCase()}` : 'Pending',
    contactName,
    contactPhone,
    pickupLocation,
  });

  y = drawProductTable(doc, orderData.items, y);

  if (y > 240) {
    doc.addPage();
    y = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal', 140, y, { align: 'right' });
  doc.text(formatPdfUGX(orderData.subtotal), 194, y, { align: 'right' });
  y += 7;
  doc.text('Delivery Fee', 140, y, { align: 'right' });
  doc.text(formatPdfUGX(orderData.deliveryFee), 194, y, { align: 'right' });
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(BRAND_COLORS.green[0], BRAND_COLORS.green[1], BRAND_COLORS.green[2]);
  doc.text('Total Amount Due', 140, y, { align: 'right' });
  doc.text(formatPdfUGX(orderData.totalAmount), 194, y, { align: 'right' });
  y += 12;

  y = ensureSpace(doc, y, 68);
  y = drawAttendantSection(doc, y, {
    outletName,
    outletDivision,
    attendantName,
    attendantPhone,
    attendantAvatar,
  });

  y = ensureSpace(doc, y + 4, 60);
  drawPaymentSection(doc, y, paymentLogos, paymentSettings);

  doc.save(`SFM-shop-list-${fileOutlet}-${fileDate}.pdf`);
}

export async function preloadShopListPdfGenerator() {
  void loadPdfImageData(SFM_LOGO_URL);
}

function drawOrderDetails(
  doc: InstanceType<JsPDFConstructor>,
  y: number,
  details: {
    date: string;
    orderId: string;
    contactName: string;
    contactPhone: string;
    pickupLocation: string;
  },
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text(`Date: ${details.date}`, 14, y);
  doc.text(`Order ID: ${details.orderId}`, 112, y);
  doc.text(`Client: ${details.contactName}`, 14, y + 6);
  doc.text(`Client phone: ${details.contactPhone}`, 112, y + 6);
  doc.text(doc.splitTextToSize(`Pickup location: ${details.pickupLocation}`, 178), 14, y + 12);
  return y + 22;
}

function drawAttendantSection(
  doc: InstanceType<JsPDFConstructor>,
  y: number,
  details: {
    outletName: string;
    outletDivision: string;
    attendantName: string;
    attendantPhone: string;
    attendantAvatar: PdfImageData | null;
  },
) {
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Outlet & Attendant', 14, y);

  const boxY = y + 5;
  doc.setDrawColor(209, 213, 219);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, boxY, 182, 34, 2, 2, 'FD');

  const avatarX = 18;
  const avatarY = boxY + 7;
  const avatarSize = 18;
  if (details.attendantAvatar) {
    doc.addImage(details.attendantAvatar.dataUrl, details.attendantAvatar.format, avatarX, avatarY, avatarSize, avatarSize);
    doc.setDrawColor(156, 163, 175);
    doc.roundedRect(avatarX, avatarY, avatarSize, avatarSize, 2, 2);
  } else {
    drawInitialsAvatar(doc, getInitials(details.attendantName), avatarX, avatarY, avatarSize);
  }

  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text(details.attendantName, 42, boxY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(`Attendant phone: ${details.attendantPhone}`, 42, boxY + 18);
  doc.text(`Outlet: ${details.outletName}`, 42, boxY + 25);
  doc.text(`Division: ${details.outletDivision}`, 126, boxY + 25);

  return boxY + 40;
}

function drawProductTable(doc: InstanceType<JsPDFConstructor>, items: ShopListPdfItem[], y: number) {
  const compact = items.length > 10;
  const visibleItems = items.slice(0, 12);
  const hiddenItemCount = Math.max(0, items.length - visibleItems.length);
  const body: AutoTableOptions['body'] = visibleItems.map((item) => [
    item.name,
    String(item.quantity),
    item.unit || '-',
    formatPdfUGX(item.price),
    formatPdfUGX(item.price * item.quantity),
  ]);

  if (hiddenItemCount > 0) {
    body.push([
      {
        content: `+${hiddenItemCount} more item(s) included in the saved order. Open the order record for the full item list.`,
        styles: { fontStyle: 'italic', textColor: [75, 85, 99] },
      },
      '',
      '',
      '',
      '',
    ]);
  }

  try {
    autoTable(doc, {
      startY: y,
      head: [['Product', 'Qty', 'Unit', 'Each', 'Line Total']],
      body,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      tableWidth: 182,
      pageBreak: 'avoid',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: compact ? 7.4 : 8,
        cellPadding: compact ? 1.2 : 1.6,
        overflow: 'linebreak',
        lineColor: [229, 231, 235],
        lineWidth: 0.15,
        textColor: [31, 41, 55],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [...BRAND_COLORS.softGreen],
        textColor: [...BRAND_COLORS.greenDark],
        fontStyle: 'bold',
        lineColor: [187, 247, 208],
      },
      columnStyles: {
        0: { cellWidth: 66 },
        1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 32 },
        3: { cellWidth: 31, halign: 'right' },
        4: { cellWidth: 41, halign: 'right' },
      },
    });

    return (doc.lastAutoTable?.finalY ?? y) + 8;
  } catch (error) {
    console.warn('PDF table plugin unavailable; using fixed-column fallback table.', error);
    return drawFallbackProductTable(doc, items, y);
  }
}

function drawFallbackProductTable(doc: InstanceType<JsPDFConstructor>, items: ShopListPdfItem[], y: number) {
  const visibleItems = items.slice(0, 12);
  const hiddenItemCount = Math.max(0, items.length - visibleItems.length);
  const compact = items.length > 10;
  const rowGap = compact ? 6 : 7;
  const columns = {
    product: 16,
    qty: 86,
    unit: 101,
    each: 153,
    total: 194,
  };

  doc.setFillColor(BRAND_COLORS.softGreen[0], BRAND_COLORS.softGreen[1], BRAND_COLORS.softGreen[2]);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, y - 5, 182, 8, 1.5, 1.5, 'FD');
  doc.setTextColor(BRAND_COLORS.greenDark[0], BRAND_COLORS.greenDark[1], BRAND_COLORS.greenDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Product', columns.product, y);
  doc.text('Qty', columns.qty, y, { align: 'center' });
  doc.text('Unit', columns.unit, y);
  doc.text('Each', columns.each, y, { align: 'right' });
  doc.text('Line Total', columns.total, y, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(compact ? 7.4 : 8);
  doc.setTextColor(31, 41, 55);
  visibleItems.forEach((item) => {
    const productLines = doc.splitTextToSize(item.name, 66);
    const unitLines = doc.splitTextToSize(item.unit || '-', 28);
    const rowHeight = Math.max(rowGap, productLines.length * 4, unitLines.length * 4);
    doc.text(productLines, columns.product, y);
    doc.text(String(item.quantity), columns.qty, y, { align: 'center' });
    doc.text(unitLines, columns.unit, y);
    doc.text(formatPdfUGX(item.price), columns.each, y, { align: 'right' });
    doc.text(formatPdfUGX(item.price * item.quantity), columns.total, y, { align: 'right' });
    y += rowHeight;
    doc.setDrawColor(229, 231, 235);
    doc.line(14, y - 3, 196, y - 3);
  });

  if (hiddenItemCount > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(75, 85, 99);
    doc.text(`+${hiddenItemCount} more item(s) included in the saved order.`, 16, y);
    y += 6;
  }

  return y + 6;
}

function drawPaymentSection(
  doc: InstanceType<JsPDFConstructor>,
  y: number,
  logos: PaymentLogoImages,
  paymentSettings: PaymentSettings,
) {
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Payment Information', 14, y);

  const boxY = y + 5;
  const gap = 6;
  const boxW = (182 - gap) / 2;
  const boxH = 42;
  drawMtnPaymentBlock(
    doc,
    14,
    boxY,
    boxW,
    boxH,
    paymentSettings.mtnTillNumber,
    paymentSettings.mtnDialCode,
    paymentSettings.mtnLabel,
    logos.mtn ?? null,
  );
  drawAirtelPaymentBlock(
    doc,
    14 + boxW + gap,
    boxY,
    boxW,
    boxH,
    paymentSettings.airtelTillNumber,
    paymentSettings.airtelLabel,
    logos.airtel ?? null,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  const reassurance = 'Pay on Delivery — no upfront payment required. Present either code to your rider at delivery.';
  doc.text(doc.splitTextToSize(reassurance, 178), 14, boxY + boxH + 8);
}

function drawMtnPaymentBlock(
  doc: InstanceType<JsPDFConstructor>,
  x: number,
  y: number,
  width: number,
  height: number,
  merchantCode: string,
  dialCode: string,
  label: string,
  logo: PdfImageData | null,
) {
  const navy = [0, 32, 91] as const;
  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setFillColor(255, 204, 0);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, x + 4, y + 4, 16, 8);
  } else {
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.roundedRect(x + 4, y + 4, 13, 7, 3, 3, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('MTN', x + 10.5, y + 8.8, { align: 'center' });
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(8);
    doc.text(label, x + 20, y + 9);
  }

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Pay with MoMoPay', x + 4, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Dial ${dialCode}`, x + 4, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MERCHANT CODE', x + 4, y + 31);
  drawMerchantCodeDigits(doc, merchantCode, x + 4, y + 34, {
    text: navy,
    border: navy,
    fill: [255, 230, 94],
  });
}

function drawAirtelPaymentBlock(
  doc: InstanceType<JsPDFConstructor>,
  x: number,
  y: number,
  width: number,
  height: number,
  merchantCode: string,
  label: string,
  logo: PdfImageData | null,
) {
  const red = [237, 28, 36] as const;
  doc.setDrawColor(red[0], red[1], red[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');
  doc.setFillColor(red[0], red[1], red[2]);
  doc.rect(x, y, 3, height, 'F');

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, x + 7, y + 4, 18, 10);
  } else {
    doc.setTextColor(red[0], red[1], red[2]);
    doc.setFont('helvetica', 'bold');
    const labelLines = doc.splitTextToSize(label, 68);
    doc.setFontSize(11);
    doc.text(labelLines.slice(0, 2), x + 7, y + 9);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(red[0], red[1], red[2]);
  doc.text('MERCHANT TILL', x + 7, y + 25);
  drawMerchantCodeDigits(doc, merchantCode, x + 7, y + 28, {
    text: red,
    border: red,
    fill: [255, 245, 245],
  });
}

function drawMerchantCodeDigits(
  doc: InstanceType<JsPDFConstructor>,
  merchantCode: string,
  x: number,
  y: number,
  colors: { text: readonly [number, number, number]; border: readonly [number, number, number]; fill: readonly [number, number, number] },
) {
  const digits = merchantCode.replace(/\D/g, '').split('');
  const boxSize = 6.4;
  const gap = 1.6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  digits.forEach((digit, index) => {
    const digitX = x + index * (boxSize + gap);
    doc.setFillColor(colors.fill[0], colors.fill[1], colors.fill[2]);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.roundedRect(digitX, y, boxSize, boxSize, 1, 1, 'FD');
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(digit, digitX + boxSize / 2, y + 4.6, { align: 'center' });
  });
}

type PdfImageData = {
  dataUrl: string;
  format: 'PNG';
};

async function loadPdfImageData(url?: string | null): Promise<PdfImageData | null> {
  if (!url?.trim()) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), OPTIONAL_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await withTimeout(blobToPngDataUrl(blob), OPTIONAL_IMAGE_TIMEOUT_MS);
    return { dataUrl, format: 'PNG' };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadPaymentLogoImages(): Promise<PaymentLogoImages> {
  const [mtn, airtel] = await Promise.all([
    loadPdfImageData(PAYMENT_LOGO_URLS.mtn),
    loadPdfImageData(PAYMENT_LOGO_URLS.airtel),
  ]);

  return {
    ...(mtn ? { mtn } : {}),
    ...(airtel ? { airtel } : {}),
  };
}

function blobToPngDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 96;
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Unable to prepare attendant photo.'));
          return;
        }

        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        context.drawImage(image, x, y, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to load attendant photo.'));
    };

    image.src = objectUrl;
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Timed out.')), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function drawInitialsAvatar(doc: InstanceType<JsPDFConstructor>, initials: string, x: number, y: number, size: number) {
  doc.setFillColor(BRAND_COLORS.green[0], BRAND_COLORS.green[1], BRAND_COLORS.green[2]);
  doc.setDrawColor(BRAND_COLORS.greenDark[0], BRAND_COLORS.greenDark[1], BRAND_COLORS.greenDark[2]);
  doc.roundedRect(x, y, size, size, 3, 3, 'FD');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(initials, x + size / 2, y + size / 2 + 3, { align: 'center' });
}

function drawShopForMeLogoFallback(doc: InstanceType<JsPDFConstructor>, x: number, y: number) {
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(BRAND_COLORS.greenDark[0], BRAND_COLORS.greenDark[1], BRAND_COLORS.greenDark[2]);
  doc.roundedRect(x, y + 3, 13, 8, 1.6, 1.6, 'FD');
  doc.setDrawColor(BRAND_COLORS.orange[0], BRAND_COLORS.orange[1], BRAND_COLORS.orange[2]);
  doc.line(x + 2, y + 3, x + 4, y);
  doc.line(x + 4, y, x + 11, y);
  doc.setFillColor(BRAND_COLORS.orange[0], BRAND_COLORS.orange[1], BRAND_COLORS.orange[2]);
  doc.roundedRect(x + 2.5, y + 11, 2, 2, 1, 1, 'F');
  doc.roundedRect(x + 9, y + 11, 2, 2, 1, 1, 'F');
}

function getInitials(name: string) {
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length || name === 'Not assigned') return 'SFM';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function ensureSpace(doc: InstanceType<JsPDFConstructor>, y: number, neededHeight: number) {
  if (y + neededHeight <= 286) return y;
  doc.addPage();
  return 18;
}

function formatPdfUGX(value: number) {
  return `UGX ${Math.round(value).toLocaleString('en-UG')}`;
}
