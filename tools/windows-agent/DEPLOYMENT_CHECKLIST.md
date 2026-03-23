# Easyli Windows Agent - Deployment Checklist

## ✅ Instalação e Configuração

### 1. Preparação
- [ ] Acessar máquina Windows Server ou Windows 10+
- [ ] Logon como Administrador
- [ ] Verificar conectividade com servidor Easyli
- [ ] Ter credenciais Easyli disponíveis (email/senha)

### 2. Instalação (Escolher uma opção)

#### Opção A: GUI Interativa (Recomendado)
```batch
REM Execute como Administrador
cd d:\easyliSRC\tools\windows-agent
install.bat
```

**Steps:**
- [ ] Execute install.bat com privilégios de admin
- [ ] Preencha os campos:
  - [ ] API URL (ex: http://localhost:3001/api/v1)
  - [ ] Email do usuário Easyli
  - [ ] Senha
  - [ ] Caminho de instalação (padrão: C:\Program Files\Easyli Windows Agent)
  - [ ] Porta Bridge (padrão: 37609)
- [ ] Marque as opções desejadas:
  - [ ] Enable Local Input Control
  - [ ] Add Windows Defender Exclusion
  - [ ] Configure Windows Firewall Rules
  - [ ] Automatically Start After Installation
- [ ] Clique "Install"
- [ ] Aguarde conclusão

#### Opção B: Menu Interativo
```batch
REM Execute como Administrador
cd d:\easyliSRC\tools\windows-agent
setup-menu.bat
```

**Steps:**
- [ ] Execute setup-menu.bat
- [ ] Escolha opção 1 (Install Agent)
- [ ] Siga os prompts da GUI

#### Opção C: PowerShell Direto
```powershell
# Execute como Administrador
cd d:\easyliSRC\tools\windows-agent

$params = @{
  ApiUrl = 'http://localhost:3001/api/v1'
  Email = 'seu-email@easyli.local'
  Password = 'sua-senha'
  InstallRoot = 'C:\Program Files\Easyli Windows Agent'
  BridgePort = 37609
  DisableLocalInputControl = $false
  SkipDefenderExclusion = $false
  SkipFirewallConfig = $false
  SkipStart = $false
}

.\install-agent-advanced.ps1 @params
```

### 3. Validação Pós-Instalação

```powershell
# Execute como Administrador
cd d:\easyliSRC\tools\windows-agent
.\verify-installation.ps1
```

**Verificações automáticas:**
- [ ] ✓ Diretório de instalação existe
- [ ] ✓ Arquivo de configuração presente
- [ ] ✓ Tarefa agendada criada
- [ ] ✓ Logs sendo gerados
- [ ] ✓ Regras de firewall configuradas
- [ ] ✓ Exclusão do Defender adicionada
- [ ] ✓ Runtime Node.js disponível
- [ ] ✓ Manifesto de instalação criado

### 4. Verificação Manual

**Windows Firewall:**
```powershell
# Abra PowerShell como Admin
Get-NetFirewallRule -DisplayName "*Easyli*" | Format-Table DisplayName, Direction, Enabled
```
Esperado: Regras do Easyli Windows Agent listadas

**Tarefa Agendada:**
```powershell
Get-ScheduledTask -TaskName "Easyli Windows Agent" | Select-Object TaskName, State, LastTaskResult
```
Esperado: Estado = Ready, LastTaskResult = 0

**Defender Exclusion:**
```powershell
(Get-MpPreference).ExclusionPath | Select-String "Easyli"
```
Esperado: Caminho da instalação listado

**Logs:**
```powershell
Get-Content "C:\Program Files\Easyli Windows Agent\logs\*" -Tail 20
```

---

## 🔧 Configuração (Pós-Instalação)

### Editar Configuração
```powershell
# Abra o arquivo de configuração
notepad "C:\Program Files\Easyli Windows Agent\config\agent-config.json"
```

**Opções disponíveis:**
```json
{
  "EASYLI_API_URL": "http://localhost:3001/api/v1",
  "EASYLI_EMAIL": "admin@easyli.local",
  "EASYLI_CAPTURE_BACKEND": "auto",    // auto, powershell, ffmpeg
  "EASYLI_CAPTURE_INTERVAL_MS": 250,
  "EASYLI_DISABLE_LOCAL_INPUT_CONTROL": false
}
```

### Reiniciar Agente
```powershell
# Parar a tarefa
Stop-ScheduledTask -TaskName "Easyli Windows Agent" -Force

# Iniciar novamente
Start-ScheduledTask -TaskName "Easyli Windows Agent"
```

---

## 🧪 Testes

### Teste 1: Verificar Conectividade
```powershell
# Testar conexão com API
Test-NetConnection -ComputerName localhost -Port 3001 -InformationLevel Detailed
```
Esperado: TcpTestSucceeded = True

### Teste 2: Verificar Logs
```powershell
Get-Content "C:\Program Files\Easyli Windows Agent\logs\*" -Tail 50 | Select-String "error|warning|connected" -Context 2
```

### Teste 3: Monitorar Agente
```powershell
# Acompanhar logs em tempo real
Get-Content "C:\Program Files\Easyli Windows Agent\logs\agent.log" -Wait
```

---

## 🔐 Segurança

### Verificações de Segurança
- [ ] ✓ Tarefa agendada roda com privilégios elevados
- [ ] ✓ Firewall configurado (apenas entrada necessária)
- [ ] ✓ Defender exclui a pasta de varredura
- [ ] ✓ Arquivo de configuração protegido
- [ ] ✓ Senhas não armazenadas em plain text (use variáveis de ambiente)

### Desabilitar Entrada (View-Only Mode)
```powershell
# Editar configuração
$config = Get-Content "C:\Program Files\Easyli Windows Agent\config\agent-config.json" | ConvertFrom-Json
$config.EASYLI_DISABLE_LOCAL_INPUT_CONTROL = "true"
$config | ConvertTo-Json | Set-Content "C:\Program Files\Easyli Windows Agent\config\agent-config.json"

# Reiniciar
Stop-ScheduledTask -TaskName "Easyli Windows Agent" -Force
Start-ScheduledTask -TaskName "Easyli Windows Agent"
```

---

## 🛑 Desinstalação

### Opção 1: Via Script
```powershell
# Execute como Administrador
C:\Program Files\Easyli Windows Agent\uninstall-agent.ps1
```

### Opção 2: Via Painel de Controle
1. Abra **Settings** → **Apps** → **Installed apps**
2. Procure por "Easyli Windows Agent"
3. Clique em **Uninstall**

### Verificar Desinstalação
```powershell
# Verificar se tarefa foi removida
Get-ScheduledTask -TaskName "Easyli Windows Agent" -ErrorAction SilentlyContinue

# Verificar se diretório foi removido
Test-Path "C:\Program Files\Easyli Windows Agent"

# Verificar se firewall foi limpo
Get-NetFirewallRule -DisplayName "*Easyli*"
```

---

## 📊 Troubleshooting

### Agente não aparece na Web
1. [ ] Verificar se agente está rodando: `Get-ScheduledTask -TaskName "Easyli Windows Agent"`
2. [ ] Verificar logs: `Get-Content "C:\Program Files\Easyli Windows Agent\logs\*" -Tail 50`
3. [ ] Verificar conectividade API: `Test-NetConnection -ComputerName localhost -Port 3001`
4. [ ] Verificar credenciais no config.json

### Firewall não funciona
1. [ ] Verificar regras: `Get-NetFirewallRule -DisplayName "*Easyli*"`
2. [ ] Se vazio, reinstalar com `-SkipFirewallConfig false`
3. [ ] Se ausente, adicionar manualmente:
```powershell
New-NetFirewallRule -DisplayName "Easyli Windows Agent" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 37609
```

### Defender bloqueia
1. [ ] Verificar exclusão: `(Get-MpPreference).ExclusionPath | Select-String "Easyli"`
2. [ ] Se vazio, adicionar manualmente:
```powershell
Add-MpPreference -ExclusionPath "C:\Program Files\Easyli Windows Agent"
```

### Agente consome muitos recursos
1. [ ] Ajustar intervalo de captura: `EASYLI_CAPTURE_INTERVAL_MS: 500` (aumentar)
2. [ ] Reduzir qualidade JPEG: `EASYLI_CAPTURE_JPEG_QUALITY: 50`
3. [ ] Reduzir resolução: `EASYLI_CAPTURE_MAX_WIDTH: 1024`

---

## 📞 Suporte

Se encontrar problemas:
1. Coletar logs: `C:\Program Files\Easyli Windows Agent\logs\`
2. Executar verify: `.\verify-installation.ps1`
3. Contatar suporte com logs e output de verificação

---

## 🎯 Próximos Passos Recomendados

1. **Testar localmente primeiro**
   - Instale em máquina de desenvolvimento
   - Verifique funcionamento
   - Teste entrada/saída

2. **Criar MSI para distribuição**
   ```powershell
   .\build-msi.ps1 -OutputPath "C:\Temp\Dist"
   ```

3. **Documentar configuração empresarial**
   - Endpoints específicos
   - Portas customizadas
   - Políticas de segurança

4. **Implantar via Group Policy** (Windows Domain)
   - Usar MSI com SCCM/Intune
   - Configurar via GPO scripts
   - Automatizar distribuição

5. **Monitorar instalações**
   - Registrar logs centralizados
   - Alertar sobre falhas
   - Manter atualizado
