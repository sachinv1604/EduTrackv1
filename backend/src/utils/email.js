/**
 * Email Utility
 * 
 * Manages email transmissions for EduTrack.
 * Supports multiple email delivery backends:
 * 1. Brevo HTTP API (Recommended for production on Render - works on free tier!)
 * 2. Resend HTTP API (Works on free tier, requires custom domain or verified recipient)
 * 3. Nodemailer SMTP (Default for local development)
 * 4. Ethereal Mail Sandbox (Auto-generated fallback for zero-config testing)
 */
const nodemailer = require('nodemailer');
const https = require('https');

/**
 * Generic helper to make HTTPS POST requests without external dependencies.
 * Works flawlessly on all Node.js versions and environments (including Render free tier).
 */
const postRequest = (url, headers, body) => {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ raw: data });
            }
          } else {
            reject(new Error(`API responded with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(JSON.stringify(body));
      req.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Sends an email using Brevo's HTTP API.
 * Brevo works perfectly on Render's free tier because it uses standard HTTPS (port 443).
 */
const sendViaBrevo = async (toEmail, subject, text, html) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromName = process.env.SMTP_FROM_NAME || 'EduTrack Team';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@edutrack.com';

  console.log('[EMAIL] Attempting to send email via Brevo HTTP API...');
  
  const headers = {
    'accept': 'application/json',
    'api-key': apiKey
  };

  const body = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: toEmail }],
    subject: subject,
    textContent: text,
    htmlContent: html
  };

  const result = await postRequest('https://api.brevo.com/v3/smtp/email', headers, body);
  console.log(`[EMAIL_SENT] Dispatched via Brevo API: MessageID = ${result.messageId || 'Success'}`);
  return result;
};

/**
 * Sends an email using Resend's HTTP API.
 * Resend works perfectly on Render's free tier because it uses standard HTTPS (port 443).
 */
const sendViaResend = async (toEmail, subject, text, html) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromName = process.env.SMTP_FROM_NAME || 'EduTrack Team';
  // Note: Resend requires a verified domain to send from custom email.
  // Otherwise, you must use "onboarding@resend.dev" as the sender and can only send to your verified account email.
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'onboarding@resend.dev';

  console.log('[EMAIL] Attempting to send email via Resend HTTP API...');

  const headers = {
    'Authorization': `Bearer ${apiKey}`
  };

  const body = {
    from: `"${fromName}" <${fromEmail}>`,
    to: [toEmail],
    subject: subject,
    text: text,
    html: html
  };

  const result = await postRequest('https://api.resend.com/emails', headers, body);
  console.log(`[EMAIL_SENT] Dispatched via Resend API: ID = ${result.id || 'Success'}`);
  return result;
};

/**
 * Sends an email using standard Nodemailer SMTP or Ethereal sandbox.
 */
const sendViaSmtp = async (toEmail, subject, text, html) => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  let transporter;

  if (host && user && pass) {
    const smtpPort = parseInt(port, 10);
    console.log(`[EMAIL] Initializing custom SMTP transport using ${host}:${smtpPort}...`);
    transporter = nodemailer.createTransport({
      host,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user, pass },
      family: 4, // Force IPv4 to prevent IPv6 ENETUNREACH errors on cloud hosts (Render, Railway, etc.)
      connectionTimeout: 10000, // 10s connection timeout
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  } else {
    console.log('[EMAIL] SMTP credentials missing in .env. Initializing developer Ethereal Sandbox...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (error) {
      console.error('[EMAIL_INIT_ERR] Failed to configure Ethereal fallback:', error.message);
      throw error;
    }
  }

  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'EduTrack Team'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@edutrack.com'}>`,
    to: toEmail,
    subject: subject,
    text: text,
    html: html
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[EMAIL_SENT] Dispatched via SMTP to ${toEmail}`);

  if (nodemailer.getTestMessageUrl(info)) {
    console.log('\n--- 📬 DEVELOPMENT EMAIL PREVIEW CHANNEL ---');
    console.log('Open this link to read the verification email instantly:');
    console.log(nodemailer.getTestMessageUrl(info));
    console.log('--------------------------------------------\n');
  }

  return info;
};

/**
 * Main email sender function. Automatically detects the active provider.
 */
const sendOtpEmail = async (toEmail, otp) => {
  const subject = 'EduTrack - Password Reset Verification OTP 🔑';
  const text = `Your EduTrack verification OTP code is: ${otp}. It is valid for 5 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #EEEEEE; border-radius: 12px; background-color: #FAFAFA;">
      <h2 style="color: #1E3A8A; text-align: center;">EduTrack Account Security</h2>
      <hr style="border: 0; border-top: 1px solid #DDDDDD; margin-bottom: 20px;" />
      <p style="font-size: 16px; color: #333333;">Hello,</p>
      <p style="font-size: 16px; color: #333333;">We received a request to reset your EduTrack account password. Please use the following one-time password (OTP) code to complete the verification step:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #10B981; background-color: #E6F4FE; padding: 12px 24px; border-radius: 8px; border: 1px dashed #3B82F6;">
          ${otp}
        </span>
      </div>
      
      <p style="font-size: 14px; color: #EF4444; font-weight: bold; text-align: center;">💡 This OTP is strictly valid for the next 5 minutes.</p>
      
      <hr style="border: 0; border-top: 1px solid #DDDDDD; margin-top: 30px; margin-bottom: 20px;" />
      <p style="font-size: 12px; color: #777777; text-align: center;">If you did not request a password reset, please ignore this email or contact support. Do not share your OTP with anyone.</p>
    </div>
  `;

  try {
    if (process.env.BREVO_API_KEY) {
      return await sendViaBrevo(toEmail, subject, text, html);
    } else if (process.env.RESEND_API_KEY) {
      return await sendViaResend(toEmail, subject, text, html);
    } else {
      return await sendViaSmtp(toEmail, subject, text, html);
    }
  } catch (error) {
    console.error('[EMAIL_SEND_ERR] Failed to send email:', error.message);
    throw error;
  }
};

module.exports = {
  sendOtpEmail
};
