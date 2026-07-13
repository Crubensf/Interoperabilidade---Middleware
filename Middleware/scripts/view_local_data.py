import sys
import os

# Adiciona o diretório app ao path para poder importar as configurações do db
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app'))

from db import conn

def ver_dados():
    try:
        with conn() as connection:
            print("--- Conexão com o banco local estabelecida com sucesso! ---")
            
            # Buscar os pacientes e profissionais salvos do Middleware
            rows = connection.execute(
                """
                SELECT source_system, resource_type, created_at, payload_fhir
                FROM resource_store
                ORDER BY created_at DESC
                LIMIT 5;
                """
            ).fetchall()
            
            if not rows:
                print("\nNenhum dado encontrado na tabela resource_store. O Middleware ainda não fez cache de dados.")
                return

            print(f"\nExibindo os {len(rows)} registros mais recentes do cache local:\n")
            
            for row in rows:
                print(f"[{row['source_system'].upper()}] - {row['resource_type']}")
                print(f"Salvo em: {row['created_at']}")
                
                # Pega o nome de dentro do payload FHIR, se existir
                payload = row['payload_fhir']
                if 'name' in payload and payload['name']:
                    # Tenta pegar o "text" do primeiro nome
                    nome = payload['name'][0].get('text', 'Sem nome text')
                    print(f"Nome no JSON FHIR: {nome}")
                
                print("-" * 50)
                
    except Exception as e:
        print(f"Erro ao conectar no banco local. O PostgreSQL está rodando?\nErro: {e}")

if __name__ == "__main__":
    ver_dados()
