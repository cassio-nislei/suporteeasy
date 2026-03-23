# 🚀 Próximos Passos - Roadmap Técnico

## Phase 1: Validação (AGORA)

### 1.1 Confirmar API Rodando
```powershell
# Terminal 1
cd d:\easyliSRC
npm run dev:api
```

Esperado:
- ✓ `[Nest] ... on port 3001`
- ✓ Swagger em `http://localhost:3001/api/docs`

### 1.2 Confirmar Web Rodando
```powershell
# Terminal 2
cd d:\easyliSRC  
npm run dev:web
```

Esperado:
- ✓ `Ready in xxxx ms`
- ✓ App em `http://localhost:3000`

### 1.3 Testar Instalador
```powershell
# Terminal 3 - Como Admin
cd d:\easyliSRC\tools\windows-agent
install.bat
```

---

## Phase 2: Integração (Esta Semana)

### 2.1 Verificar DB MongoDB

```powershell
# Conectar no MongoDB remoto
$uri = "mongodb://admin:Ncm%40647534@104.234.173.105:27017/atera?authSource=admin"

# Via MongoDB Compass ou Atlas
# Verificar collections criadas
```

**Coleções esperadas:**
- `agents` - Agentes Windows registrados
- `devices` - Dispositivos
- `users` - Usuários
- `tenants` - Tenants

### 2.2 Registrar Agente Teste

```powershell
# Após instalar o agente
# 1. Logar na web ( http://localhost:3000)
# 2. Ir para "Remote Access"
# 3. Verificar agente listado

# Verificar DB
db.agents.find({}) # MongoDB query
```

### 2.3 Criar Sessão Remota

Web → Remote Access → Create Session
- [ ] Selecionar agente
- [ ] Criar sessão
- [ ] Testar visualização
- [ ] Testar mouse/teclado

---

## Phase 3: Building (Semana 2)

### 3.1 Build do MSI

```powershell
cd d:\easyliSRC\tools\windows-agent

# Instalar WiX (se necessário)
# Download: https://wixtoolset.org/

# Compilar MSI
.\build-msi.ps1 -OutputPath "C:\Temp\Dist"
```

**Resultado:**
- `EasyliWindowsAgent.msi` pronto para distribuição

### 3.2 Testar em Múltiplas VMs

```
VM1: Windows 10
VM2: Windows Server 2019
VM3: Windows Server 2022

Para cada:
1. Instalar MSI
2. Executar verify-installation.ps1
3. Testar conectividade
4. Validar Remote Access
```

### 3.3 Documentar Customizações

- [ ] Endpoints variáveis
- [ ] Portas alternativas
- [ ] Configurações de network
- [ ] Opções de segurança

---

## Phase 4: Deployment (Semana 3-4)

### 4.1 Group Policy (Se Domain)

```powershell
# 1. Copiar MSI para share
\\domain.com\share\EasyliWindowsAgent.msi

# 2. Criar GPO
# Computer Configuration\Software Settings\Software Installation
# Apontar para MSI

# 3. Target OU com máquinas
```

### 4.2 Intune/SCCM (Cloud)

```
1. Abrir Intune Admin Center
2. Apps → Windows apps → Add
3. Selecionar MSI
4. Assign to groups
5. Monitor deployment
```

### 4.3 Manual Distribution

```batch
# Criar share ou entrega física
\\company.com\Easyli\EasyliWindowsAgent.msi
\\company.com\Easyli\install.bat
\\company.com\Easyli\INSTALLATION_GUIDE.md

# Usuários executam como Admin
msiexec /i EasyliWindowsAgent.msi /quiet /norestart
```

---

## Phase 5: Monitoring & Support (Ongoing)

### 5.1 Logs Centralizados

```powershell
# Coletar logs de múltiplas máquinas

$machines = @("PC1", "PC2", "PC3")

foreach ($machine in $machines) {
  $logPath = "\\$machine\c$\Program Files\Easyli Windows Agent\logs"
  Copy-Item $logPath -Destination "C:\Logs\$machine" -Recurse
}
```

### 5.2 Health Check Script

```powershell
# Criar script para monitorar saúde
# - Agentes conectados
# - Performance metrics
# - Sessões ativas
# - Erros/warnings em logs

# Agendar para rodar daily
Register-ScheduledTask -TaskName "Easyli-HealthCheck" ...
```

### 5.3 Update Policy

```
1. Nova versão disponível?
2. Build MSI atualizado
3. Deploy via GPO/Intune
4. Monitor adoption
5. Suportar old versions por 30 dias
```

---

## 🎯 Arquitetura de Distribuição

```
                    ┌─────────────┐
                    │  GitHub     │
                    │  Repository │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼─────┐  ┌───▼────┐  ┌───▼────┐
         │  Manual   │  │  SCCM  │  │ Intune │
         │   Share   │  │        │  │        │
         └────┬─────┘  └───┬────┘  └───┬────┘
              │            │            │
         ┌────▼────────────▼────────────▼────┐
         │   Windows Machines (Agents)        │
         │   ✓ Auto-start                    │
         │   ✓ Firewall configured           │
         │   ✓ Defender excluded             │
         │   ✓ Monitoring enabled            │
         └────┬─────────────────────────────┘
              │
         ┌────▼──────────┐
         │  Easyli Web   │
         │  + API        │
         │  + WebSocket  │
         └───────────────┘
```

---

## 📊 Métricas de Sucesso

- [ ] **Instalação:** 100% sucesso rate
- [ ] **Startup:** < 5 seg após login
- [ ] **Conectividade:** < 100ms latência
- [ ] **Sessão:** Inicia em < 2s
- [ ] **Captura:** 30+ FPS
- [ ] **Control:** < 80ms de latência

---

## 🔐 Checklist de Segurança

- [ ] Firewall whitelisting apenas necessário
- [ ] Defender exclusion documentado
- [ ] Senha não armazenada em plain text
- [ ] TLS/HTTPS para API
- [ ] Session tokens com expiry
- [ ] Audit log de todas as sessões
- [ ] Encrypted communication
- [ ] User consent dialogs funcionando

---

## 📞 Suporte & Escalation

### Tier 1 (Usuário Final)
- Execute `verify-installation.ps1`
- Reinicie agente
- Reinicie máquina
- Desinstale/reinstale

### Tier 2 (Admin)
- Analisar logs centralizados
- Verificar group policies
- Testar conectividade
- Verificar firewall rules

### Tier 3 (Development)
- Debug via source code
- Adicionar logging customizado
- Oferecer hot-fix
- Criar version específica

---

## Timeline Estimado

| Phase | Duração | Status |
|-------|---------|--------|
| **1. Validação** | 1 dia | 🔄 Em andamento |
| **2. Integração** | 3-5 dias | ⏳ Próximo |
| **3. Building** | 2-3 dias | ⏳ Programado |
| **4. Deployment** | 5-10 dias | ⏳ Programado |
| **5. Support** | Ongoing | 🔄 Contínuo |

**Total:** ~3-4 semanas para produção completo

---

## 🎓 Documentação para Gerar

- [ ] Admin Quick Reference Card
- [ ] User Installation Guide
- [ ] Troubleshooting Flowchart
- [ ] Security Hardening Guide
- [ ] Performance Tuning Guide
- [ ] Architecture Diagram
- [ ] API Integration Guide
- [ ] FAQ

---

## Links Importantes

- **API Docs:** http://localhost:3001/api/docs
- **Web App:** http://localhost:3000
- **GitHub:** https://github.com/cassio-nislei/suporteeasy
- **Agent Code:** `tools/windows-agent/`
- **Deployment Guide:** `DEPLOYMENT_CHECKLIST.md`
- **Quick Start:** `WINDOWS_AGENT_QUICKSTART.md`

---

## ✅ Ready-to-Execute Commands

```powershell
# Start everything (run as Admin in 2 terminals)
# Terminal 1:
npm run dev:api

# Terminal 2:
npm run dev:web

# Terminal 3 (when ready):
cd tools\windows-agent
install.bat

# Verify:
.\verify-installation.ps1

# Check agent in web at:
# http://localhost:3000 → Remote Access
```

---

**Última atualização:** 2026-03-23  
**Status:** Roadmap Pronto ✅  
**Próximo Passo:** Phase 1 - Validação
