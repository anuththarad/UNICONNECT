const sql = require("mssql");

const config = {
  server:   "localhost",
  database: "UNICONNECT",
  user:     "uniconnect",
  password: "uniconnect2026",
  options: {
    encrypt:                false,
    trustServerCertificate: true
  }
};

const pool = new sql.ConnectionPool(config);

pool.connect()
  .then(() => console.log("✅ UNICONNECT DB Connected"))
  .catch(err => console.error("❌ DB Error:", err));

pool.on("error", err => console.error("❌ Pool error:", err));

module.exports = pool;