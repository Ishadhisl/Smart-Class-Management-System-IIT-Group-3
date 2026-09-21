import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { paymentMethodLabelEn } from './paymentMethod';

/**
 * Generates and downloads a PDF receipt for a payment.
 * @param {Object} payment - The payment details object.
 * @param {string} payment.receipt_number - The receipt number.
 * @param {string} payment.student_name - The student's name.
 * @param {string} payment.student_id - The student's ID.
 * @param {string} payment.course_name - The course name.
 * @param {string} payment.for_month - The month the payment is for.
 * @param {number|string} payment.amount_paid - The amount paid.
 * @param {string} payment.payment_method - The method used (Cash, Card, Bank Transfer, etc.).
 * @param {string} payment.payment_date - The date of payment.
 * @param {string} [payment.issued_by_name] - Who recorded the payment (optional).
 */
export const generateReceiptPDF = (payment) => {
  if (!payment) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // A5 size is standard and perfect for receipts
  });

  const primaryColor = [0, 86, 179]; // Dark Blue #0056b3
  const darkTextColor = [51, 51, 51]; // Charcoal #333333

  // 1. Header Section
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 148, 12, 'F'); // Top bar

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('THUSITHA SMART CLASS MANAGEMENT SYSTEM', 74, 8, { align: 'center' });

  // Company / Institute Details
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.text('THUSITHA INSTITUTE', 14, 25);
  
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Smart Education Center', 14, 30);
  doc.text('Email: info@thusithainstitute.com | Tel: +94 11 234 5678', 14, 34);

  // Receipt Title & Metadata
  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PAYMENT RECEIPT', 14, 46);

  // Metadata Table Info
  const receiptNo = payment.receipt_number || `REC-${payment.payment_id}`;
  const dateStr = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : new Date().toLocaleDateString();

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt No: ${receiptNo}`, 90, 46);
  doc.text(`Date: ${dateStr}`, 90, 50);

  // Divider Line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 54, 134, 54);

  // 2. Student & Payment Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Bill To:', 14, 62);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Student Name: ${payment.student_name || 'N/A'}`, 14, 67);
  doc.text(`Student ID: ${payment.student_id || 'N/A'}`, 14, 71);

  doc.setFont('helvetica', 'bold');
  doc.text('Payment Details:', 90, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(`Method: ${paymentMethodLabelEn(payment.payment_method)}`, 90, 67);
  doc.text(`Status: Completed`, 90, 71);
  if (payment.issued_by_name) {
    doc.text(`Issued By: ${payment.issued_by_name}`, 90, 75);
  }

  // 3. Receipt Items Table
  const headers = [['Description', 'Month', 'Amount']];
  const items = [
    [
      payment.course_name || 'Course Fee',
      payment.for_month || 'N/A',
      `LKR ${(parseFloat(payment.amount_paid) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    ]
  ];

  autoTable(doc, {
    head: headers,
    body: items,
    startY: 82,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkTextColor
    },
    columnStyles: {
      2: { halign: 'right' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  // 4. Totals Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Total Paid:', 90, finalY);
  doc.text(
    `LKR ${(parseFloat(payment.amount_paid) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    134,
    finalY,
    { align: 'right' }
  );

  // 5. Footer & Sign-off
  const footerY = 190;
  doc.line(14, footerY - 5, 134, footerY - 5);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a computer generated receipt and does not require a physical signature.', 74, footerY, { align: 'center' });
  doc.text('Thank you for your payment!', 74, footerY + 4, { align: 'center' });

  // Save PDF
  doc.save(`receipt-${receiptNo}.pdf`);
};
