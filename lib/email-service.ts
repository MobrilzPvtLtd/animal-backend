import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('Password reset SMTP credentials are missing');
  }

  const port = Number(process.env.SMTP_PORT || '587');
  const rawFrom = process.env.SMTP_FROM?.trim();
  const sender = process.env.SMTP_SENDER_EMAIL || user;
  const from = rawFrom?.includes('@')
    ? rawFrom
    : { name: rawFrom || 'Animal Click', address: sender };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  // Plain text avoids interpolating a bearer token into HTML and provides
  // a usable link in mail clients that do not render HTML.
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Reset your Animal Click password',
    text: `We received a request to reset your Animal Click password.\n\nOpen this link to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  if (!info.accepted?.length || info.rejected?.length) {
    throw new Error('Password reset email was not accepted by SMTP');
  }
  return { success: true, messageId: info.messageId };
}

export interface EventReminderEmailData {
  to: string;
  userName?: string;
  eventTitle: string;
  eventDate: string;
  venue?: string;
  address?: string;
  description?: string;
}

export async function sendEventReminderEmail(data: EventReminderEmailData) {
  const {
    to,
    userName = 'Valued Member',
    eventTitle,
    eventDate,
    venue = 'Event Venue',
    address = '',
    description = '',
  } = data;

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  let rawFrom = process.env.SMTP_FROM || '';
  let fromEmail = '';

  if (rawFrom.includes('@')) {
    fromEmail = rawFrom;
  } else if (rawFrom.trim()) {
    const senderEmail = process.env.SMTP_SENDER_EMAIL || 'noreply@animal.com';
    fromEmail = `"${rawFrom.replace(/"/g, '').trim()}" <${senderEmail}>`;
  } else {
    fromEmail = `"Animal Click" <noreply@animal.com>`;
  }

  const formattedDate = new Date(eventDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 28px; color: #334155; }
          .event-card { background: #fffbe6; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 6px; }
          .event-title { font-size: 20px; font-weight: bold; color: #78350f; margin-bottom: 8px; }
          .event-detail { font-size: 14px; margin: 4px 0; color: #92400e; }
          .footer { background: #f8fafc; text-align: center; padding: 16px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Event Tomorrow Reminder</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${userName}</strong>,</p>
            <p>This is a quick reminder that your saved event is happening <strong>tomorrow</strong>!</p>
            
            <div class="event-card">
              <div class="event-title">🎉 ${eventTitle}</div>
              <div class="event-detail">📅 <strong>Date & Time:</strong> ${formattedDate}</div>
              <div class="event-detail">📍 <strong>Venue:</strong> ${venue}${address ? `, ${address}` : ''}</div>
              ${description ? `<div class="event-detail" style="margin-top:8px;">📝 ${description}</div>` : ''}
            </div>

            <p>We look forward to seeing you there!</p>
            <p>Best regards,<br/><strong>Animal Click Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Animal Click. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  // If no SMTP credentials, log preview and return true for testing
  if (!smtpUser || !smtpPass) {
    console.log(`[Email Service Simulation] Sent Event Reminder to ${to} for "${eventTitle}" at ${formattedDate}`);
    return { success: true, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: fromEmail,
    to,
    subject: `⏰ Reminder: "${eventTitle}" is happening tomorrow!`,
    html: htmlContent,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

export interface SupportTicketReplyEmailData {
  to: string;
  userName?: string;
  ticketSubject: string;
  replyText: string;
  ticketId: number | string;
  imageUrl?: string | null;
}

export async function sendSupportTicketReplyEmail(data: SupportTicketReplyEmailData) {
  const { to, userName = 'Valued Member', ticketSubject, replyText, ticketId, imageUrl } = data;

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  let rawFrom = process.env.SMTP_FROM || '';
  let fromEmail = '';

  if (rawFrom.includes('@')) {
    fromEmail = rawFrom;
  } else if (rawFrom.trim()) {
    const senderEmail = process.env.SMTP_SENDER_EMAIL || 'noreply@animal.com';
    fromEmail = `"${rawFrom.replace(/"/g, '').trim()}" <${senderEmail}>`;
  } else {
    fromEmail = `"Animal Click Support" <noreply@animal.com>`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
          .content { padding: 28px; color: #334155; line-height: 1.6; }
          .reply-card { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 18px; margin: 20px 0; border-radius: 6px; }
          .ticket-info { font-size: 13px; font-weight: 600; margin-bottom: 12px; color: #64748b; }
          .reply-text { font-size: 15px; margin: 4px 0; color: #0f172a; line-height: 1.6; white-space: pre-wrap; }
          .footer { background: #f8fafc; text-align: center; padding: 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Update on Your Support Ticket</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${userName}</strong>,</p>
            <p>Our support team has replied to your ticket.</p>
            
            <div class="reply-card">
              <div class="ticket-info">Ticket ID: #${ticketId} | Subject: ${ticketSubject}</div>
              <div class="reply-text">${replyText.replace(/\n/g, '<br/>')}</div>
              ${imageUrl ? `<div style="margin-top: 14px;"><img src="${imageUrl}" alt="Attachment" style="max-width: 100%; max-height: 300px; border-radius: 6px; border: 1px solid #cbd5e1; display: block;" /></div>` : ''}
            </div>

            <p>You can reply directly in the Animal Click app to continue the conversation.</p>
            <p style="margin-top: 20px;">Best regards,<br/><strong>Animal Click Support Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Animal Click. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  if (!smtpUser || !smtpPass) {
    console.log(`[Email Service Simulation] Sent Support Ticket Reply to ${to} for ticket #${ticketId}`);
    return { success: true, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: fromEmail,
    to,
    subject: `Re: [Ticket #${ticketId}] ${ticketSubject}`,
    html: htmlContent,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

export async function sendProviderRequestDecisionEmail(to: string, businessName: string, status: 'approved' | 'rejected', reason: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error('SMTP credentials are missing');
  const port = Number(process.env.SMTP_PORT || '587');
  const rawFrom = process.env.SMTP_FROM?.trim();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
  const info = await transporter.sendMail({
    from: rawFrom?.includes('@') ? rawFrom : { name: rawFrom || 'Animal Click', address: process.env.SMTP_SENDER_EMAIL || user },
    to, subject: `Your provider access request has been ${status}`,
    text: `Your provider access request for ${businessName} has been ${status}.\n\nReason:\n${reason}\n\nAnimal Click Team`,
    disableFileAccess: true, disableUrlAccess: true,
  });
  if (!info.accepted?.length || info.rejected?.length) throw new Error('Decision email was not accepted by SMTP');
}
