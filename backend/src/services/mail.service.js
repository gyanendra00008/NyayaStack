require('dotenv').config();
const { BrevoClient } = require('@getbrevo/brevo');

/**
 * Returns an instance of BrevoClient initialized with the environment API key
 * @returns {BrevoClient}
 */
const getBrevoClient = () => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not defined in environment variables');
  }

  return new BrevoClient({ apiKey });
};

/**
 * Normalizes sender details from options or environment variables
 * @param {Object} [customSender]
 * @returns {{ email: string, name: string }}
 */
const getDefaultSender = (customSender = {}) => {
  return {
    email: customSender.email || process.env.MAIL_FROM || 'noreply@nyayastack.com',
    name: customSender.name || process.env.MAIL_FROM_NAME || 'NyayaStack Support',
  };
};

/**
 * Generates responsive HTML and plain text templates for OTP verification
 * @param {Object} params
 * @param {string|number} params.otp - The OTP code
 * @param {string} [params.name] - User's name or username
 * @param {number} [params.expiryMinutes=10] - OTP validity duration in minutes
 * @returns {{ htmlContent: string, textContent: string }}
 */
const generateOtpEmailTemplate = ({ otp, name, expiryMinutes = 10 }) => {
  const recipientName = name ? String(name).trim() : 'User';
  const validDuration = expiryMinutes || 10;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - NyayaStack</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">NyayaStack</h1>
              <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">Secure Identity & Legal Management Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Email Verification Code</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Thank you for registering with NyayaStack. Please use the following One-Time Password (OTP) to verify your email address and activate your account:
              </p>
              <!-- OTP Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 18px 24px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; display: inline-block;">
                      ${otp}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ⏳ This verification code is valid for <strong>${validDuration} minutes</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                For your security, please do not share this OTP with anyone. NyayaStack staff will never ask for your verification code.
              </p>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                  If you did not request this verification code, you can safely ignore this email. No changes will be made to your account.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} NyayaStack. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textContent = `
Hello ${recipientName},

Thank you for registering with NyayaStack.

Your One-Time Password (OTP) for email verification is: ${otp}

This code is valid for ${validDuration} minutes.

For your security, please do not share this code with anyone.
If you did not initiate this request, you can safely ignore this email.

Regards,
NyayaStack Team
  `.trim();

  return { htmlContent, textContent };
};

/**
 * Sends a transactional email using Brevo
 * @param {Object} options
 * @param {string|{ email: string, name?: string }|Array<{ email: string, name?: string }>} options.to - Recipient(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlContent - HTML body content
 * @param {string} [options.textContent] - Optional plain text content
 * @param {{ email: string, name?: string }} [options.sender] - Optional custom sender
 * @returns {Promise<Object>} - Brevo API response
 */
const sendEmail = async ({ to, subject, htmlContent, textContent, sender }) => {
  const client = getBrevoClient();
  const emailSender = getDefaultSender(sender);

  // Normalize recipient format
  let recipients = [];
  if (Array.isArray(to)) {
    recipients = to.map((item) => (typeof item === 'string' ? { email: item } : item));
  } else if (typeof to === 'string') {
    recipients = [{ email: to }];
  } else if (to && typeof to === 'object' && to.email) {
    recipients = [to];
  } else {
    throw new Error('Invalid recipient email address');
  }

  const payload = {
    sender: emailSender,
    to: recipients,
    subject: subject || 'Notification from NyayaStack',
    htmlContent: htmlContent || '<p></p>',
  };

  if (textContent) {
    payload.textContent = textContent;
  }

  try {
    const response = await client.transactionalEmails.sendTransacEmail(payload);
    console.log(`[Brevo] Email dispatched successfully to ${recipients.map((r) => r.email).join(', ')}. MessageId:`, response?.messageId || response?.data?.messageId || 'OK');
    return {
      success: true,
      messageId: response?.messageId || response?.data?.messageId,
      data: response,
    };
  } catch (error) {
    const errorDetails = error?.body || error?.response?.body || error.message || error;
    console.error('Error sending email via Brevo:', errorDetails);
    throw error;
  }
};

/**
 * Sends an OTP verification email to the user
 * Supports both object options and positional arguments:
 *   sendOtpEmail({ to: 'user@example.com', otp: '123456', name: 'John', expiryMinutes: 10 })
 *   sendOtpEmail('user@example.com', '123456', { name: 'John', expiryMinutes: 10 })
 *   sendOtpEmail('user@example.com', '123456')
 *
 * @param {string|Object} optionsOrEmail
 * @param {string|number} [otpParam]
 * @param {Object} [extraOptions]
 * @returns {Promise<Object>}
 */
const sendOtpEmail = async (optionsOrEmail, otpParam, extraOptions = {}) => {
  let to;
  let otp;
  let name;
  let expiryMinutes = 10;
  let sender;

  if (typeof optionsOrEmail === 'object' && optionsOrEmail !== null) {
    to = optionsOrEmail.to || optionsOrEmail.email;
    otp = optionsOrEmail.otp;
    name = optionsOrEmail.name || optionsOrEmail.username;
    expiryMinutes = optionsOrEmail.expiryMinutes || 10;
    sender = optionsOrEmail.sender;
  } else {
    to = optionsOrEmail;
    otp = otpParam;
    if (typeof extraOptions === 'object' && extraOptions !== null) {
      name = extraOptions.name || extraOptions.username;
      expiryMinutes = extraOptions.expiryMinutes || 10;
      sender = extraOptions.sender;
    } else if (typeof extraOptions === 'string') {
      name = extraOptions;
    }
  }

  if (!to) {
    throw new Error('Recipient email address is required');
  }

  if (!otp) {
    throw new Error('OTP is required to send verification email');
  }

  // Log OTP to backend console so development and testing is never blocked
  console.log(`\n==================================================`);
  console.log(`📧 [NyayaStack OTP] Verification Code for ${to}: ${otp}`);
  console.log(`⏳ Valid for ${expiryMinutes} minutes`);
  console.log(`==================================================\n`);

  const { htmlContent, textContent } = generateOtpEmailTemplate({
    otp,
    name,
    expiryMinutes,
  });

  return await sendEmail({
    to,
    subject: `${otp} is your NyayaStack verification code`,
    htmlContent,
    textContent,
    sender,
  });
};

module.exports = {
  getBrevoClient,
  sendEmail,
  sendOtpEmail,
  generateOtpEmailTemplate,
};
