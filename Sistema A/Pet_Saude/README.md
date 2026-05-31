# Sistema de Gestão Médica - MediCare

Sistema completo de gestão médica para controle de pacientes, profissionais e agendamentos de consultas.

## 🚀 Tecnologias Utilizadas

### Backend
- Node.js + Express
- Supabase (PostgreSQL)
- CORS
- dotenv

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router DOM
- React Hook Form
- Axios
- React Hot Toast
- Lucide React (ícones)

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn
- Conta no Supabase (já configurada)

## 🔧 Instalação

### 1. Backend

```bash
# Navegar até a pasta do backend
cd backend

# Instalar dependências
npm install

# O arquivo .env já está configurado com suas credenciais Supabase
# Verificar se o arquivo .env contém:
# SUPABASE_URL=sua_url
# SUPABASE_KEY=sua_key
# PORT=5000
# FRONTEND_URL=http://localhost:5173

# Iniciar o servidor
npm run dev
```

O backend estará rodando em `http://localhost:5000`

### 2. Frontend

```bash
# Em outro terminal, navegar até a pasta do frontend
cd frontend

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

O frontend estará disponível em `http://localhost:5173`

## 📊 Estrutura do Banco de Dados

### Tabela: pacientes
```sql
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cpf TEXT,
  cartao_sus TEXT NOT NULL,
  data_nascimento DATE,
  sexo CHAR(1),
  telefone TEXT,
  email TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: profissionais
```sql
CREATE TABLE profissionais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  crm TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: agendamentos
```sql
CREATE TABLE agendamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES pacientes(id),
  profissional_id UUID REFERENCES profissionais(id),
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME NOT NULL,
  status TEXT DEFAULT 'agendado',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎨 Funcionalidades Implementadas

### ✅ Fase 1 (Atual)
- [x] Página Inicial com navegação
- [x] Cadastro completo de Pacientes
- [x] Validação de formulários
- [x] Notificações toast
- [x] Design responsivo e moderno

### 🔄 Próximas Fases
- [ ] Listagem e edição de Pacientes
- [ ] Cadastro de Profissionais
- [ ] Agendamento de Consultas
- [ ] Dashboard com estatísticas
- [ ] Busca e filtros avançados

## 🎯 API Endpoints

### Pacientes
- `GET /pacientes` - Listar todos os pacientes
- `GET /pacientes/:id` - Buscar paciente por ID
- `POST /pacientes` - Criar novo paciente
- `PUT /pacientes/:id` - Atualizar paciente
- `DELETE /pacientes/:id` - Deletar paciente

### Profissionais
- `GET /profissionais` - Listar todos os profissionais
- `POST /profissionais` - Criar novo profissional

### Agendamentos
- `GET /agendamentos` - Listar todos os agendamentos
- `POST /agendamentos` - Criar novo agendamento
- `GET /agendamentos/disponibilidade` - Verificar disponibilidade
- `PATCH /agendamentos/:id/status` - Atualizar status

## 📝 Alterações no Backend

### Melhorias Implementadas:
1. **Encoding UTF-8**: Corrigidos caracteres mal formatados
2. **CORS**: Configuração específica para o frontend
3. **Validações**: Adicionadas validações básicas no endpoint de criação de pacientes
4. **Variável de ambiente**: Adicionada `FRONTEND_URL` para configurar CORS

## 🎨 Design System

### Paleta de Cores
- **Primary**: Azul (#3b82f6)
- **Success**: Verde (#10b981)
- **Error**: Vermelho (#ef4444)
- **Warning**: Laranja (#f59e0b)

### Componentes Reutilizáveis
- Cards com hover effects
- Inputs com validação visual
- Botões primary e secondary
- Toast notifications
- Layout responsivo

## 🚀 Deploy

### Backend
Pode ser deployado em:
- Render
- Railway
- Heroku
- Vercel

### Frontend
Pode ser deployado em:
- Vercel
- Netlify
- Firebase Hosting

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- Desktop (1920px+)
- Tablet (768px - 1024px)
- Mobile (320px - 767px)

## 🐛 Troubleshooting

### Erro de CORS
Verifique se o `FRONTEND_URL` no `.env` do backend está correto.

### Erro de conexão com Supabase
Verifique as credenciais no arquivo `.env` do backend.

### Erro ao instalar dependências
Tente limpar o cache:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 👨‍💻 Desenvolvimento

### Estrutura de Pastas - Frontend
```
frontend/
├── src/
│   ├── components/
│   │   └── Layout.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── CadastroPacientes.jsx
│   │   ├── Profissionais.jsx
│   │   ├── Consultas.jsx
│   │   └── Dashboard.jsx
│   ├── services/
│   │   ├── api.js
│   │   └── pacientesService.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 📄 Licença

Este projeto é de uso acadêmico/interno.

## 🤝 Contribuindo

Para contribuir com o projeto:
1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

Desenvolvido com ❤️ para o projeto PET-SAÚDE
