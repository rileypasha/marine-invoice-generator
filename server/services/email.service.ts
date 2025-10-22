import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

// Email configuration
const EMAIL_FROM = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@marinegroupbw.com';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  logger.info('SendGrid email service initialized');
}

interface EmailAttachment {
  content: string;
  filename: string;
  type: string;
  disposition: string;
  content_id: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('SendGrid not configured - skipping email send', {
      to: options.to,
      subject: options.subject,
    });
    return false;
  }

  try {
    const emailData: any = {
      to: options.to,
      from: EMAIL_FROM,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    if (options.attachments) {
      emailData.attachments = options.attachments;
    }

    await sgMail.send(emailData);

    logger.info('Email sent successfully via SendGrid', {
      to: options.to,
      subject: options.subject,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send email via SendGrid', {
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
    logger.info('Getting users to notify', {
      eventType,
      invoiceCreatorId,
      column,
    });

    const result = await query(
      `SELECT id, email, name, "${column}" as scope FROM "User" WHERE "${column}" IN ('own', 'all') AND email IS NOT NULL`,
      []
    );

    logger.info('Users query result', {
      eventType,
      rowCount: result.rows.length,
      rows: result.rows.map(r => ({ id: r.id, email: r.email, scope: r.scope })),
    });

    const filtered = result.rows
      .filter(row => {
        // Filter based on notification scope
        if (row.scope === 'all') {
          // Users with 'all' setting get notified for all invoices
          logger.info('User has "all" scope - including in notifications', {
            email: row.email,
            userId: row.id,
          });
          return true;
        }
        if (row.scope === 'own' && invoiceCreatorId) {
          // Users with 'own' setting only get notified if they created the invoice
          const isCreator = row.id === invoiceCreatorId;
          logger.info('User has "own" scope', {
            email: row.email,
            userId: row.id,
            invoiceCreatorId,
            isCreator,
          });
          return isCreator;
        }
        logger.info('User filtered out', {
          email: row.email,
          scope: row.scope,
          invoiceCreatorId,
        });
        return false;
      })
      .map(row => ({
        email: row.email,
        name: row.name || row.email,
      }));

    logger.info('Filtered users to notify', {
      eventType,
      count: filtered.length,
      users: filtered,
    });

    return filtered;
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

  const subject = `New Invoice Request - ${invoiceData.invoiceNumber || invoiceData.title}`;

  for (const user of users) {
    const text = `
Hello ${user.name},

A new invoice request has been submitted for review. Please respond by attaching an official QuickBooks Invoice or leave a message to the requester about any necessary changes.

INVOICE REQUEST DETAILS
────────────────────────────────
Request Number: ${invoiceData.invoiceNumber || 'Pending'}
Description: ${invoiceData.title}
Customer: ${invoiceData.customerName || 'Not specified'}
Vessel: ${invoiceData.vesselName || 'Not specified'}
Total Amount: $${invoiceData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Submitted By: ${invoiceData.createdBy}

NEXT STEPS
────────────────────────────────
Please respond by attaching an official QuickBooks Invoice or leave a message to the requester about any necessary changes.

View and review invoice: ${invoiceData.url}

────────────────────────────────
This is an automated notification. Please do not reply to this email.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #003d5b; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">New Invoice Request</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Hello ${user.name},</p>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">A new invoice request has been submitted for review. Please respond by attaching an official QuickBooks Invoice or leave a message to the requester about any necessary changes.</p>

              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #003d5b;">Invoice Request Details</h2>

              <table style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0; border: 1px solid #e9ecef; border-radius: 4px;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057; width: 40%;">Request Number</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.invoiceNumber || 'Pending'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Description</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.title}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Customer</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.customerName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Vessel</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.vesselName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Total Amount</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529; font-weight: 600;">$${invoiceData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Submitted By</td>
                  <td style="padding: 12px 16px; color: #212529;">${invoiceData.createdBy}</td>
                </tr>
              </table>

              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #003d5b;">Next Steps</h2>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Please respond by attaching an official QuickBooks Invoice or leave a message to the requester about any necessary changes.</p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${invoiceData.url}" style="display: inline-block; background-color: #003d5b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">Review Invoice</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px; text-align: center;">
              <img src="cid:logo" alt="Marine Group Boat Works" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
              <p style="margin: 0; font-size: 12px; color: #868e96; font-style: italic;">This is an automated notification. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Read and encode the logo file
    const logoPath = path.join(__dirname, '../../public/mgbw_logo_transparent.png');
    let logoAttachment: EmailAttachment | undefined;

    try {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoBase64 = logoBuffer.toString('base64');

      logoAttachment = {
        content: logoBase64,
        filename: 'mgbw_logo_transparent.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'logo'
      };
    } catch (error) {
      logger.warn('Could not load logo file for email', { error });
    }

    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
      attachments: logoAttachment ? [logoAttachment] : undefined,
    });
  }
}

async function notifyChangeRequested(invoiceData: InvoiceData): Promise<void> {
  const users = await getUsersToNotify('change_request', invoiceData.createdById);

  if (users.length === 0) {
    logger.info('No users to notify for change request');
    return;
  }

  const subject = `Invoice Request Updated - ${invoiceData.invoiceNumber || invoiceData.title}`;

  for (const user of users) {
    const text = `
Hello ${user.name},

Changes are required for the following invoice request. Please reissue the official QuickBooks invoice at your earliest convenience, or notify the requester if the revisions cannot be made at this time.

INVOICE REQUEST DETAILS
────────────────────────────────
Request Number: ${invoiceData.invoiceNumber || 'Pending'}
Description: ${invoiceData.title}
Customer: ${invoiceData.customerName || 'Not specified'}
Vessel: ${invoiceData.vesselName || 'Not specified'}
Total Amount: $${invoiceData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

NEXT STEPS
────────────────────────────────
Please reissue the official QuickBooks invoice at your earliest convenience, or notify the requester if the revisions cannot be made at this time.

View invoice request and requested changes: ${invoiceData.url}

────────────────────────────────
This is an automated notification. Please do not reply to this email.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #3A6D7E; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Invoice Request Updated</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Hello ${user.name},</p>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Changes are required for the following invoice request. Please reissue the official QuickBooks invoice at your earliest convenience, or notify the requester if the revisions cannot be made at this time.</p>

              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #003d5b;">Invoice Request Details</h2>

              <table style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0; border: 1px solid #e9ecef; border-radius: 4px;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057; width: 40%;">Request Number</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.invoiceNumber || 'Pending'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Description</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.title}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Customer</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.customerName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Vessel</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.vesselName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Total Amount</td>
                  <td style="padding: 12px 16px; color: #212529; font-weight: 600;">$${invoiceData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </table>

              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #003d5b;">Next Steps</h2>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Please reissue the official QuickBooks invoice at your earliest convenience, or notify the requester if the revisions cannot be made at this time.</p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${invoiceData.url}" style="display: inline-block; background-color: #3A6D7E; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">View Invoice</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px; text-align: center;">
              <img src="cid:logo" alt="Marine Group Boat Works" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
              <p style="margin: 0; font-size: 12px; color: #868e96; font-style: italic;">This is an automated notification. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Read and encode the logo file
    const logoPath = path.join(__dirname, '../../public/mgbw_logo_transparent.png');
    let logoAttachment: EmailAttachment | undefined;

    try {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoBase64 = logoBuffer.toString('base64');

      logoAttachment = {
        content: logoBase64,
        filename: 'mgbw_logo_transparent.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'logo'
      };
    } catch (error) {
      logger.warn('Could not load logo file for email', { error });
    }

    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
      attachments: logoAttachment ? [logoAttachment] : undefined,
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

  const subject = `Invoice Request Approved - ${invoiceData.invoiceNumber || invoiceData.title}`;

  for (const user of users) {
    const text = `
Hello ${user.name},

Great news! The following invoice request (${invoiceData.invoiceNumber || invoiceData.title}) has been approved and the formal QuickBooks invoice has been created for the client.

INVOICE REQUEST DETAILS
────────────────────────────────
Request Number: ${invoiceData.invoiceNumber || 'Pending'}
Description: ${invoiceData.title}
Customer: ${invoiceData.customerName || 'Not specified'}
Vessel: ${invoiceData.vesselName || 'Not specified'}
Total Amount: $${invoiceData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

NEXT STEPS
────────────────────────────────
This invoice has passed the review stage and is now being sent to the client. If any revisions are needed, please update the invoice directly in the app by selecting 'Edit Invoice.'

View approved invoice: ${invoiceData.url}

────────────────────────────────
This is an automated notification. Please do not reply to this email.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #059669; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Invoice Request Approved</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Hello ${user.name},</p>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">Great news! The following invoice request (${invoiceData.invoiceNumber || invoiceData.title}) has been approved and the formal QuickBooks invoice has been created for the client.</p>

              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #003d5b;">Invoice Request Details</h2>

              <table style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0; border: 1px solid #e9ecef; border-radius: 4px;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057; width: 40%;">Request Number</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.invoiceNumber || 'Pending'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Description</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.title}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Customer</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.customerName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">Vessel</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; color: #212529;">${invoiceData.vesselName || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: 600; color: #495057;">Total Amount</td>
                  <td style="padding: 12px 16px; color: #212529; font-weight: 600;">$${invoiceData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </table>

              <div style="background-color: #d1fae5; border-left: 4px solid #059669; padding: 16px; margin: 0 0 32px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #065f46;">Next Steps</h2>
                <p style="margin: 0; font-size: 16px; color: #065f46;">This invoice has passed the review stage and is now being sent to the client. If any revisions are needed, please update the invoice directly in the app by selecting 'Edit Invoice.'</p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${invoiceData.url}" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">View Approved Invoice</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px; text-align: center;">
              <img src="cid:logo" alt="Marine Group Boat Works" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
              <p style="margin: 0; font-size: 12px; color: #868e96; font-style: italic;">This is an automated notification. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Read and encode the logo file
    const logoPath = path.join(__dirname, '../../public/mgbw_logo_transparent.png');
    let logoAttachment: EmailAttachment | undefined;

    try {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoBase64 = logoBuffer.toString('base64');

      logoAttachment = {
        content: logoBase64,
        filename: 'mgbw_logo_transparent.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'logo'
      };
    } catch (error) {
      logger.warn('Could not load logo file for email', { error });
    }

    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
      attachments: logoAttachment ? [logoAttachment] : undefined,
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
