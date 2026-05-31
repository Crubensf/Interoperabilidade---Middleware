import { Link } from 'react-router-dom';
import { Users, UserPlus, Calendar, BarChart3, ArrowRight } from 'lucide-react';

const Home = () => {
  const cards = [
    {
      title: 'Cadastrar Paciente',
      description: 'Adicione novos pacientes ao sistema.',
      icon: Users,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
      link: '/pacientes/cadastrar',
    },
    {
      title: 'Cadastrar Profissional',
      description: 'Registre os médicos e profissionais de saúde no sistema.',
      icon: UserPlus,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
      link: '/profissionais/cadastrar',
    },
    {
      title: 'Agendar Consulta',
      description: 'Crie e gerencie agendamentos de consultas médicas.',
      icon: Calendar,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      link: '/consultas/agendar',
    },
    {
      title: 'Dashboard',
      description: 'Visualize estatísticas e relatórios do sistema.',
      icon: BarChart3,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      link: '/dashboard',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Bem-vindo ao MediCare
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Sistema completo de gestão médica para controle de pacientes, 
          profissionais e agendamentos de consultas.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mt-12">
        {cards.map((card, index) => {
          const Icon = card.icon;
          const isDisabled = card.disabled;
          
          return (
            <Link
              key={index}
              to={isDisabled ? '#' : card.link}
              className={`block ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <div className={`card ${!isDisabled && 'hover:scale-105'} transition-all duration-200`}>
                <div className="flex items-start space-x-4">
                  <div className={`${card.color} ${!isDisabled && card.hoverColor} p-3 rounded-lg transition-colors duration-200`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                      {card.title}
                      {isDisabled && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                          Em breve
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {card.description}
                    </p>
                    {!isDisabled && (
                      <div className="flex items-center text-primary-600 font-medium">
                        Acessar
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info Section */}
      <div className="mt-12 bg-primary-50 rounded-xl p-8 border border-primary-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              100%
            </div>
            <p className="text-gray-600">Seguro e Confiável</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              24/7
            </div>
            <p className="text-gray-600">Disponível</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              Fast
            </div>
            <p className="text-gray-600">Rápido e Eficiente</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
