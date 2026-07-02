import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import { CATALOGO_GATILHOS } from "../../core/gatilhos/catalogo.gatilhos.js";

const router = Router();
router.use(autenticarJwt);

router.get("/gatilhos", (req, res) => {
  const gatilhos = Object.entries(CATALOGO_GATILHOS).map(([id, g]) => ({
    id,
    nome: g.nome,
    descricao: g.descricao,
    severidadePadrao: g.severidadePadrao,
    aplicavelEm: g.aplicavelEm
  }));
  res.json(gatilhos);
});

export default router;
