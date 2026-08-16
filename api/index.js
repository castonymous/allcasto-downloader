// api/index.js
// Ini adalah "Jembatan" agar Vercel bisa menjalankan server Express kamu
const app = require('../server/index.js');

module.exports = app;