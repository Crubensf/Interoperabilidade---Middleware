import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  UserPlus,
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  Loader2,
  UserX,
} from 'lucide-react';
import { profissionaisService } from '../services/profissionaisService';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const ListagemProfissionais = () => {
  const navigate = useNavigate();
  const [profissionais, setProfissionais] = useState([]);
  const [filteredProfissionais, setFilteredProfissionais] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfissional, setSelectedProfissional] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [profissionalToDelete, setProfissionalToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carregar profissionais
  useEffect(() => {
    loadProfissionais();
  }, []);

  // Filtrar profissionais quando o termo de busca mudar
  useEffect(() => {
    filterProfissionais();
  }, [searchTerm, profissionais]);

  const loadProfissionais = async () => {
    try {
      setIsLoading(true);
      const data = await profissionaisService.getAll();
      setProfissionais(data);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      toast.error('Erro ao carregar profissionais');
    } finally {
      setIsLoading(false);
    }
  };

  const filterProfissionais = () => {
    if (!searchTerm.trim()) {
      setFilteredProfissionais(profissionais);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = profissionais.filter(
      (p) =>
        p.nome?.toLowerCase().includes(term) ||
        p.crm?.toLowerCase().includes(term) ||
        p.especialidade?.toLowerCase().includes(term) ||
        p.telefone?.toLowerCase().includes(term)
    );
    setFilteredProfissionais(filtered);
  };

  const handleView = (profissional) => {
    setSelectedProfissional(profissional);
    setIsViewModalOpen(true);
  };

  const handleEdit = (profissional) => {
    navigate('/profissionais/editar', { state: { profissional } });
  };

  const handleDeleteClick = (profissional) => {
    setProfissionalToDelete(profissional);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!profissionalToDelete) return;

    try {
      setIsDeleting(true);
      await profissionaisService.delete(profissionalToDelete.id);
      toast.success('Profissional excluído com sucesso!');
      setIsDeleteDialogOpen(false);
      setProfissionalToDelete(null);
      loadProfissionais();
    } catch (error) {
      console.error('Erro ao excluir profissional:', error);
      toast.error('Erro ao excluir profissional');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center mb-2">
            <UserPlus className="w-8 h-8 text-green-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              Lista de Profissionais
            </h1>
          </div>
          <p className="text-gray-600">
            Gerencie os profissionais de saúde cadastrados no sistema
          </p>
        </div>
        <button
          onClick={() => navigate('/profissionais/cadastrar')}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Profissional
        </button>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, CRM, especialidade ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        ) : filteredProfissionais.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm
                ? 'Nenhum profissional encontrado'
                : 'Nenhum profissional cadastrado'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Comece cadastrando seu primeiro profissional'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/profissionais/cadastrar')}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Profissional
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
                    CRM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Especialidade
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
                {filteredProfissionais.map((profissional) => (
                  <tr
                    key={profissional.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {profissional.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {profissional.crm}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {profissional.especialidade}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {profissional.telefone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleView(profissional)}
                          className="text-primary-600 hover:text-primary-900 transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(profissional)}
                          className="text-green-600 hover:text-green-900 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(profissional)}
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
      {!isLoading && filteredProfissionais.length > 0 && (
        <div className="text-sm text-gray-600">
          Mostrando {filteredProfissionais.length} de {profissionais.length}{' '}
          profissional(is)
        </div>
      )}

      {/* View Modal - ATUALIZADO CONFORME O CADASTRO */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Detalhes do Profissional"
        size="lg"
      >
        {selectedProfissional && (
          <div className="space-y-6">
            
            {/* Seção 1: Dados Profissionais */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Dados Profissionais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-600">Nome Completo</label>
                  <p className="text-gray-900 font-medium">{selectedProfissional.nome}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">CRM</label>
                  <p className="text-gray-900">{selectedProfissional.crm}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Especialidade</label>
                  <p className="text-gray-900">{selectedProfissional.especialidade}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Conselho Profissional</label>
                  <p className="text-gray-900">{selectedProfissional.conselho || '-'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">UF do Registro</label>
                  <p className="text-gray-900">{selectedProfissional.registro_uf || '-'}</p>
                </div>

                {/* Exibe o tipo de atendimento se houver dados salvos */}
                {selectedProfissional.tipo_atendimento && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Tipo de Atendimento</label>
                    <p className="text-gray-900">{selectedProfissional.tipo_atendimento}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                Informações de Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Telefone</label>
                  <p className="text-gray-900">{selectedProfissional.telefone || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">E-mail</label>
                  <p className="text-gray-900">{selectedProfissional.email || '-'}</p>
                </div>
              </div>
            </div>

            {/* Seção 3: Observações */}
            {selectedProfissional.observacoes && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                  Observações
                </h3>
                <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {selectedProfissional.observacoes}
                </p>
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
                  handleEdit(selectedProfissional);
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
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
        title="Excluir Profissional"
        message={`Tem certeza que deseja excluir o profissional ${profissionalToDelete?.nome}? Esta ação não pode ser desfeita.`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ListagemProfissionais;