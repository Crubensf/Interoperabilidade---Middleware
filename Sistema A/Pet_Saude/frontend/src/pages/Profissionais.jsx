import { UserPlus } from 'lucide-react';

const Profissionais = () => {
  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="card">
        <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Cadastro de Profissionais
        </h2>
        <p className="text-gray-600 mb-6">
          Esta funcionalidade será implementada em breve.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Próximas etapas:</strong> Permitirá cadastrar médicos e profissionais 
            de saúde com especialidades, CRM e horários de atendimento.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profissionais;
