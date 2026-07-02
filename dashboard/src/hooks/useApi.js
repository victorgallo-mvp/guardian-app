import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client.js";

export function useApi(path, deps = []) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const buscar = useCallback(async () => {
    if (!path) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.get(path);
      setDados(res);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, [path]);

  useEffect(() => {
    buscar();
  }, [buscar, ...deps]);

  return { dados, carregando, erro, recarregar: buscar };
}
