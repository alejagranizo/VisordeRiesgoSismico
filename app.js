require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const { spawnSync } = require("child_process");

// IMPORTACIÓN ROBUSTA: Si .create no existe, intentamos usar .default
let MongoStore = require("connect-mongo");
if (typeof MongoStore.create !== 'function' && MongoStore.default) {
    MongoStore = MongoStore.default;
}

const app = express();

// 1. Conexión MongoDB y Limpieza
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB conectado");
    try {
      const collections = await mongoose.connection.db.listCollections({ name: 'sessions' }).toArray();
      if (collections.length > 0) {
        await mongoose.connection.db.dropCollection('sessions');
        console.log("Sesiones previas limpiadas (Logout global)");
      }
    } catch (err) {
      console.error("Error al limpiar sesiones:", err);
    }
  })
  .catch((err) => console.error("Error MongoDB:", err));

// 2. Middlewares (Importante: Session debe ir ANTES que las rutas)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 14 * 24 * 60 * 60,
      autoRemove: "disabled",
    }),
    cookie: {
      secure: false, 
      httpOnly: true,
      // Al no definir maxAge, la cookie muere al cerrar el navegador
    },
  })
);

// 3. Archivos estáticos
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/pythonCode/output",
  express.static(path.join(__dirname, "pythonCode", "output")),
);

// 4. Rutas
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/data"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" });
});

// 5. Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});