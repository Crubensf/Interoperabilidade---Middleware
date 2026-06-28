import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Users,
  UserPlus,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { pacientesService } from '../services/pacientesService';
import { profissionaisService } from '../services/profissionaisService';
import { agendamentosService } from '../services/agendamentosService';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPacientes: 0,
    totalProfissionais: 0,
    totalAgendamentos: 0,
    consultasHoje: 0,
    consultasRealizadas: 0,
    consultasCanceladas: 0,
    taxaComparecimento: 0,
  });
  const [consultasPorStatus, setConsultasPorStatus] = useState([]);
  const [consultasHoje, setConsultasHoje] = useState([]);
  const [proximasConsultas, setProximasConsultas] = useState([]);
  const [profissionaisMaisAtivos, setProfissionaisMaisAtivos] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Carregar dados
      const [pacientes, profissionais, agendamentos] = await Promise.all([
        pacientesService.getAll(),
        profissionaisService.getAll(),
        agendamentosService.getAll(),
      ]);

      // Estatísticas gerais
      const hoje = new Date().toISOString().split('T')[0];
      const consultasDodia = agendamentos.filter(
        (a) => a.data_agendamento === hoje
      );
      const realizadas = agendamentos.filter((a) => a.status === 'realizado');
      const canceladas = agendamentos.filter(
        (a) => a.status === 'cancelado' || a.status === 'faltou'
      );

      const totalComparecimentos = realizadas.length;
      const totalNaoComparecimentos = canceladas.length;
      const totalAgendamentos = agendamentos.length;
      const taxaComparecimento =
        totalAgendamentos > 0
          ? ((totalComparecimentos / totalAgendamentos) * 100).toFixed(1)
          : 0;

      setStats({
        totalPacientes: pacientes.length,
        totalProfissionais: profissionais.length,
        totalAgendamentos: agendamentos.length,
        consultasHoje: consultasDodia.length,
        consultasRealizadas: realizadas.length,
        consultasCanceladas: canceladas.length,
        taxaComparecimento,
      });

      // Consultas por status
      const statusCount = {
        agendado: 0,
        confirmado: 0,
        em_atendimento: 0,
        realizado: 0,
        cancelado: 0,
        faltou: 0,
      };

      agendamentos.forEach((a) => {
        if (statusCount.hasOwnProperty(a.status)) {
          statusCount[a.status]++;
        }
      });

      const statusData = Object.entries(statusCount).map(([status, count]) => ({
        status,
        count,
        percentage:
          agendamentos.length > 0
            ? ((count / agendamentos.length) * 100).toFixed(1)
            : 0,
      }));

      setConsultasPorStatus(statusData);

      // Consultas de hoje
      const consultasHojeSorted = consultasDodia
        .sort((a, b) => (a.hora_agendamento || '').localeCompare(b.hora_agendamento || ''))
        .slice(0, 5);
      setConsultasHoje(consultasHojeSorted);

      // Próximas consultas (futuras)
      const futuras = agendamentos
        .filter((a) => a.data_agendamento && a.data_agendamento >= hoje && a.status === 'agendado')
        .sort((a, b) => {
          const dateCompare = (a.data_agendamento || '').localeCompare(
            b.data_agendamento || ''
          );
          if (dateCompare === 0) {
            return (a.hora_agendamento || '').localeCompare(b.hora_agendamento || '');
          }
          return dateCompare;
        })
        .slice(0, 5);
      setProximasConsultas(futuras);

      // Profissionais mais ativos (por número de consultas)
      const profissionaisMap = {};
      agendamentos.forEach((a) => {
        const profId = a.profissional_id;
        if (!profissionaisMap[profId]) {
          profissionaisMap[profId] = {
            id: profId,
            nome: a.profissionais?.nome || 'N/A',
            especialidade: a.profissionais?.especialidade || 'N/A',
            count: 0,
          };
        }
        profissionaisMap[profId].count++;
      });

      const profissionaisAtivos = Object.values(profissionaisMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setProfissionaisMaisAtivos(profissionaisAtivos);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return timeString.substring(0, 5);
  };

  const getStatusLabel = (status) => {
    const labels = {
      agendado: 'Agendado',
      confirmado: 'Confirmado',
      em_atendimento: 'Em Atendimento',
      realizado: 'Realizado',
      cancelado: 'Cancelado',
      faltou: 'Faltou',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      agendado: 'bg-blue-500',
      confirmado: 'bg-purple-500',
      em_atendimento: 'bg-yellow-500',
      realizado: 'bg-green-500',
      cancelado: 'bg-red-500',
      faltou: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center mb-2">
          <BarChart3 className="w-8 h-8 text-orange-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <p className="text-gray-600">
          Visão geral do sistema e estatísticas importantes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Pacientes */}
        <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/pacientes/lista')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pacientes</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats.totalPacientes}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Profissionais */}
        <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/profissionais/lista')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Profissionais
              </p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats.totalProfissionais}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <UserPlus className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Consultas */}
        <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/consultas/lista')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Consultas</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {stats.totalAgendamentos}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Taxa de Comparecimento */}
        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Taxa Comparecimento
              </p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {stats.taxaComparecimento}%
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Consultas Hoje */}
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Consultas Hoje</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {stats.consultasHoje}
              </p>
            </div>
            <Clock className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        {/* Consultas Realizadas */}
        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">
                Consultas Realizadas
              </p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {stats.consultasRealizadas}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        {/* Consultas Canceladas */}
        <div className="card bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-900">
                Canceladas/Faltas
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {stats.consultasCanceladas}
              </p>
            </div>
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consultas por Status */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Consultas por Status
          </h3>
          <div className="space-y-3">
            {consultasPorStatus.map((item) => (
              <div key={item.status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {getStatusLabel(item.status)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${getStatusColor(item.status)} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profissionais Mais Ativos */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Profissionais Mais Ativos
          </h3>
          {profissionaisMaisAtivos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhum dado disponível
            </p>
          ) : (
            <div className="space-y-3">
              {profissionaisMaisAtivos.map((prof, index) => (
                <div
                  key={prof.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-orange-100 text-orange-600 font-bold w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{prof.nome}</p>
                      <p className="text-sm text-gray-600">{prof.especialidade}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-600">
                      {prof.count}
                    </p>
                    <p className="text-xs text-gray-500">consultas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consultas do Dia e Próximas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consultas Hoje */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Consultas de Hoje
            </h3>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          {consultasHoje.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Nenhuma consulta hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultasHoje.map((consulta) => (
                <div
                  key={consulta.id}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/consultas/lista')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-orange-600">
                          {formatTime(consulta.hora_agendamento)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(consulta.status)} text-white`}>
                          {getStatusLabel(consulta.status)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {consulta.pacientes?.nome || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {consulta.profissionais?.nome || 'N/A'} -{' '}
                        {consulta.profissionais?.especialidade || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximas Consultas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Próximas Consultas
            </h3>
            <Calendar className="w-5 h-5 text-orange-600" />
          </div>
          {proximasConsultas.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Nenhuma consulta agendada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proximasConsultas.map((consulta) => (
                <div
                  key={consulta.id}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/consultas/lista')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-purple-600">
                          {formatDate(consulta.data_agendamento)}
                        </span>
                        <span className="text-gray-600">
                          {formatTime(consulta.hora_agendamento)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {consulta.pacientes?.nome || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {consulta.profissionais?.nome || 'N/A'} -{' '}
                        {consulta.profissionais?.especialidade || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/pacientes/cadastrar')}
            className="bg-white hover:bg-gray-50 text-blue-600 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm"
          >
            <Users className="w-5 h-5" />
            <span>Novo Paciente</span>
          </button>
          <button
            onClick={() => navigate('/profissionais/cadastrar')}
            className="bg-white hover:bg-gray-50 text-green-600 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm"
          >
            <UserPlus className="w-5 h-5" />
            <span>Novo Profissional</span>
          </button>
          <button
            onClick={() => navigate('/consultas/agendar')}
            className="bg-white hover:bg-gray-50 text-purple-600 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm"
          >
            <Calendar className="w-5 h-5" />
            <span>Agendar Consulta</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
