import { useState } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

function ModalFuncionario({ funcionario, onFechar, onSalvo }) {
  const editando = !!funcionario;
  const [form, setForm] = useState({
    nome: funcionario?.nome ?? "",
    cargo: funcionario?.cargo ?? "",
    whatsappJid: funcionario?.whatsappJid?.replace("@s.whatsapp.net", "") ?? ""
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (editando) {
        await api.put(`/equipe/${funcionario._id}`, form);
      } else {
        await api.post("/equipe", form);
      }
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {editando ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input
              className="input"
              placeholder="Ex: Gestor de tráfego"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp (número com DDI)
            </label>
            <input
              className="input"
              placeholder="5537998158843"
              value={form.whatsappJid}
              onChange={(e) => setForm({ ...form, whatsappJid: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">
              Sem espaços ou hífens. Ex: 5537998158843 (DDI + DDD + número)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Equipe() {
  const [modal, setModal] = useState(null); // null | "novo" | funcionário para editar
  const { dados, carregando, recarregar } = useApi("/equipe");

  async function desativar(id) {
    if (!confirm("Remover funcionário da equipe?")) return;
    await api.delete(`/equipe/${id}`);
    recarregar();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-500 text-sm mt-1">
            Membros marcados como "(agência)" nos prompts da IA
          </p>
        </div>
        <button onClick={() => setModal("novo")} className="btn-primary">
          <Plus className="w-4 h-4" />
          Novo membro
        </button>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !dados?.length ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-2">Nenhum membro cadastrado</p>
          <p className="text-sm text-gray-300">
            Adicione os funcionários da agência para que a IA os reconheça nos grupos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {dados.map((f) => (
            <div key={f._id} className="card p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-green-700">
                  {f.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{f.nome}</span>
                  {f.cargo && (
                    <span className="text-xs text-gray-400">· {f.cargo}</span>
                  )}
                  {!f.ativo && (
                    <span className="badge bg-gray-100 text-gray-500">Inativo</span>
                  )}
                </div>
                {f.whatsappJid && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {f.whatsappJid.replace("@s.whatsapp.net", "")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setModal(f)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => desativar(f._id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ModalFuncionario
          funcionario={modal === "novo" ? null : modal}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); recarregar(); }}
        />
      )}
    </div>
  );
}
