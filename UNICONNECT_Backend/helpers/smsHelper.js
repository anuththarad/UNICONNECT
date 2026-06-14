const i18next = require('i18next');
const twilio = require('twilio'); // or swap for any free SMS provider

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

async function sendSMS({ locale = 'en', to, messageKey, messageData }) {
  const t = i18next.getFixedT(locale);
  const body = t(messageKey, messageData);
  await client.messages.create({ body, from: process.env.TWILIO_NUMBER, to });
}

module.exports = { sendSMS };