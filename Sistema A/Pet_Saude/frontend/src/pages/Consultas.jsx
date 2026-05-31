import { Calendar } from 'lucide-react';

const Consultas = () => {
  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="card">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Agendamento de Consultas
        </h2>
        <p className="text-gray-600 mb-6">
          Esta funcionalidade será implementada em breve.
        </p>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            <strong>Próximas etapas:</strong> Permitirá criar agendamentos vinculando 
            pacientes e profissionais, com controle de disponibilidade e status.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Consultas;
