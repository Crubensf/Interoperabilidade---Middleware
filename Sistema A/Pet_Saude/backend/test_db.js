import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testConnection() {
  console.log('Testando conexão com Supabase...');
  try {
    const { data, error } = await supabase.from('pacientes').select('id').limit(1);
    if (error) throw error;
    console.log('Conexão OK. Pacientes encontrados:', data.length);
  } catch (error) {
    console.error('Erro na conexão:', error.message);
  }
}
testConnection();
