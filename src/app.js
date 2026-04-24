import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes.js";

const app = express();

// Middlewares globais
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// Rotas
app.use("/health", healthRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

export default app;
