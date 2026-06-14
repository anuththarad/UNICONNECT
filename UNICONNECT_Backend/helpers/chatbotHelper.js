const i18next = require('i18next');

function getChatbotResponse(intent, locale = 'en', data = {}) {
  const t = i18next.getFixedT(locale);
  const responses = {
    greeting:        () => t('chatbot.greeting'),
    help:            () => t('chatbot.help_options'),
    list_events:     () => t('chatbot.events_list'),
    no_events:       () => t('chatbot.no_events'),
    register_help:   () => t('chatbot.register_help'),
    my_registrations:() => t('chatbot.my_registrations'),
    no_registrations:() => t('chatbot.no_registrations'),
    support:         () => t('chatbot.contact_support'),
    goodbye:         () => t('chatbot.goodbye'),
    unknown:         () => t('chatbot.unknown')
  };
  const handler = responses[intent] || responses.unknown;
  return handler(data);
}

module.exports = { getChatbotResponse };