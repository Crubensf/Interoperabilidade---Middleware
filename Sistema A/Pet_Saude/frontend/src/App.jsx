import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import CadastroPacientes from './pages/CadastroPacientes';
import ListagemPacientes from './pages/ListagemPacientes';
import EdicaoPacientes from './pages/EdicaoPacientes';
import CadastroProfissionais from './pages/CadastroProfissionais';
import ListagemProfissionais from './pages/ListagemProfissionais';
import EdicaoProfissionais from './pages/EdicaoProfissionais';
import CadastroAgendamentos from './pages/CadastroAgendamentos';
import ListagemAgendamentos from './pages/ListagemAgendamentos';
import EdicaoAgendamentos from './pages/EdicaoAgendamentos';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pacientes" element={<ListagemPacientes />} />
          <Route path="/pacientes/lista" element={<ListagemPacientes />} />
          <Route path="/pacientes/cadastrar" element={<CadastroPacientes />} />
          <Route path="/pacientes/editar" element={<EdicaoPacientes />} />
          <Route path="/profissionais" element={<ListagemProfissionais />} />
          <Route path="/profissionais/lista" element={<ListagemProfissionais />} />
          <Route path="/profissionais/cadastrar" element={<CadastroProfissionais />} />
          <Route path="/profissionais/editar" element={<EdicaoProfissionais />} />
          <Route path="/consultas" element={<ListagemAgendamentos />} />
          <Route path="/consultas/lista" element={<ListagemAgendamentos />} />
          <Route path="/consultas/agendar" element={<CadastroAgendamentos />} />
          <Route path="/consultas/editar" element={<EdicaoAgendamentos />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Layout>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;
