const i18next = require('i18next');
const PDFDocument = require('pdfkit');

// Font paths — needed for Tamil and Sinhala rendering
const FONTS = {
  en: 'Helvetica',
  pt: 'Helvetica',
  ta: './fonts/NotoSansTamil-Regular.ttf',
  si: './fonts/NotoSansSinhala-Regular.ttf'
};

// Download Noto fonts free from fonts.google.com and put in /fonts/

function generateReport({ locale = 'en', data, res }) {
  const t = i18next.getFixedT(locale);
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
  doc.pipe(res);

  // Register font for this locale
  const font = FONTS[locale];
  if (font !== 'Helvetica') doc.registerFont('LocalFont', font);
  doc.font(font !== 'Helvetica' ? 'LocalFont' : font);

  // Title
  doc.fontSize(20).text(t('pdf.report_title'), { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(t('pdf.generated_on', { date: new Date().toLocaleDateString() }));
  doc.moveDown();

  // Table header
  const cols = [
    t('pdf.event_name'),
    t('pdf.participants'),
    t('pdf.revenue'),
    t('pdf.status')
  ];
  doc.fontSize(12).fillColor('#333');
  cols.forEach((col, i) => doc.text(col, 50 + i * 130, doc.y, { width: 120 }));
  doc.moveDown();

  // Table rows
  data.forEach(row => {
    doc.fontSize(10).text(row.name, 50);
    doc.text(row.participants, 180);
    doc.text(row.revenue, 310);
    doc.text(t(`events.${row.status.toLowerCase()}`), 440);
    doc.moveDown(0.5);
  });

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text(t('pdf.confidential'), { align: 'center' });

  doc.end();
}

module.exports = { generateReport };