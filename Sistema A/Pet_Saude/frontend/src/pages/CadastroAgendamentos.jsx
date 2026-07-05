import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Calendar, Save, X, AlertCircle, CheckCircle, MapPin, Monitor } from 'lucide-react';
import { agendamentosService } from '../services/agendamentosService';
import { pacientesService } from '../services/pacientesService';
import { profissionaisService } from '../services/profissionaisService';

const CadastroAgendamentos = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [isLoadingPacientes, setIsLoadingPacientes] = useState(true);
  const [isLoadingProfissionais, setIsLoadingProfissionais] = useState(true);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(null);

  const [opcoesTipoAtendimento, setOpcoesTipoAtendimento] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    resetField, // <--- A SOLUÇÃO: Função específica para resetar um campo limpo
    formState: { errors },
  } = useForm({
    defaultValues: {
      status: 'agendado',
      tipo_atendimento: '',
      local_atendimento: '', 
      profissional_id: '',
      paciente_id: '',
      data_agendamento: '',
      hora_agendamento: '',
    },
  });

  // Observando os campos
  const watchPaciente = watch('paciente_id');      
  const watchProfissional = watch('profissional_id');
  const watchData = watch('data_agendamento');
  const watchHora = watch('hora_agendamento');
  const watchTipoAtendimento = watch('tipo_atendimento');

  useEffect(() => {
    loadPacientes();
    loadProfissionais();
  }, []);

  // Lógica de Automação do Tipo de Atendimento
  useEffect(() => {
    if (watchProfissional) {
      const profissional = profissionais.find(p => String(p.id) === String(watchProfissional));
      
      // Reseta o local completamente (valor e erros) ao trocar de médico
      resetField('local_atendimento');

      if (profissional) {
        const tipoDoProfissional = profissional.tipo_atendimento;

        if (tipoDoProfissional === 'Presencial e Telemedicina') {
          setOpcoesTipoAtendimento(['Presencial', 'Telemedicina']);
          
          // AQUI ESTÁ A CORREÇÃO PRINCIPAL:
          // resetField limpa o valor E remove qualquer erro de validação anterior
          resetField('tipo_atendimento'); 
          
        } else {
          // Lógica de seleção automática (Único tipo)
          let tipoUnico = tipoDoProfissional === 'Online' ? 'Telemedicina' : tipoDoProfissional;
          
          setOpcoesTipoAtendimento([tipoUnico]);
          
          // Define o valor e valida (para ficar verde/correto imediatamente)
          setValue('tipo_atendimento', tipoUnico, { shouldValidate: true });
        }
      }
    } else {
      // Se desmarcar o profissional, reseta tudo sem deixar erros vermelhos
      setOpcoesTipoAtendimento([]);
      resetField('tipo_atendimento');
      resetField('local_atendimento');
    }
  }, [watchProfissional, profissionais, setValue, resetField]); // Adicionado resetField nas dependências

  // Verificar disponibilidade
  useEffect(() => {
    if (watchProfissional && watchData && watchHora) {
      checkAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [watchProfissional, watchData, watchHora]);

  const loadPacientes = async () => {
    try {
      const data = await pacientesService.getAll();
      setPacientes(data);
    } catch (error) {
      toast.error('Erro ao carregar pacientes');
    } finally {
      setIsLoadingPacientes(false);
    }
  };

  const loadProfissionais = async () => {
    try {
      const data = await profissionaisService.getAll();
      setProfissionais(data);
    } catch (error) {
      toast.error('Erro ao carregar profissionais');
    } finally {
      setIsLoadingProfissionais(false);
    }
  };

  const checkAvailability = async () => {
    try {
      setIsCheckingAvailability(true);
      const result = await agendamentosService.checkAvailability(
        watchProfissional,
        watchData,
        watchHora
      );
      setAvailabilityStatus(result.disponivel);
    } catch (error) {
      setAvailabilityStatus(null);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const onSubmit = async (data) => {
    if (availabilityStatus === false) {
      toast.error('Este horário não está disponível');
      return;
    }

    setIsSubmitting(true);

    try {
      await agendamentosService.create(data);
      toast.success('Agendamento criado com sucesso!');
      handleReset();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar agendamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset({ 
      status: 'agendado', 
      tipo_atendimento: '', 
      local_atendimento: '',
      profissional_id: '',
      paciente_id: '',
      data_agendamento: '',
      hora_agendamento: ''
    });
    setAvailabilityStatus(null);
    setOpcoesTipoAtendimento([]);
  };

  const horarios = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00',
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center mb-2">
          <Calendar className="w-8 h-8 text-purple-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Agendar Consulta</h1>
        </div>
        <p className="text-gray-600">
          Crie um novo agendamento vinculando paciente e profissional.
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados Principais */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Dados Principais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SELECT PACIENTE */}
              <div>
                <label className="label">Paciente <span className="text-red-500">*</span></label>
                <select
                  className={`input-field ${errors.paciente_id ? 'border-red-500' : ''}`}
                  {...register('paciente_id', { required: 'Paciente é obrigatório' })}
                  disabled={isLoadingPacientes}
                >
                  {!watchPaciente && (
                    <option value="" hidden>
                      {isLoadingPacientes ? 'Carregando...' : 'Selecione o paciente'}
                    </option>
                  )}
                  {pacientes.map((paciente) => (
                    <option key={paciente.id} value={paciente.id}>
                      {paciente.nome} - ({paciente.cartao_sus})
                    </option>
                  ))}
                </select>
                {errors.paciente_id && <p className="mt-1 text-sm text-red-500">{errors.paciente_id.message}</p>}
              </div>

              {/* SELECT PROFISSIONAL */}
              <div>
                <label className="label">Profissional <span className="text-red-500">*</span></label>
                <select
                  className={`input-field ${errors.profissional_id ? 'border-red-500' : ''}`}
                  {...register('profissional_id', { required: 'Profissional é obrigatório' })}
                  disabled={isLoadingProfissionais}
                >
                  {!watchProfissional && (
                    <option value="" hidden>
                      {isLoadingProfissionais ? 'Carregando...' : 'Selecione o profissional'}
                    </option>
                  )}
                  {profissionais.map((profissional) => (
                    <option key={profissional.id} value={profissional.id}>
                      {profissional.nome} - ({profissional.especialidade}) 
                    </option>
                  ))}
                </select>
                {errors.profissional_id && <p className="mt-1 text-sm text-red-500">{errors.profissional_id.message}</p>}
              </div>
            </div>
          </div>

          {/* Atendimento e Local */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Atendimento e Local
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Tipo de Atendimento <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    className={`input-field pl-10 ${errors.tipo_atendimento ? 'border-red-500' : ''}`}
                    {...register('tipo_atendimento', { required: 'Tipo de atendimento é obrigatório' })}
                    disabled={!watchProfissional}
                  >
                    {!watchTipoAtendimento && (
                      <option value="" hidden>
                        {!watchProfissional ? 'Selecione um profissional' : 'Selecione...'}
                      </option>
                    )}
                    
                    {opcoesTipoAtendimento.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    {watchTipoAtendimento === 'Telemedicina' ? <Monitor className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                  </div>
                </div>
                {errors.tipo_atendimento && <p className="mt-1 text-sm text-red-500">{errors.tipo_atendimento.message}</p>}
              </div>

              <div>
                <label className="label">
                  {watchTipoAtendimento === 'Telemedicina' ? 'Link / Plataforma' : 'Local / Sala'} 
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.local_atendimento ? 'border-red-500' : ''}`}
                  placeholder={watchTipoAtendimento === 'Telemedicina' ? 'Ex: Google Meet' : 'Ex: Sala 104'}
                  {...register('local_atendimento', {
                    required: 'Este campo é obrigatório',
                  })}
                />
                {errors.local_atendimento && <p className="mt-1 text-sm text-red-500">{errors.local_atendimento.message}</p>}
              </div>
            </div>
          </div>

          {/* Data e Horário */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Data e Horário
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Data da Consulta <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className={`input-field ${errors.data_agendamento ? 'border-red-500' : ''}`}
                  min={new Date().toISOString().split('T')[0]}
                  {...register('data_agendamento', { required: 'Data é obrigatória' })}
                />
                {errors.data_agendamento && <p className="mt-1 text-sm text-red-500">{errors.data_agendamento.message}</p>}
              </div>

              <div>
                <label className="label">Horário <span className="text-red-500">*</span></label>
                <select
                  className={`input-field ${errors.hora_agendamento ? 'border-red-500' : ''}`}
                  {...register('hora_agendamento', { required: 'Horário é obrigatório' })}
                >
                  <option value="" hidden>Selecione o horário</option>
                  {horarios.map((hora) => (
                    <option key={hora} value={hora}>{hora}</option>
                  ))}
                </select>
                {errors.hora_agendamento && <p className="mt-1 text-sm text-red-500">{errors.hora_agendamento.message}</p>}
              </div>
            </div>

            {/* Availability Status */}
            {(isCheckingAvailability || availabilityStatus !== null) && (
              <div className="mt-4">
                {isCheckingAvailability ? (
                  <div className="flex items-center text-gray-600 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                    Verificando disponibilidade...
                  </div>
                ) : availabilityStatus === true ? (
                  <div className="flex items-center text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Horário disponível
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Este horário já está ocupado. Escolha outro horário.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status e Observações */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Informações Adicionais
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="label">Status</label>
                <select className="input-field" {...register('status')}>
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="atendido">Atendido</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="faltou">Paciente Faltou</option>
                </select>
              </div>

              <div>
                <label className="label">Observações</label>
                <textarea
                  className="input-field"
                  rows="4"
                  placeholder="Motivo da consulta, sintomas, observações gerais..."
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
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center"
              disabled={isSubmitting || availabilityStatus === false}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Agendando...' : 'Agendar Consulta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroAgendamentos;