const crypto = require('crypto');

function generateOrderNumber() {
  // Ex: BF-20260114-8F3A1C
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const token = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BF-${y}${m}${d}-${token}`;
}

module.exports = { generateOrderNumber };
