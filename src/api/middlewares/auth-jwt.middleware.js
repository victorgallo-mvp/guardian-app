import jwt from "jsonwebtoken";
import config from "../../config/index.js";

export function autenticarJwt(req, res, next) {
  const cabecalho = req.headers.authorization ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  try {
    req.usuario = jwt.verify(token, config.dashboard.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}
