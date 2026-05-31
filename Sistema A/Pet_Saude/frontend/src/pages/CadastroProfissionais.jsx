import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { UserPlus, Save, X } from 'lucide-react';
import { profissionaisService } from '../services/profissionaisService';



const CadastroProfissionais = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
  register,
  handleSubmit,
  reset,
  formState: { errors },

  } = useForm({
    defaultValues: {
      especialidade: '',
      tipo_atendimento: '',
      conselho: '',
      registro_uf: '',
    },
  });


  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      await profissionaisService.create(data);
      toast.success('Profissional cadastrado com sucesso!');
      reset();
    } catch (error) {
      console.error('Erro ao cadastrar profissional:', error);
      toast.error(error.response?.data?.error || 'Erro ao cadastrar profissional');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    toast.success('Formulário limpo!');
  };

  const especialidades = [
    'Cardiologia',
    'Dermatologia',
    'Endocrinologia',
    'Gastroenterologia',
    'Geriatria',
    'Ginecologia',
    'Neurologia',
    'Obstetrícia',
    'Oftalmologia',
    'Ortopedia',
    'Otorrinolaringologia',
    'Pediatria',
    'Pneumologia',
    'Psiquiatria',
    'Urologia',
    'Clínica Geral',
    'Enfermagem',
    'Fisioterapia',
    'Nutrição',
    'Psicologia',
    'Outro',
  ].sort();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-2">
          <UserPlus className="w-8 h-8 text-green-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">
            Cadastro de Profissionais
          </h1>
        </div>
        <p className="text-gray-600">
          Registre médicos e profissionais de saúde no sistema.
        </p>
      </div>

      {/* Form Card */}
      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados Profissionais */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Dados Profissionais
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

              {/* CRM */}
              <div>
                <label className="label">
                  CRM <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.crm ? 'border-red-500' : ''}`}
                  placeholder="Ex: CRM/CE 12345"
                  {...register('crm', {
                    required: 'CRM é obrigatório',
                    minLength: {
                      value: 5,
                      message: 'CRM deve ter no mínimo 5 caracteres',
                    },
                  })}
                />
                {errors.crm && (
                  <p className="mt-1 text-sm text-red-500">{errors.crm.message}</p>
                )}
              </div>

              {/* Especialidade */}
              <div>
                <label className="label">
                  Especialidade <span className="text-red-500">*</span>
                </label>
                <select
                  className={`input-field ${
                    errors.especialidade ? 'border-red-500' : ''
                  }`}
                  {...register('especialidade', {
                    required: 'Especialidade é obrigatória',
                  })}
                >
                  <option value="" disabled hidden>
                    Selecione
                  </option>

                  {especialidades.map((esp) => (
                    <option key={esp} value={esp}>
                      {esp}
                    </option>
                  ))}
                </select>
                {errors.especialidade && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.especialidade.message}
                  </p>
                )}
              </div>

              {/* Conselho Profissional */}
              <div>
                <label className="label">
                  Conselho Profissional <span className="text-red-500">*</span>
                </label>

                <select
                  className={`input-field ${errors.conselho ? 'border-red-500' : ''}`}
                  {...register('conselho', {
                    required: 'Conselho profissional é obrigatório',
                  })}
                >
                  <option value="" disabled hidden>
                    Selecione
                  </option>
                  <option value="CRM">CRM - Conselho Regional de Medicina</option>
                  <option value="COREN">COREN - Conselho Regional de Enfermagem</option>
                  <option value="CREFITO">CREFITO - Conselho Regional de Fisioterapia</option>
                  <option value="CRN">CRN - Conselho Regional de Nutrição</option>
                  <option value="CRP">CRP - Conselho Regional de Psicologia</option>
                  <option value="CRO">CRO - Conselho Regional de Odontologia</option>
                  <option value="CREFONO">CREFONO - Conselho Regional de Fonoaudiologia</option>
                  <option value="CRF">CRF - Conselho Regional de Farmácia</option>
                  <option value="Outro">Outro</option>
                </select>

                {errors.conselho && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.conselho.message}
                  </p>
                )}
              </div>

              {/* Registro UF */}
              <div>
                <label className="label">
                  UF do Registro <span className="text-red-500">*</span>
                </label>

                <select
                  className={`input-field ${errors.registro_uf ? 'border-red-500' : ''}`}
                  {...register('registro_uf', {
                    required: 'UF do registro é obrigatória',
                  })}
                >
                  <option value="" disabled hidden>
                    Selecione
                  </option>
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

                {errors.registro_uf && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.registro_uf.message}
                  </p>
                )}
              </div>

              {/* Tipo de Atendimento */}
                <div>
                  <label className="label">
                    Tipo de Atendimento <span className="text-red-500">*</span>
                  </label>

                  <select
                    className={`input-field ${
                      errors.tipo_atendimento ? 'border-red-500' : ''
                    }`}
                    {...register('tipo_atendimento', {
                      required: 'Tipo de atendimento é obrigatório',
                    })}
                  >
                    <option value="" disabled hidden>
                      Selecione
                    </option>
                    <option value="Presencial">Presencial</option>
                    <option value="Telemedicina">Telemedicina</option>
                    <option value="Presencial e Telemedicina">Presencial e Telemedicina</option>
                  </select>

                  {errors.tipo_atendimento && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.tipo_atendimento.message}
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

          {/* Informações Adicionais */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Informações Adicionais
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {/* Observações */}
              <div>
                <label className="label">Observações</label>
                <textarea
                  className="input-field"
                  rows="4"
                  placeholder="Informações adicionais, horários de atendimento, etc."
                  {...register('observacoes')}
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary inline-flex items-center"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center"
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Salvando...' : 'Salvar Profissional'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroProfissionais;
