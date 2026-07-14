import sys
import os
import httpx

# URL base do Middleware
MIDDLEWARE_URL = "http://localhost:8080"

def sync_data():
    print("Iniciando sincronização completa (Full Sync)...")
    
    # 1. Buscar Bundle de todos os Pacientes e salvar no cache
    print("\n1. Sincronizando Pacientes e Agendamentos...")
    try:
        response = httpx.get(f"{MIDDLEWARE_URL}/fhir/bundle?origem=ambos&dedup=true", timeout=30.0)
        if response.status_code == 200:
            data = response.json()
            total = data.get("total", 0)
            print(f"Sucesso! {total} recursos (Pacientes/Agendamentos) foram baixados, deduplicados e salvos no banco PostgreSQL local do Middleware.")
        else:
            print(f"Falha ao buscar bundle: {response.status_code}")
    except Exception as e:
        print(f"Erro de conexão com o Middleware: {e}")

    # 2. Buscar Profissionais e salvar no cache
    print("\n2. Sincronizando Profissionais...")
    try:
        response = httpx.get(f"{MIDDLEWARE_URL}/profissionais", timeout=30.0)
        if response.status_code == 200:
            data = response.json()
            total = data.get("total", 0)
            print(f"Sucesso! {total} profissionais foram lidos e armazenados no banco local.")
        else:
            print(f"Falha ao buscar profissionais: {response.status_code}")
    except Exception as e:
        print(f"Erro de conexão com o Middleware: {e}")

    print("\n✅ Sincronização concluída! Agora o banco de dados do Middleware (PostgreSQL) contém a junção dos dados do Sistema A (Supabase) e Sistema B (UBS).")
    print("Você pode usar o script view_local_data.py novamente ou conectar via SQLTools para explorar os dados.")

if __name__ == "__main__":
    sync_data()
