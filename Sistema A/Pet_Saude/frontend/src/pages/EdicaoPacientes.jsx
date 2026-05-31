import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { User, Save, X, ArrowLeft } from 'lucide-react';
import { pacientesService } from '../services/pacientesService';

const EdicaoPacientes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Recupera os dados passados pela navegação
  const pacienteToEdit = location.state?.paciente;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      nome: '',
      cpf: '',
      cartao_sus: '',
      data_nascimento: '',
      sexo: '',
      nome_mae: '', // Campo novo incluído
      telefone: '',
      email: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    },
  });

  // Carrega os dados no formulário ao abrir a tela
  useEffect(() => {
    if (!pacienteToEdit) {
      toast.error('Paciente não encontrado');
      navigate('/pacientes/lista');
      return;
    }

    // Formata os dados para o formulário (especialmente a data)
    const dadosFormatados = {
      ...pacienteToEdit,
      // Garante que a data esteja no formato YYYY-MM-DD para o input type="date"
      data_nascimento: pacienteToEdit.data_nascimento 
        ? pacienteToEdit.data_nascimento.split('T')[0] 
        : '',
    };

    reset(dadosFormatados);
  }, [pacienteToEdit, navigate, reset]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      await pacientesService.update(pacienteToEdit.id, data);
      toast.success('Paciente atualizado com sucesso!');
      navigate('/pacientes/lista');
    } catch (error) {
      console.error('Erro ao atualizar paciente:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar paciente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/pacientes/lista');
  };

  if (!pacienteToEdit) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/pacientes/lista')}
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para lista
        </button>
        <div className="flex items-center mb-2">
          <User className="w-8 h-8 text-primary-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Editar Paciente</h1>
        </div>
        <p className="text-gray-600">
          Atualize os dados do paciente {pacienteToEdit.nome}
        </p>
      </div>

      {/* Form Card */}
      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Dados Pessoais */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Dados Pessoais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Nome Completo */}
              <div className="md:col-span-2">
                <label className="label">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.nome ? 'border-red-500' : ''}`}
                  placeholder="Digite o nome completo"
                  {...register('nome', {
                    required: 'Nome é obrigatório',
                    minLength: {
                      value: 3,
                      message: 'Nome deve ter no mínimo 3 caracteres',
                    },
                  })}
                />
                {errors.nome && (
                  <p className="mt-1 text-sm text-red-500">{errors.nome.message}</p>
                )}
              </div>

              {/* CPF */}
              <div>
                <label className="label">
                  CPF <span className="text-red-500">*</span>
                </label>
                <input
                  className={`input-field ${errors.cpf ? 'border-red-500' : ''}`}
                  maxLength="14"
                  placeholder="000.000.000-00"
                  {...register('cpf', {
                    required: 'CPF é obrigatório',
                    pattern: {
                      value: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
                      message: 'Formato inválido',
                    },
                  })}
                />
                {errors.cpf && (
                  <p className="text-red-500 text-sm">{errors.cpf.message}</p>
                )}
              </div>

              {/* Cartão SUS */}
              <div>
                <label className="label">
                  Cartão SUS <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.cartao_sus ? 'border-red-500' : ''}`}
                  placeholder="000 0000 0000 0000"
                  maxLength="18"
                  {...register('cartao_sus', {
                    required: 'Cartão SUS é obrigatório',
                  })}
                />
                {errors.cartao_sus && (
                  <p className="mt-1 text-sm text-red-500">{errors.cartao_sus.message}</p>
                )}
              </div>

              {/* Data de Nascimento */}
              <div>
                <label className="label">
                  Data de Nascimento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className={`input-field ${errors.data_nascimento ? 'border-red-500' : ''}`}
                  {...register('data_nascimento', {
                    required: 'Data de nascimento é obrigatória',
                  })}
                />
                {errors.data_nascimento && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.data_nascimento.message}
                  </p>
                )}
              </div>

              {/* Sexo */}
              <div>
                <label className="label">
                  Sexo <span className="text-red-500">*</span>
                </label>
                <select
                  className={`input-field ${errors.sexo ? 'border-red-500' : ''}`}
                  {...register('sexo', {
                    required: 'Sexo é obrigatório',
                  })}
                >
                  <option value="" disabled hidden>Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                </select>
                {errors.sexo && (
                  <p className="mt-1 text-sm text-red-500">{errors.sexo.message}</p>
                )}
              </div>

              {/* Nome da Mãe */}
              <div className="md:col-span-2">
                <label className="label">
                  Nome da Mãe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.nome_mae ? 'border-red-500' : ''}`}
                  placeholder="Digite o nome completo da mãe"
                  {...register('nome_mae', {
                    required: 'Nome da mãe é obrigatório',
                    minLength: {
                      value: 3,
                      message: 'Nome da mãe deve ter no mínimo 3 caracteres',
                    },
                  })}
                />
                {errors.nome_mae && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.nome_mae.message}
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Contato */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Informações de Contato
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Telefone */}
              <div>
                <label className="label">Telefone</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="(00) 00000-0000"
                  maxLength="15"
                  {...register('telefone')}
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="email@exemplo.com"
                  {...register('email', {
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'E-mail inválido',
                    },
                  })}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Endereço
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CEP */}
              <div>
                <label className="label">CEP</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="00000-000"
                  maxLength="9"
                  {...register('cep')}
                />
              </div>

              {/* Logradouro */}
              <div className="md:col-span-2">
                <label className="label">Logradouro</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Rua, Avenida, etc."
                  {...register('logradouro')}
                />
              </div>

              {/* Número */}
              <div>
                <label className="label">Número</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nº"
                  {...register('numero')}
                />
              </div>

              {/* Complemento */}
              <div>
                <label className="label">Complemento</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Apto, Bloco, etc."
                  {...register('complemento')}
                />
              </div>

              {/* Bairro */}
              <div>
                <label className="label">Bairro</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Bairro"
                  {...register('bairro')}
                />
              </div>

              {/* Cidade */}
              <div>
                <label className="label">Cidade</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Cidade"
                  {...register('cidade')}
                />
              </div>

              {/* Estado */}
              <div>
                <label className="label">Estado</label>
                <select className="input-field" {...register('estado')}>
                  <option value="" disabled hidden>Selecione</option>
                  <option value="AC">Acre</option>
                  <option value="AL">Alagoas</option>
                  <option value="AP">Amapá</option>
                  <option value="AM">Amazonas</option>
                  <option value="BA">Bahia</option>
                  <option value="CE">Ceará</option>
                  <option value="DF">Distrito Federal</option>
                  <option value="ES">Espírito Santo</option>
                  <option value="GO">Goiás</option>
                  <option value="MA">Maranhão</option>
                  <option value="MT">Mato Grosso</option>
                  <option value="MS">Mato Grosso do Sul</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PA">Pará</option>
                  <option value="PB">Paraíba</option>
                  <option value="PR">Paraná</option>
                  <option value="PE">Pernambuco</option>
                  <option value="PI">Piauí</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="RN">Rio Grande do Norte</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="RO">Rondônia</option>
                  <option value="RR">Roraima</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="SP">São Paulo</option>
                  <option value="SE">Sergipe</option>
                  <option value="TO">Tocantins</option>
                </select>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary inline-flex items-center"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center"
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EdicaoPacientes;