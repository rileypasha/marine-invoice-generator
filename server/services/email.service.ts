import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { query } from '../config/database';

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@marinegroupbw.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

// Create transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    logger.info('Email transporter initialized', {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    });
  }
  return transporter;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    logger.warn('Email not configured - skipping email send', {
      to: options.to,
      subject: options.subject,
    });
    return false;
  }

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    logger.info('Email sent successfully', {
      to: options.to,
      subject: options.subject,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send email', {
      error: error.message,
      to: options.to,
      subject: options.subject,
    });
    return false;
  }
}

// Get all users who should be notified for a given event type
async function getUsersToNotify(
  eventType: 'new_invoice' | 'change_request' | 'approval',
  invoiceCreatorId?: string
): Promise<Array<{ email: string; name: string }>> {
  const columnMap = {
    new_invoice: 'notifyOnNewInvoice',
    change_request: 'notifyOnChangeRequest',
    approval: 'notifyOnApproval',
  };

  const column = columnMap[eventType];

  try {
    const result = await query(
      `SELECT id, email, name, "${column}" as scope FROM "User" WHERE "${column}" IN ('own', 'all') AND email IS NOT NULL`,
      []
    );

    return result.rows
      .filter(row => {
        // Filter based on notification scope
        if (row.scope === 'all') {
          return true; // Notify for all invoices
        }
        if (row.scope === 'own' && invoiceCreatorId) {
          return row.id === invoiceCreatorId; // Only notify if they created the invoice
        }
        return false;
      })
      .map(row => ({
        email: row.email,
        name: row.name || row.email,
      }));
  } catch (error: any) {
    logger.error('Failed to get users to notify', {
      error: error.message,
      eventType,
    });
    return [];
  }
}

// Notification templates
interface InvoiceData {
  invoiceNumber?: string;
  title: string;
  customerName?: string;
  vesselName?: string;
  total: number;
  createdBy: string;
  createdById?: string;
  url: string;
}

async function notifyNewInvoice(invoiceData: InvoiceData): Promise<void> {
  const users = await getUsersToNotify('new_invoice', invoiceData.createdById);

  if (users.length === 0) {
    logger.info('No users to notify for new invoice');
    return;
  }

  const subject = `New Invoice Request: ${invoiceData.invoiceNumber || invoiceData.title}`;
  const text = `
A new invoice request has been created:

Invoice: ${invoiceData.invoiceNumber || 'Untitled'}
Title: ${invoiceData.title}
Customer: ${invoiceData.customerName || 'N/A'}
Vessel: ${invoiceData.vesselName || 'N/A'}
Total: $${invoiceData.total.toFixed(2)}
Created by: ${invoiceData.createdBy}

View invoice: ${invoiceData.url}
  `.trim();

  const html = `
<h2>New Invoice Request</h2>
<p>A new invoice request has been created:</p>
<table style="border-collapse: collapse; margin: 20px 0;">
  <tr>
    <td style="padding: 8px; font-weight: bold;">Invoice:</td>
    <td style="padding: 8px;">${invoiceData.invoiceNumber || 'Untitled'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Title:</td>
    <td style="padding: 8px;">${invoiceData.title}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Customer:</td>
    <td style="padding: 8px;">${invoiceData.customerName || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Vessel:</td>
    <td style="padding: 8px;">${invoiceData.vesselName || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Total:</td>
    <td style="padding: 8px;">$${invoiceData.total.toFixed(2)}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Created by:</td>
    <td style="padding: 8px;">${invoiceData.createdBy}</td>
  </tr>
</table>
<p><a href="${invoiceData.url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invoice</a></p>
  `.trim();

  for (const user of users) {
    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }
}

async function notifyChangeRequested(invoiceData: InvoiceData): Promise<void> {
  const users = await getUsersToNotify('change_request', invoiceData.createdById);

  if (users.length === 0) {
    logger.info('No users to notify for change request');
    return;
  }

  const subject = `Changes Requested: ${invoiceData.invoiceNumber || invoiceData.title}`;
  const text = `
Changes have been requested for an invoice:

Invoice: ${invoiceData.invoiceNumber || 'Untitled'}
Title: ${invoiceData.title}
Customer: ${invoiceData.customerName || 'N/A'}
Vessel: ${invoiceData.vesselName || 'N/A'}
Total: $${invoiceData.total.toFixed(2)}

View invoice: ${invoiceData.url}
  `.trim();

  const html = `
<h2>Changes Requested</h2>
<p>Changes have been requested for an invoice:</p>
<table style="border-collapse: collapse; margin: 20px 0;">
  <tr>
    <td style="padding: 8px; font-weight: bold;">Invoice:</td>
    <td style="padding: 8px;">${invoiceData.invoiceNumber || 'Untitled'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Title:</td>
    <td style="padding: 8px;">${invoiceData.title}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Customer:</td>
    <td style="padding: 8px;">${invoiceData.customerName || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Vessel:</td>
    <td style="padding: 8px;">${invoiceData.vesselName || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Total:</td>
    <td style="padding: 8px;">$${invoiceData.total.toFixed(2)}</td>
  </tr>
</table>
<p><a href="${invoiceData.url}" style="background-color: #ffc107; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invoice</a></p>
  `.trim();

  for (const user of users) {
    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }
}

async function notifyApproved(invoiceData: InvoiceData): Promise<void> {
  logger.info('notifyApproved called', {
    invoiceNumber: invoiceData.invoiceNumber,
    createdById: invoiceData.createdById,
  });

  const users = await getUsersToNotify('approval', invoiceData.createdById);

  logger.info('Users to notify for approval', {
    count: users.length,
    users: users.map(u => ({ email: u.email, name: u.name })),
    invoiceCreatorId: invoiceData.createdById,
  });

  if (users.length === 0) {
    logger.info('No users to notify for approval');
    return;
  }

  const subject = `Invoice Approved: ${invoiceData.invoiceNumber || invoiceData.title}`;
  const text = `
An invoice has been approved:

Invoice: ${invoiceData.invoiceNumber || 'Untitled'}
Title: ${invoiceData.title}
Customer: ${invoiceData.customerName || 'N/A'}
Vessel: ${invoiceData.vesselName || 'N/A'}
Total: $${invoiceData.total.toFixed(2)}

View invoice: ${invoiceData.url}
  `.trim();

  const html = `
<h2>Invoice Approved</h2>
<p>An invoice has been approved:</p>
<table style="border-collapse: collapse; margin: 20px 0;">
  <tr>
    <td style="padding: 8px; font-weight: bold;">Invoice:</td>
    <td style="padding: 8px;">${invoiceData.invoiceNumber || 'Untitled'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Title:</td>
    <td style="padding: 8px;">${invoiceData.title}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Customer:</td>
    <td style="padding: 8px;">${invoiceData.customerName || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Vessel:</td>
    <td style="padding: 8px;">${invoiceData.vesselName || 'N/A'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; font-weight: bold;">Total:</td>
    <td style="padding: 8px;">$${invoiceData.total.toFixed(2)}</td>
  </tr>
</table>
<p><a href="${invoiceData.url}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invoice</a></p>
  `.trim();

  for (const user of users) {
    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }
}

export {
  sendEmail,
  notifyNewInvoice,
  notifyChangeRequested,
  notifyApproved,
  getUsersToNotify,
};
