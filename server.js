// server.js
const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const multer = require("multer");

const app = express();
const loginAttempts = {};

// -------------------- MIDDLEWARE --------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "fonsecarssSecretKey123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 // 1 hora
    }
  })
);

// -------------------- DATABASE --------------------
const db = new Database("database.sqlite");

// Vehículos
db.prepare(`
  CREATE TABLE IF NOT EXISTS vehiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca TEXT,
    modelo TEXT,
    precio TEXT,
    imagen1 TEXT,
    imagen2 TEXT,
    imagen3 TEXT,
    estado TEXT,
    categoria TEXT,
    ficha_tecnica TEXT
  )
`).run();

// Admins
db.prepare(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE,
    password TEXT
  )
`).run();

// Crear admin Fonsecars si no existe
const adminExiste = db
  .prepare("SELECT 1 FROM admin WHERE usuario = ?")
  .get("Fonsecars");

if (!adminExiste) {
  const hash = bcrypt.hashSync("8725", 10);
  db.prepare("INSERT INTO admin (usuario, password) VALUES (?, ?)")
    .run("Fonsecars", hash);
}

// -------------------- MULTER --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/autos");
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// -------------------- AUTH MIDDLEWARE --------------------
function auth(req, res, next) {
  if (req.session.usuario) return next();
  res.redirect("/login.html");
}

// -------------------- LOGIN --------------------
app.post("/login", (req, res) => {
  const { usuario, password } = req.body;
  const key = `${req.ip}_${usuario}`;

  if (!loginAttempts[key]) {
    loginAttempts[key] = { count: 0, blocked: false };
  }

  if (loginAttempts[key].blocked) {
    return res
      .status(429)
      .json({ error: "Demasiados intentos fallidos. Acceso bloqueado." });
  }

  const row = db
    .prepare("SELECT * FROM admin WHERE usuario = ?")
    .get(usuario);

  if (!row) {
    registrarFallo(key);
    return res.status(401).json({ error: "Usuario incorrecto" });
  }

  const ok = bcrypt.compareSync(password, row.password);

  if (!ok) {
    registrarFallo(key);
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  loginAttempts[key] = { count: 0, blocked: false };
  req.session.usuario = usuario;
  res.json({ ok: true });
});

function registrarFallo(key) {
  loginAttempts[key].count++;
  if (loginAttempts[key].count >= 5) {
    loginAttempts[key].blocked = true;
  }
}

// -------------------- SESSION INFO --------------------
app.get("/api/session", (req, res) => {
  if (!req.session.usuario) {
    return res.json({});
  }

  res.json({
    usuario: req.session.usuario,
    isSuperAdmin: req.session.usuario === "Fonsecars"
  });
});

// -------------------- LOGOUT --------------------
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
});

// -------------------- PANEL --------------------
app.get("/admin.html", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "protected/admin.html"));
});

// -------------------- VEHÍCULOS --------------------
app.get("/api/vehiculos", (req, res) => {
  const rows = db.prepare("SELECT * FROM vehiculos").all();
  res.json(rows);
});

app.post(
  "/api/vehiculo",
  auth,
  upload.fields([
    { name: "imagen1", maxCount: 1 },
    { name: "imagen2", maxCount: 1 },
    { name: "imagen3", maxCount: 1 }
  ]),
  (req, res) => {
    const {
      marca,
      modelo,
      precio,
      estado,
      categoria,
      ficha_tecnica
    } = req.body;

    if (!marca || !modelo || !precio || !categoria) {
      return res.status(400).send("Datos incompletos");
    }

    const img1 = req.files?.imagen1
      ? `/uploads/autos/${req.files.imagen1[0].filename}`
      : null;
    const img2 = req.files?.imagen2
      ? `/uploads/autos/${req.files.imagen2[0].filename}`
      : null;
    const img3 = req.files?.imagen3
      ? `/uploads/autos/${req.files.imagen3[0].filename}`
      : null;

    db.prepare(`
      INSERT INTO vehiculos
      (marca, modelo, precio, imagen1, imagen2, imagen3, estado, categoria, ficha_tecnica)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      marca,
      modelo,
      precio,
      img1,
      img2,
      img3,
      estado,
      categoria,
      ficha_tecnica
    );

    res.redirect("/admin.html");
  }
);

app.post("/api/vehiculo/eliminar", auth, (req, res) => {
  db.prepare("DELETE FROM vehiculos WHERE id = ?")
    .run(req.body.id);
  res.redirect("/admin.html");
});

// -------------------- ADMINS --------------------
app.post("/api/admin/crear", auth, (req, res) => {
  if (req.session.usuario !== "Fonsecars") {
    return res.status(403).send("No autorizado");
  }

  const { usuario, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  try {
    db.prepare(
      "INSERT INTO admin (usuario, password) VALUES (?, ?)"
    ).run(usuario, hash);
    res.redirect("/admin.html");
  } catch {
    res.send("El usuario ya existe");
  }
});

app.post("/api/admin/eliminar", auth, (req, res) => {
  if (req.session.usuario !== "Fonsecars") {
    return res.status(403).send("No autorizado");
  }

  db.prepare("DELETE FROM admin WHERE usuario = ?")
    .run(req.body.usuario);

  res.redirect("/admin.html");
});

// -------------------- SERVER --------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "FonseCars.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Servidor iniciado en puerto ${PORT}`)
);
