import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { BusinessDetails, Employee, PayrollRun } from '../types';
import { formatCurrency } from './taxEngine';

export interface ShareResult {
  success: boolean;
  message: string;
  type: 'whatsapp' | 'image' | 'pdf' | 'email' | 'print' | 'share' | 'clipboard';
  imageUrl?: string;
}

/**
 * Format a phone number into WhatsApp international format (digits only)
 */
export function formatWhatsAppPhone(phone: string): string {
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, '');
  // If Caribbean/North America 10 digits starting with e.g. 868, prepend 1
  if (digits.length === 10 && !digits.startsWith('1')) {
    return `1${digits}`;
  }
  return digits;
}

/**
 * Render a DOM element to a high-resolution PNG Data URL
 */
export async function generatePayslipImageDataUrl(element: HTMLElement): Promise<string> {
  try {
    // Use pixel ratio 2 for sharp retina quality, skipFonts: true prevents CSSStyleSheet cssRules cross-origin security errors
    return await htmlToImage.toPng(element, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: false,
      skipFonts: true,
    });
  } catch (err) {
    console.warn('Primary toPng failed, retrying with fallback options:', err);
    return await htmlToImage.toPng(element, {
      quality: 0.9,
      pixelRatio: 1.5,
      backgroundColor: '#ffffff',
      skipFonts: true,
      fontEmbedCSS: '',
    });
  }
}

/**
 * Render a DOM element to a Blob (image/png)
 */
export async function generatePayslipBlob(element: HTMLElement): Promise<Blob> {
  try {
    const blob = await htmlToImage.toBlob(element, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: false,
      skipFonts: true,
    });
    if (!blob) throw new Error('Failed to generate payslip image blob');
    return blob;
  } catch (err) {
    console.warn('Primary toBlob failed, retrying with fallback options:', err);
    const blob = await htmlToImage.toBlob(element, {
      quality: 0.9,
      pixelRatio: 1.5,
      backgroundColor: '#ffffff',
      skipFonts: true,
      fontEmbedCSS: '',
    });
    if (!blob) throw new Error('Failed to generate payslip image blob');
    return blob;
  }
}

/**
 * Download the payslip as a high-res PNG image
 */
export async function downloadPayslipImage(
  element: HTMLElement,
  filename?: string
): Promise<string> {
  const dataUrl = await generatePayslipImageDataUrl(element);
  const safeFilename = filename || `Payslip_${Date.now()}.png`;

  const link = document.createElement('a');
  link.download = safeFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return dataUrl;
}

/**
 * Download the payslip as an official PDF document
 */
export async function downloadPayslipPDF(
  element: HTMLElement,
  filename?: string
): Promise<void> {
  const dataUrl = await generatePayslipImageDataUrl(element);
  const safeFilename = filename || `Payslip_${Date.now()}.pdf`;

  // Create standard A4 portrait PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgProps = pdf.getImageProperties(dataUrl);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  // Calculate scaled height with margin
  const margin = 10;
  const contentWidth = pdfWidth - margin * 2;
  const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

  // Center vertically if it fits on one page
  const yPos = contentHeight < pdfHeight - margin * 2 ? margin + 5 : margin;

  pdf.addImage(dataUrl, 'PNG', margin, yPos, contentWidth, contentHeight, undefined, 'FAST');
  pdf.save(safeFilename);
}

/**
 * Copy the payslip image to the system clipboard
 */
export async function copyPayslipImageToClipboard(element: HTMLElement): Promise<boolean> {
  try {
    const blob = await generatePayslipBlob(element);
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard image write not permitted, falling back:', err);
    return false;
  }
}

/**
 * Format standard WhatsApp salary statement text
 */
export function buildWhatsAppMessageText(
  employee: Employee,
  business: BusinessDetails,
  payroll: PayrollRun
): string {
  const totalDeductions =
    employee.paye + employee.nis + employee.healthSurcharge + employee.otherDeductions;

  return (
`📄 *OFFICIAL PAYSLIP ADVICE*
🏢 *${business.name}*

👤 *Employee:* ${employee.name} (ID: ${employee.employeeId})
📅 *Period:* ${payroll.periodLabel}
💰 *Pay Date:* ${payroll.payDate}

━━━━━━━━━━━━━━━━━━━━
💵 *Gross Earnings:* ${formatCurrency(employee.grossPay)}
🔻 *Total Deductions:* -${formatCurrency(totalDeductions)}
   • PAYE Tax: ${formatCurrency(employee.paye)}
   • NIS: ${formatCurrency(employee.nis)}
   • Health Surcharge: ${formatCurrency(employee.healthSurcharge)}
${employee.otherDeductions > 0 ? `   • Other: ${formatCurrency(employee.otherDeductions)}\n` : ''}━━━━━━━━━━━━━━━━━━━━
💳 *NET PAY:* *${formatCurrency(employee.netPay)}*
🏦 *Disbursed to:* ${employee.bankName || 'Bank Account'} (${employee.accountNumber || '••••'})

_Your itemized payslip image has been generated by ${business.name}._`
  );
}

/**
 * Share via WhatsApp:
 * 1. Generates the high-res payslip image and triggers download
 * 2. Attempts to copy the image to the clipboard so user can paste it directly into WhatsApp
 * 3. Opens WhatsApp Web / WhatsApp App with pre-filled employee salary details
 */
export async function sharePayslipViaWhatsApp(
  element: HTMLElement,
  employee: Employee,
  business: BusinessDetails,
  payroll: PayrollRun
): Promise<{ success: boolean; copiedImage: boolean; phone: string; dataUrl: string }> {
  // 1. Generate image & download
  const safeName = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.png`;
  const dataUrl = await downloadPayslipImage(element, safeName);

  // 2. Try copying image to clipboard
  let copiedImage = false;
  try {
    copiedImage = await copyPayslipImageToClipboard(element);
  } catch {
    copiedImage = false;
  }

  // 3. Prepare formatted WhatsApp text
  const messageText = buildWhatsAppMessageText(employee, business, payroll);
  const cleanPhone = formatWhatsAppPhone(employee.phone || '');

  // 4. Construct WhatsApp URI
  const encodedText = encodeURIComponent(messageText);
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // 5. Open WhatsApp in new tab / app
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

  return {
    success: true,
    copiedImage,
    phone: cleanPhone,
    dataUrl,
  };
}

/**
 * Native Web Share API (supports sharing actual image file if supported on Mobile/Desktop)
 */
export async function sharePayslipNative(
  element: HTMLElement,
  employee: Employee,
  business: BusinessDetails,
  payroll: PayrollRun
): Promise<boolean> {
  const messageText = buildWhatsAppMessageText(employee, business, payroll);
  const filename = `Payslip_${employee.name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.png`;

  try {
    const blob = await generatePayslipBlob(element);
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `${business.name} - Payslip (${employee.name})`,
        text: messageText,
        files: [file],
      });
      return true;
    } else if (navigator.share) {
      await navigator.share({
        title: `${business.name} - Payslip (${employee.name})`,
        text: messageText,
      });
      return true;
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn('Native share failed:', err);
    }
  }

  return false;
}
