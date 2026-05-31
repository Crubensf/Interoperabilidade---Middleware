import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Users,
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  Loader2,
  UserX,
} from 'lucide-react';
import { pacientesService } from '../services/pacientesService';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const ListagemPacientes = () => {
  const navigate = useNavigate();
  const [pacientes, setPacientes] = useState([]);
  const [filteredPacientes, setFilteredPacientes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pacienteToDelete, setPacienteToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carregar pacientes
  useEffect(() => {
    loadPacientes();
  }, []);

  // Filtrar pacientes quando o termo de busca mudar
  useEffect(() => {
    filterPacientes();
  }, [searchTerm, pacientes]);

  const loadPacientes = async () => {
    try {
      setIsLoading(true);
      const data = await pacientesService.getAll();
      setPacientes(data);
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
      toast.error('Erro ao carregar pacientes');
    } finally {
      setIsLoading(false);
    }
  };

  const filterPacientes = () => {
    if (!searchTerm.trim()) {
      setFilteredPacientes(pacientes);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = pacientes.filter(
      (p) =>
        p.nome?.toLowerCase().includes(term) ||
        p.cpf?.toLowerCase().includes(term) ||
        p.cartao_sus?.toLowerCase().includes(term) ||
        p.telefone?.toLowerCase().includes(term)
    );
    setFilteredPacientes(filtered);
  };

  const handleView = (paciente) => {
    setSelectedPaciente(paciente);
    setIsViewModalOpen(true);
  };

  const handleEdit = (paciente) => {
    navigate('/pacientes/editar', { state: { paciente } });
  };

  const handleDeleteClick = (paciente) => {
    setPacienteToDelete(paciente);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pacienteToDelete) return;

    try {
      setIsDeleting(true);
      await pacientesService.delete(pacienteToDelete.id);
      toast.success('Paciente excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setPacienteToDelete(null);
      loadPacientes();
    } catch (error) {
      console.error('Erro ao excluir paciente:', error);
      toast.error('Erro ao excluir paciente');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCPF = (cpf) => {
    if (!cpf) return '-';
    return cpf;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center mb-2">
            <Users className="w-8 h-8 text-primary-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              Lista de Pacientes
            </h1>
          </div>
          <p className="text-gray-600">
            Gerencie os pacientes cadastrados no sistema
          </p>
        </div>
        <button
          onClick={() => navigate('/pacientes/cadastrar')}
          className="btn-primary inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Paciente
        </button>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, Cartão SUS ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : filteredPacientes.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Comece cadastrando seu primeiro paciente'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/pacientes/cadastrar')}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Paciente
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cartão SUS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPacientes.map((paciente) => (
                  <tr
                    key={paciente.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {paciente.nome}
                      </div>
                      <div className="text-sm text-gray-500">
                        {paciente.email || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatCPF(paciente.cpf)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {paciente.cartao_sus}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {paciente.telefone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleView(paciente)}
                          className="text-primary-600 hover:text-primary-900 transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(paciente)}
                          className="text-green-600 hover:text-green-900 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(paciente)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!isLoading && filteredPacientes.length > 0 && (
        <div className="text-sm text-gray-600">
          Mostrando {filteredPacientes.length} de {pacientes.length} paciente(s)
        </div>
      )}

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Detalhes do Paciente"
        size="lg"
      >
        {selectedPaciente && (
          <div className="space-y-6">
            {/* Dados Pessoais */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-600">Nome</label>
                  <p className="text-gray-900">{selectedPaciente.nome}</p>
                </div>

                {/* --- NOVO CAMPO: Nome da Mãe --- */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-600">Nome da Mãe</label>
                  <p className="text-gray-900">{selectedPaciente.nome_mae || '-'}</p>
                </div>
                {/* ------------------------------- */}

                <div>
                  <label className="text-sm font-medium text-gray-600">CPF</label>
                  <p className="text-gray-900">{formatCPF(selectedPaciente.cpf)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Cartão SUS</label>
                  <p className="text-gray-900">{selectedPaciente.cartao_sus}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Data de Nascimento</label>
                  <p className="text-gray-900">{formatDate(selectedPaciente.data_nascimento)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Sexo</label>
                  <p className="text-gray-900">
                    {selectedPaciente.sexo === 'M' ? 'Masculino' : selectedPaciente.sexo === 'F' ? 'Feminino' : selectedPaciente.sexo === 'O' ? 'Outro' : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Telefone</label>
                  <p className="text-gray-900">{selectedPaciente.telefone || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">E-mail</label>
                  <p className="text-gray-900">{selectedPaciente.email || '-'}</p>
                </div>
              </div>
            </div>

            {/* Endereço */}
            {(selectedPaciente.logradouro || selectedPaciente.cidade) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">CEP</label>
                    <p className="text-gray-900">{selectedPaciente.cep || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Logradouro</label>
                    <p className="text-gray-900">{selectedPaciente.logradouro || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Número</label>
                    <p className="text-gray-900">{selectedPaciente.numero || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Complemento</label>
                    <p className="text-gray-900">{selectedPaciente.complemento || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Bairro</label>
                    <p className="text-gray-900">{selectedPaciente.bairro || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cidade</label>
                    <p className="text-gray-900">{selectedPaciente.cidade || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Estado</label>
                    <p className="text-gray-900">{selectedPaciente.estado || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="btn-secondary"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleEdit(selectedPaciente);
                }}
                className="btn-primary inline-flex items-center"
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
        title="Excluir Paciente"
        message={`Tem certeza que deseja excluir o paciente ${pacienteToDelete?.nome}? Esta ação não pode ser desfeita.`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ListagemPacientes;