# FusionAI Backend - Email Configuration Guide

## Why Verification Codes Aren't Being Sent

The email verification system was previously configured to use **Ethereal Email** (a fake testing SMTP service) that only sends emails to test accounts, not real Gmail/Outlook addresses.

## How to Fix Email Verification

### Option 1: Use Gmail SMTP (Easiest)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Copy the 16-character password

3. **Create a `.env` file** in the backend directory:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-16-character-app-password
   JWT_SECRET=your-super-secret-jwt-key
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Deploy or restart your server**

### Option 2: Use SendGrid (Recommended for Production)

1. **Sign up for SendGrid** (free tier available)
2. **Create an API Key** in your SendGrid dashboard
3. **Update your `.env` file**:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASS=your-sendgrid-api-key
   JWT_SECRET=your-super-secret-jwt-key
   ```

### Option 3: Use Outlook/Hotmail SMTP

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-outlook-email@outlook.com
SMTP_PASS=your-outlook-password
```

## Important Notes

- **Never commit your `.env` file** to version control
- **Gmail App Passwords** are different from your regular password
- **Test thoroughly** before deploying to production
- **Consider using services like SendGrid** for better deliverability in production

## Troubleshooting

- **"Authentication failed"**: Check your SMTP credentials
- **"Emails going to spam"**: This is normal for new senders, whitelist the sender
- **"Connection timeout"**: Verify SMTP host and port settings

## Security Best Practices

- Use environment variables for all sensitive data
- Rotate API keys and passwords regularly
- Use services like SendGrid for production applications
- Implement rate limiting to prevent email abuse
