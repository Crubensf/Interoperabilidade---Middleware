import agendamentoService from '../services/agendamento.service.js';

class AgendamentoController {
  async getFhirBundle(req, res) {
    try {
      const { id } = req.params;

      const fhirBundle = await agendamentoService.obterBundleFhir(id);

      if (!fhirBundle) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }

      res.setHeader('Content-Type', 'application/fhir+json');
      return res.status(200).json(fhirBundle);

    } catch (error) {
      console.error('Erro no AgendamentoController:', error);
      return res.status(500).json({ 
        error: 'Erro interno ao processar o Bundle FHIR', 
        details: error.message 
      });
    }
  }

  async getFhirBundleTodos(req, res) {
    try {
      const fhirBundle = await agendamentoService.obterBundleFhirTodos();

      res.setHeader('Content-Type', 'application/fhir+json');
      return res.status(200).json(fhirBundle);
    } catch (error) {
      console.error('Erro no AgendamentoController:', error);
      return res.status(500).json({
        error: 'Erro interno ao processar o Bundle FHIR',
        details: error.message
      });
    }
  }
}

export default new AgendamentoController();