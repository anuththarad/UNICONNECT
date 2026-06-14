const i18next = require('i18next');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// Loads the HTML template for the right locale, falls back to English
function loadTemplate(templateName, locale) {
  const localePath = path.join(__dirname, `../views/emails/${locale}/${templateName}.html`);
  const fallbackPath = path.join(__dirname, `../views/emails/en/${templateName}.html`);
  if (fs.existsSync(localePath)) return fs.readFileSync(localePath, 'utf8');
  return fs.readFileSync(fallbackPath, 'utf8');
}

// Replaces {{key}} in HTML template with actual values
function fillTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

async function sendEmail({ locale = 'en', to, templateName, templateData, subjectKey, subjectData }) {
  const t = i18next.getFixedT(locale);
  const subject = t(subjectKey, subjectData);
  const rawHtml = loadTemplate(templateName, locale);
  const html = fillTemplate(rawHtml, {
    ...templateData,
    greeting: t('email.greeting', { name: templateData.name }),
    footer: t('email.footer')
  });

  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

module.exports = { sendEmail };