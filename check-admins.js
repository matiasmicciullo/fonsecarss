const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite");

db.all("SELECT id, usuario FROM admin", [], (err, rows) => {
  console.log(rows);
  db.close();
});
