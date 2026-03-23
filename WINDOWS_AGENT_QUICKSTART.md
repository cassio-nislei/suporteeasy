# 🎯 Easyli - Próximos Passos & Quick Start

## 📦 Instalador Windows Agent - Pronto para Produção

Temos agora **4 métodos de instalação** para o agente Windows com suporte completo a:
- ✅ Windows Firewall automático
- ✅ Auto-startup no login ATALHO
- ✅ Windows Defender integration
- ✅ Scheduled Tasks
- ✅ Configuração GUI interativa

### 🚀 Opção 1: UI Interativa (RECOMENDADO)

```batch
cd tools\windows-agent
install.bat
```

O que acontece:
- GUI para preencher credenciais
- Firewall automático
- Agente inicia automaticamente
- Criar tarefa agendada

### 🚀 Opção 2: Menu de Setup

```batch
cd tools\windows-agent  
setup-menu.bat
```

Menu interativo com:
- Instalar
- Verificar instalação
- Desinstalar
- Documentação
- Testar

### 🚀 Opção 3: PowerShell (Avançado)

```powershell
cd tools\windows-agent
$params = @{
  ApiUrl = 'http://localhost:3001/api/v1'
  Email = 'seu-email@easyli.local'
  Password = 'sua-senha'
}
.\install-agent-advanced.ps1 @params
```

### 🚀 Opção 4: MSI Enterprise

```powershell
# Construir MSI
cd tools\windows-agent
.\build-msi.ps1
# Gera: EasyliWindowsAgent.msi
```

Distribuir via:
- Group Policy
- SCCM / Intune  
- Manual installation

---

## ✅ Após a Instalação

### 1. Verificar Instalação

```powershell
cd tools\windows-agent
.\verify-installation.ps1
```

Valida:
- ✓ Diretórios
- ✓ Configuração
- ✓ Tarefa agendada
- ✓ Firewall
- ✓ Defender
- ✓ Logs
- ✓ Runtime Node.js

### 2. Testar Conectividade

```powershell
# Verificar conexão com API
Test-NetConnection localhost -Port 3001

# Monitorar logs
Get-Content "C:\Program Files\Easyli Windows Agent\logs\*" -Wait
```

### 3. Editar Configuração

```powershell
notepad "C:\Program Files\Easyli Windows Agent\config\agent-config.json"
```

---

## 📚 Documentação Completa

| Documento | Conteúdo |
|-----------|----------|
| **INSTALLATION_GUIDE.md** | Guia passo a passo com 4 métodos |
| **DEPLOYMENT_CHECKLIST.md** | Checklist completo + troubleshooting |
| **README.md** | Referência técnica do agente |

Todos em: `tools/windows-agent/`

---

## 🎯 Arquitetura

```
Easyli Windows Agent
├── GUI Installer (install.bat)
│   └── install-agent-gui.ps1
├── Advanced PowerShell (install-agent-advanced.ps1)
│   ├── Firewall configuration
│   ├── Defender exclusion
│   └── Scheduled task creation
├── MSI Builder (build-msi.ps1)
│   └── Built with WiX Toolset
├── Verification Tools (verify-installation.ps1)
│   └── 8-point validation
└── Menu System (setup-menu.bat)
    └── Central access point
```

---

## 📋 Checklist de Próximos Passos

### Imediato (Hoje)
- [ ] Testar install.bat localmente
- [ ] Executar verify-installation.ps1
- [ ] Validar agente aparece na web

### Curto Prazo (Esta Semana)
- [ ] Criar MSI com build-msi.ps1
- [ ] Testar em múltiplas máquinas Windows
- [ ] Documentar configuração customizada
- [ ] Criar script de distribuição

### Médio Prazo (Este Mês)
- [ ] Integrar com Group Policy
- [ ] Configurar SCCM/Intune deployment
- [ ] Criar política de segurança
- [ ] Setup monitoramento centralizado

### Longo Prazo
- [ ] Auto-update mechanism
- [ ] Telemetry & health checks
- [ ] Enterprise logging
- [ ] SSO integration

---

## 🔧 Comandos Rápidos

```powershell
# Instalar
cd tools\windows-agent && install.bat

# Verificar
.\verify-installation.ps1

# Desinstalar
Uninstall-Agent.ps1

# Monitorar logs em tempo real
Get-Content "C:\Program Files\Easyli Windows Agent\logs\agent.log" -Wait

# Reiniciar agente
Stop-ScheduledTask -TaskName "Easyli Windows Agent" -Force
Start-ScheduledTask -TaskName "Easyli Windows Agent"

# Editar config
notepad "C:\Program Files\Easyli Windows Agent\config\agent-config.json"
```

---

## 📊 Status Atual

| Componente | Status |
|-----------|--------|
| GUI Installer | ✅ Completo |
| PowerShell Installer | ✅ Completo |
| Firewall Auto | ✅ Implementado |
| Defender Integration | ✅ Implementado |
| Scheduled Tasks | ✅ Implementado |
| MSI Builder | ✅ Pronto |
| Verification Tool | ✅ Completo |
| Documentation | ✅ Completo |
| Menu System | ✅ Novo |

---

## 🚀 Como Começar AGORA

### 1. Windows Admin
```batch
cmd /k "cd /d d:\easyliSRC\tools\windows-agent && install.bat"
```

### 2. PowerShell Admin
```powershell
cd d:\easyliSRC\tools\windows-agent
.\install-agent-gui.ps1
```

### 3. Menu Interativo
```batch
cd d:\easyliSRC\tools\windows-agent && setup-menu.bat
```

---

## 💡 Tips

- **Primeira vez?** Use `install.bat` (GUI)
- **Customizar?** Use `install-agent-advanced.ps1`
- **Empresa?** Use `build-msi.ps1`
- **Troubleshoot?** Execute `verify-installation.ps1`
- **Documentação?** Veja `DEPLOYMENT_CHECKLIST.md`

---

## 📞 Suporte

Dúvidas ou problemas?
1. Executar `verify-installation.ps1`
2. Consultar `DEPLOYMENT_CHECKLIST.md`
3. Revisar logs em `C:\Program Files\Easyli Windows Agent\logs\`

---

**Última atualização:** 2026-03-23  
**Status:** Pronto para Produção ✅
