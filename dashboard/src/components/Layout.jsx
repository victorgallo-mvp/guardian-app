import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users2, Bell, UsersRound, LogOut, Shield, Settings, Brain, BarChart2 } from "lucide-react";

const nav = [
  { to: "/", icon: LayoutDashboard, label: "Visão Geral", end: true },
  { to: "/notificacoes", icon: Bell, label: "Notificações" },
  { to: "/grupos", icon: Users2, label: "Grupos" },
  { to: "/equipe", icon: UsersRound, label: "Equipe" },
  { to: "/treinamento", icon: Brain, label: "Treinamento" },
  { to: "/relatorios", icon: BarChart2, label: "Relatório Semanal" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" }
];

export default function Layout() {
  const navigate = useNavigate();

  function sair() {
    localStorage.removeItem("guardiao_token");
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
          <Shield className="text-green-400 w-5 h-5" />
          <span className="font-semibold text-white text-sm">Guardião WPP</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={sair}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
