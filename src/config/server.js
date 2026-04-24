require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { testDbConnection } = require("./dbConfig");

// Rotas
const authRoutes = require("../routes/authRoutes");
const userRoutes = require("../routes/userRoutes");
const addressRoutes = require("../routes/addressRoutes");
const categoryRoutes = require("../routes/categoryRoutes");
const productRoutes = require("../routes/productRoutes");
const cartRoutes = require("../routes/cartRoutes");
const orderRoutes = require("../routes/orderRoutes");
const paymentRoutes = require("../routes/paymentRoutes");

// Endpoints de compatibilidade com o front (template)
const categoryDAL = require("../dal/categoryDAL");
const productDAL = require("../dal/productDAL");

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

// -----------------------------------------------------------------------------
// Compatibilidade com o template do front (sem /api)
// - GET /departments
// - GET /variants?productId=<variantId|productId>
// - GET/POST /users/:id/cart
// -----------------------------------------------------------------------------

app.get("/departments", async (req, res) => {
  try {
    const cats = await categoryDAL.list();

    // departamentos = categorias pai (parent_id NULL)
    const parents = cats.filter((c) => c.parent_id == null);
    const childrenByParent = new Map();
    for (const c of cats) {
      if (c.parent_id != null) {
        if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
        childrenByParent.get(c.parent_id).push(c);
      }
    }

    const departments = parents.map((p) => {
      const children = (childrenByParent.get(p.id) || []).map((x) => x.name);
      return {
        departmentName: p.name,
        categories: children.join(","),
      };
    });

    return res.status(200).json({ departments });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao carregar departments", error: err.message });
  }
});

app.get("/variants", async (req, res) => {
  try {
    const raw = String(req.query.productId || "").trim();
    if (!raw) return res.status(400).json({ message: "productId é obrigatório" });

    const variants = await productDAL.listStoreVariantsByProductOrVariantId(raw);
    // O reducer do front espera { variants: [...] }
    return res.status(200).json({ variants });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao listar variants", error: err.message });
  }
});

// Cart (template)
app.get("/users/:id/cart", require("../controllers/cartController").getCartForTemplate);
app.post("/users/:id/cart", require("../controllers/cartController").postCartForTemplate);

app.get("/health", (req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 3001);

(async () => {
  try {
    await testDbConnection();
    app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
  } catch (err) {
    console.error("❌ Falha ao conectar no MySQL:", err.message);
    process.exit(1);
  }
})();
