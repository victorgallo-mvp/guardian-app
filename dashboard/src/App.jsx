import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Grupos from "./pages/Grupos.jsx";
import GrupoDetalhe from "./pages/GrupoDetalhe.jsx";
import Notificacoes from "./pages/Notificacoes.jsx";
import Equipe from "./pages/Equipe.jsx";

function RequireAuth({ children }) {
  const token = localStorage.getItem("guardiao_token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="grupos" element={<Grupos />} />
          <Route path="grupos/:id" element={<GrupoDetalhe />} />
          <Route path="notificacoes" element={<Notificacoes />} />
          <Route path="equipe" element={<Equipe />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
