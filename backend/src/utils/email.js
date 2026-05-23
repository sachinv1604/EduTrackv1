/**
 * Email Utility
 * 
 * Manages email transmissions for EduTrack.
 * It reads standard SMTP environment variables from the .env file.
 * 
 * 💡 ACADEMIC PROJECT HELP (Ethereal Fallback):
 * If SMTP credentials are not configured in your .env, Nodemailer will 
 * automatically spin up a test SMTP account via Ethereal Mail, send the 
 * email, and output the clickable preview URL to the server logs. 
 * This enables zero-config local testing!
 */
const nodemailer = require('nodemailer');

/**
 * Creates an SMTP Transporter based on credentials.
 */
const getTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Option A: Custom SMTP Credentials Provided in .env
  if (host && user && pass) {
    console.log(`[EMAIL] Initializing custom SMTP transport using ${host}...`);
    return nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465, // Use SSL/TLS for port 465
      auth: { user, pass }
    });
  }

  // Option B: Fallback Auto-Generated Developer Sandbox (Ethereal Mail)
  console.log('[EMAIL] SMTP credentials missing in .env. Initializing developer Ethereal Sandbox...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
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
};

/**
 * Sends a secure, HTML-formatted 6-digit numeric OTP to the user's email.
 * 
 * @param {string} toEmail - The recipient's email address
 * @param {string} otp - The 6-digit numeric OTP code
 */
const sendOtpEmail = async (toEmail, otp) => {
  try {
    const transporter = await getTransporter();

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'EduTrack Team'}" <${process.env.SMTP_FROM_EMAIL || 'no-reply@edutrack.com'}>`,
      to: toEmail,
      subject: 'EduTrack - Password Reset Verification OTP 🔑',
      text: `Your EduTrack verification OTP code is: ${otp}. It is valid for 5 minutes.`,
      html: `
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
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL_SENT] OTP dispatched to ${toEmail}`);

    // If using Ethereal sandbox, output the preview link to server logs
    if (nodemailer.getTestMessageUrl(info)) {
      console.log('\n--- 📬 DEVELOPMENT EMAIL PREVIEW CHANNEL ---');
      console.log('Open this link to read the verification email instantly:');
      console.log(nodemailer.getTestMessageUrl(info));
      console.log('--------------------------------------------\n');
    }

    return info;
  } catch (error) {
    console.error('[EMAIL_SEND_ERR] Failed to send email:', error.message);
    throw error;
  }
};

module.exports = {
  sendOtpEmail
};
