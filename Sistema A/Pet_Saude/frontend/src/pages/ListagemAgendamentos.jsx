import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Calendar,
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  Loader2,
  CalendarX,
  Filter,
  X as XIcon,
  Monitor, // Novo ícone
  MapPin   // Novo ícone
} from 'lucide-react';
import { agendamentosService } from '../services/agendamentosService';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const ListagemAgendamentos = () => {
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState([]);
  const [filteredAgendamentos, setFilteredAgendamentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedAgendamento, setSelectedAgendamento] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [agendamentoToDelete, setAgendamentoToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadAgendamentos();
  }, []);

  useEffect(() => {
    filterAgendamentos();
  }, [searchTerm, filterStatus, filterDate, agendamentos]);

  const loadAgendamentos = async () => {
    try {
      setIsLoading(true);
      const data = await agendamentosService.getAll();
      setAgendamentos(data);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAgendamentos = () => {
    let filtered = [...agendamentos];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.pacientes?.nome?.toLowerCase().includes(term) ||
          a.profissionais?.nome?.toLowerCase().includes(term) ||
          a.profissionais?.especialidade?.toLowerCase().includes(term)
      );
    }

    if (filterStatus) {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }

    if (filterDate) {
      filtered = filtered.filter((a) => a.data_agendamento === filterDate);
    }

    setFilteredAgendamentos(filtered);
  };

  const handleView = (agendamento) => {
    setSelectedAgendamento(agendamento);
    setIsViewModalOpen(true);
  };

  const handleEdit = (agendamento) => {
    navigate('/consultas/editar', { state: { agendamento } });
  };

  const handleDeleteClick = (agendamento) => {
    setAgendamentoToDelete(agendamento);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agendamentoToDelete) return;

    try {
      setIsDeleting(true);
      await agendamentosService.delete(agendamentoToDelete.id);
      toast.success('Agendamento excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setAgendamentoToDelete(null);
      loadAgendamentos();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir agendamento');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await agendamentosService.updateStatus(id, newStatus);
      toast.success('Status atualizado com sucesso!');
      loadAgendamentos();
      // Atualiza também o modal se estiver aberto
      if (selectedAgendamento && selectedAgendamento.id === id) {
        setSelectedAgendamento({ ...selectedAgendamento, status: newStatus });
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterDate('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Corrige problema de fuso horário ao criar data simples
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return timeString.substring(0, 5);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      agendado: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Agendado' },
      confirmado: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Confirmado' },
      em_atendimento: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Em Atendimento' },
      realizado: { bg: 'bg-green-100', text: 'text-green-800', label: 'Realizado' },
      cancelado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
      faltou: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Faltou' },
    };

    const config = statusConfig[status] || statusConfig.agendado;

    return (
      <span
        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const hasActiveFilters = searchTerm || filterStatus || filterDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center mb-2">
            <Calendar className="w-8 h-8 text-purple-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              Lista de Agendamentos
            </h1>
          </div>
          <p className="text-gray-600">
            Gerencie os agendamentos de consultas do sistema
          </p>
        </div>
        <button
          onClick={() => navigate('/consultas/agendar')}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Consulta
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-700 font-medium">
              <Filter className="w-5 h-5 mr-2" />
              Filtros
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center"
              >
                <XIcon className="w-4 h-4 mr-1" />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar paciente ou profissional..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="">Todos os status</option>
                <option value="agendado">Agendado</option>
                <option value="confirmado">Confirmado</option>
                <option value="em_atendimento">Em Atendimento</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
                <option value="faltou">Faltou</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Agendamentos List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : filteredAgendamentos.length === 0 ? (
          <div className="card text-center py-12">
            <CalendarX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {hasActiveFilters
                ? 'Nenhum agendamento encontrado'
                : 'Nenhum agendamento cadastrado'}
            </h3>
            <p className="text-gray-600 mb-6">
              {hasActiveFilters
                ? 'Tente ajustar os filtros'
                : 'Comece criando seu primeiro agendamento'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => navigate('/consultas/agendar')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agendar Consulta
              </button>
            )}
          </div>
        ) : (
          filteredAgendamentos.map((agendamento) => (
            <div
              key={agendamento.id}
              className="card hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Date and Time */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-purple-600 font-semibold">
                      <Calendar className="w-5 h-5 mr-2" />
                      {formatDate(agendamento.data_agendamento)} às{' '}
                      {formatTime(agendamento.hora_agendamento)}
                    </div>
                    {getStatusBadge(agendamento.status)}
                  </div>

                  {/* Patient and Professional */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Paciente:</span>{' '}
                      <span className="text-gray-900">
                        {agendamento.pacientes?.nome || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Profissional:
                      </span>{' '}
                      <span className="text-gray-900">
                        {agendamento.profissionais?.nome || 'N/A'} -{' '}
                        {agendamento.profissionais?.especialidade || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Tipo e Local (Visível na lista) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center">
                         {agendamento.tipo_atendimento === 'Telemedicina' ? <Monitor className="w-4 h-4 mr-1"/> : <MapPin className="w-4 h-4 mr-1"/>}
                         <span className="font-medium mr-1">Modalidade:</span> {agendamento.tipo_atendimento || '-'}
                      </div>
                      <div>
                         <span className="font-medium">Local/Link:</span> {agendamento.local_atendimento || '-'}
                      </div>
                  </div>

                  {/* Observations (if any) */}
                  {agendamento.observacoes && (
                    <div className="text-sm text-gray-500 italic">
                      "{agendamento.observacoes.substring(0, 80)}
                      {agendamento.observacoes.length > 80 && '...'}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3 border-t md:border-t-0 pt-3 md:pt-0">
                  <button
                    onClick={() => handleView(agendamento)}
                    className="text-primary-600 hover:text-primary-900 transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(agendamento)}
                    className="text-purple-600 hover:text-purple-900 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(agendamento)}
                    className="text-red-600 hover:text-red-900 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {!isLoading && filteredAgendamentos.length > 0 && (
        <div className="text-sm text-gray-600">
          Mostrando {filteredAgendamentos.length} de {agendamentos.length}{' '}
          agendamento(s)
        </div>
      )}

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Detalhes do Agendamento"
        size="lg"
      >
        {selectedAgendamento && (
          <div className="space-y-6">
            {/* Status */}
            <div>
              <label className="text-sm font-medium text-gray-600">Status Atual</label>
              <div className="mt-2">{getStatusBadge(selectedAgendamento.status)}</div>
            </div>

            {/* Data e Horário */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Data e Horário
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Data</label>
                  <p className="text-gray-900">
                    {formatDate(selectedAgendamento.data_agendamento)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Horário</label>
                  <p className="text-gray-900">
                    {formatTime(selectedAgendamento.hora_agendamento)}
                  </p>
                </div>
              </div>
            </div>

            {/* NOVA SEÇÃO: Modalidade e Local */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Modalidade e Local
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                     {selectedAgendamento.tipo_atendimento === 'Telemedicina' ? <Monitor className="w-4 h-4"/> : <MapPin className="w-4 h-4"/>}
                     Tipo de Atendimento
                  </label>
                  <p className="text-gray-900 font-medium">
                    {selectedAgendamento.tipo_atendimento || 'Não informado'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    {selectedAgendamento.tipo_atendimento === 'Telemedicina' ? 'Link / Plataforma' : 'Sala / Consultório'}
                  </label>
                  {selectedAgendamento.tipo_atendimento === 'Telemedicina' && selectedAgendamento.local_atendimento?.startsWith('http') ? (
                     <a href={selectedAgendamento.local_atendimento} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block truncate">
                        {selectedAgendamento.local_atendimento}
                     </a>
                  ) : (
                    <p className="text-gray-900">
                        {selectedAgendamento.local_atendimento || 'Não informado'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Paciente */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Paciente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nome</label>
                  <p className="text-gray-900">
                    {selectedAgendamento.pacientes?.nome || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Cartão SUS
                  </label>
                  <p className="text-gray-900">
                    {selectedAgendamento.pacientes?.cartao_sus || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Telefone</label>
                  <p className="text-gray-900">
                    {selectedAgendamento.pacientes?.telefone || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Profissional e CRM */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Profissional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nome</label>
                  <p className="text-gray-900">
                    {selectedAgendamento.profissionais?.nome || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Especialidade
                  </label>
                  <p className="text-gray-900">
                    {selectedAgendamento.profissionais?.especialidade || 'N/A'}
                  </p>
                </div>
                <div>
              <label className="text-sm font-medium text-gray-600">CRM</label>
              <p className="text-gray-900">
                {selectedAgendamento.profissionais?.crm || 'Não informado'}
              </p>
           </div>

              </div>
            </div>

            {/* Observações */}
            {selectedAgendamento.observacoes && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                  Observações
                </h3>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-gray-900 whitespace-pre-wrap">
                    {selectedAgendamento.observacoes}
                    </p>
                </div>
              </div>
            )}

            {/* Mudar Status */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Alterar Status
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  'agendado',
                  'confirmado',
                  'em_atendimento',
                  'realizado',
                  'cancelado',
                  'faltou',
                ].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      handleStatusChange(selectedAgendamento.id, status);
                      // Não fecha o modal automaticamente para permitir ver a mudança
                      // setIsViewModalOpen(false); 
                    }}
                    disabled={selectedAgendamento.status === status}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAgendamento.status === status
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
                        : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() +
                      status.slice(1).replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleEdit(selectedAgendamento);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Agendamento"
        message={`Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ListagemAgendamentos;