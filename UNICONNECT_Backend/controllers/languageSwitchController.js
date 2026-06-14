const jwt = require('jsonwebtoken');

const switchLanguage = async (req, res) => {
  const { locale } = req.body;
  if (!['en', 'ta', 'pt', 'si'].includes(locale)) {
    return res.status(400).json({ message: 'Invalid locale' });
  }
  const newToken = jwt.sign(
    { ...req.user, locale },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('locale', locale, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false });
  res.json({ token: newToken, locale });
};

module.exports = { switchLanguage };