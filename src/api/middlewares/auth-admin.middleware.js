/**
 * Middleware de autenticação pra rotas administrativas.
 *
 * Exige o header `Authorization: Bearer <ADMIN_TOKEN>`, comparado com o
 * valor configurado em `ADMIN_TOKEN` (env).
 */
import config from "../../config/index.js";
import { ErroNaoAutorizado } from "../../shared/erros.js";

export function autenticarAdmin(req, res, next) {
  const cabecalho = req.headers.authorization ?? "";
  const [tipo, token] = cabecalho.split(" ");

  if (tipo !== "Bearer" || token !== config.admin.token) {
    return next(new ErroNaoAutorizado());
  }

  next();
}
