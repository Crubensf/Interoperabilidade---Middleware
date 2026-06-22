import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'mock_db.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    pacientes: [],
    especialidades: [],
    locais_atendimento: [],
    profissionais: [],
    agendamentos: []
  }, null, 2));
}

let db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function createClient(url, key) {
  return {
    from: (table) => {
      if (!db[table]) {
        db[table] = [];
        saveDb();
      }

      let queryData = [...db[table]];
      let isSingle = false;
      let error = null;

      const chain = {
        select: (fields) => {
          // Simplification: we return all fields.
          // Handle nested selection loosely if needed (e.g. profissional:profissional_id (...))
          // But for mock, returning the whole object is usually fine, we just need to populate relations
          if (fields && fields.includes(':')) {
             // very basic relation populate logic based on the specific queries in index.js
             if (table === 'profissionais' && fields.includes('especialidade:especialidade_id')) {
                queryData = queryData.map(item => ({
                  ...item,
                  especialidade: db.especialidades.find(e => e.id == item.especialidade_id) || null
                }));
             }
             if (table === 'agendamentos') {
                queryData = queryData.map(item => ({
                  ...item,
                  pacientes: db.pacientes.find(p => p.id == item.paciente_id) || null,
                  paciente: db.pacientes.find(p => p.id == item.paciente_id) || null,
                  profissionais: (() => {
                    const prof = db.profissionais.find(p => p.id == item.profissional_id) || null;
                    if (prof) {
                      return { ...prof, especialidade: db.especialidades.find(e => e.id == prof.especialidade_id) || null };
                    }
                    return null;
                  })(),
                  profissional: (() => {
                    const prof = db.profissionais.find(p => p.id == item.profissional_id) || null;
                    if (prof) {
                      return { ...prof, especialidade: db.especialidades.find(e => e.id == prof.especialidade_id) || null };
                    }
                    return null;
                  })(),
                  local: db.locais_atendimento.find(l => l.id == item.local_id) || null
                }));
             }
          }
          return chain;
        },
        insert: (rows) => {
          const inserted = rows.map(r => ({ id: Date.now() + Math.floor(Math.random() * 1000), ...r }));
          db[table].push(...inserted);
          saveDb();
          queryData = inserted;
          return chain;
        },
        update: (updates) => {
          queryData = queryData.map(item => {
            const updatedItem = { ...item, ...updates };
            const index = db[table].findIndex(x => x.id == item.id);
            if (index !== -1) db[table][index] = updatedItem;
            return updatedItem;
          });
          saveDb();
          return chain;
        },
        delete: () => {
          const idsToDelete = queryData.map(x => x.id);
          db[table] = db[table].filter(x => !idsToDelete.includes(x.id));
          saveDb();
          queryData = [];
          return chain;
        },
        eq: (field, value) => {
          queryData = queryData.filter(item => item[field] == value);
          return chain;
        },
        order: (field, opts) => {
          const asc = opts?.ascending !== false;
          queryData.sort((a, b) => {
            if (a[field] < b[field]) return asc ? -1 : 1;
            if (a[field] > b[field]) return asc ? 1 : -1;
            return 0;
          });
          return chain;
        },
        single: () => {
          isSingle = true;
          return chain;
        },
        then: (resolve, reject) => {
          let data = isSingle ? (queryData[0] || null) : queryData;
          if (isSingle && !data && table !== 'agendamentos') {
             // some single queries throw error if not found, let's just return null for simplicity
             // wait, the code expects data to be null if not found sometimes.
          }
          resolve({ data, error });
        }
      };
      
      return chain;
    }
  };
}
