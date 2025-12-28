const multer = require("multer");

// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: "fonsecarssSecretKey123",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 hora
  }
}));


// Base de datos
const db = new sqlite3.Database("./database.sqlite");

// ===== CONFIGURACIÓN MULTER (SUBIDA DE IMÁGENES) =====
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
// ===== FIN MULTER =====

// Crear tabla de vehículos si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS vehiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca TEXT,
    modelo TEXT,
    precio TEXT,
    imagen1 TEXT,
    imagen2 TEXT,
    imagen3 TEXT,
    estado TEXT
  )
`);

// Agregar columna ficha_tecnica si no existe
db.run(
  `ALTER TABLE vehiculos ADD COLUMN ficha_tecnica TEXT`,
  err => {
    // Si la columna ya existe, SQLite tira error: lo ignoramos
    if (err && !err.message.includes("duplicate")) {
      console.error("Error agregando ficha_tecnica:", err.message);
    }
  }
);

// Crear tabla admin si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE,
    password TEXT
)
`);

// Crear nuevo usuario admin (solo admins logueados)
app.post("/api/admin/crear", auth, (req, res) => {

  // SOLO Fonsecars puede crear admins
  if (req.session.usuario !== "Fonsecars") {
    return res.status(403).send("No autorizado");
  }

  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).send("Datos incompletos");
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).send("Error interno");

    db.run(
      "INSERT INTO admin (usuario, password) VALUES (?, ?)",
      [usuario, hash],
      function (err) {
        if (err) {
          return res.send("El usuario ya existe");
        }

        res.redirect("/admin.html");
      }
    );
  });
});



// Middleware de autenticación
function auth(req, res, next) {
  if (req.session.usuario) {
    next();
  } else {
    res.redirect("/login.html");
  }
}

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});


// Login
app.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  db.get("SELECT * FROM admin WHERE usuario = ?", [usuario], (err, row) => {
    if (!row) return res.send("Usuario incorrecto");

    bcrypt.compare(password, row.password, (err, same) => {
      if (!same) return res.send("Contraseña incorrecta");

      req.session.usuario = usuario;
      res.redirect("/admin.html"); 
    });
  });
});

// Panel admin
app.get("/admin.html", auth, (req, res) => {
  res.sendFile(path.join(__dirname, "protected/admin.html"));
});

// Obtener vehículos
app.get("/api/vehiculos", (req, res) => {
  db.all("SELECT * FROM vehiculos", [], (err, rows) => {
    res.json(rows);
  });
});

// Crear vehículo
app.post(
  "/api/vehiculo",
  auth,
  upload.fields([
    { name: "imagen1", maxCount: 1 },
    { name: "imagen2", maxCount: 1 },
    { name: "imagen3", maxCount: 1 }
  ]),
  (req, res) => {
    const { marca, modelo, precio, estado, categoria, ficha_tecnica } = req.body;

    if (!marca || !modelo || !precio || !categoria) {
      return res.status(400).send("Datos incompletos");
    }

    const img1 = req.files["imagen1"]
      ? `/uploads/autos/${req.files["imagen1"][0].filename}`
      : null;

    const img2 = req.files["imagen2"]
      ? `/uploads/autos/${req.files["imagen2"][0].filename}`
      : null;

    const img3 = req.files["imagen3"]
      ? `/uploads/autos/${req.files["imagen3"][0].filename}`
      : null;

      db.run(
  `INSERT INTO vehiculos 
   (marca, modelo, precio, imagen1, imagen2, imagen3, estado, categoria, ficha_tecnica)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    marca,
    modelo,
    precio,
    img1,
    img2,
    img3,
    estado,
    categoria,
    ficha_tecnica
  ],
  () => res.redirect("/admin.html")
);
});

// Obtener admins (solo Fonsecars)
app.get("/api/admins", auth, (req, res) => {
  if (req.session.usuario !== "Fonsecars") {
    return res.status(403).send("No autorizado");
  }

  db.all(
    "SELECT id, usuario FROM admin WHERE usuario != 'Fonsecars'",
    [],
    (err, rows) => {
      res.json(rows);
    }
  );
});

// Eliminar admin (solo Fonsecars)
app.post("/api/admin/eliminar", auth, (req, res) => {
  if (req.session.usuario !== "Fonsecars") {
    return res.status(403).send("No autorizado");
  }

  const { usuario } = req.body;

  if (!usuario || usuario === "Fonsecars") {
    return res.status(400).send("Acción no permitida");
  }

  db.run(
    "DELETE FROM admin WHERE usuario = ?",
    [usuario],
    () => res.redirect("/admin.html")
  );
});

// Cambiar password de admin
app.post("/api/admin/password", auth, (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).send("Datos incompletos");
  }

  // Solo Fonsecars puede cambiar password de otros
  if (
    req.session.usuario !== "Fonsecars" &&
    req.session.usuario !== usuario
  ) {
    return res.status(403).send("No autorizado");
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).send("Error interno");

    db.run(
      "UPDATE admin SET password = ? WHERE usuario = ?",
      [hash, usuario],
      () => res.redirect("/admin.html")
    );
  });
});

// Eliminar vehículo
app.post("/api/vehiculo/eliminar", auth, (req, res) => {
  const { id } = req.body;

  db.run("DELETE FROM vehiculos WHERE id=?", [id], () => {
    res.redirect("/admin.html");
  });
});

// Iniciar servidor
app.listen(3000, () => console.log("Servidor iniciado en http://localhost:3000"));

app.get("/api/session", auth, (req, res) => {
  res.json({ usuario: req.session.usuario });
});
