import { Router } from "express";
import jwt from "jsonwebtoken";
import config from "../../config/index.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, senha } = req.body ?? {};

  if (email !== config.dashboard.email || senha !== config.dashboard.senha) {
    return res.status(401).json({ erro: "Credenciais inválidas" });
  }

  const token = jwt.sign({ email, role: "admin" }, config.dashboard.jwtSecret, { expiresIn: "7d" });

  res.json({ token, expiresIn: "7d" });
});

export default router;
