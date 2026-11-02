# Ventana flotante que lee en voz alta lo que llega a la cola del VPS.
# Uso:  powershell -ExecutionPolicy Bypass -File voice-window.ps1 -SshHost mi-vps
param(
    [Parameter(Mandatory = $true)][string]$SshHost,   # el mismo nombre/alias que usas en VS Code Remote-SSH
    [string]$Queue = '~/.claude-voice/queue.jsonl',
    [string]$Culture = 'es'                           # prefijo de idioma de la voz de Windows
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing, System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like "$Culture*" } | Select-Object -First 1
if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
$synth.SetOutputToDefaultAudioDevice()

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Voz'
$form.TopMost = $true
$form.FormBorderStyle = 'SizableToolWindow'
$form.Size = New-Object System.Drawing.Size(360, 190)
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point(40, 40)
$form.BackColor = [System.Drawing.Color]::FromArgb(24, 24, 27)

$status = New-Object System.Windows.Forms.Label
$status.Dock = 'Top'; $status.Height = 22; $status.ForeColor = [System.Drawing.Color]::Gold
$status.Text = 'conectando...'

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true; $box.ReadOnly = $true; $box.Dock = 'Fill'; $box.ScrollBars = 'Vertical'
$box.BackColor = $form.BackColor; $box.ForeColor = [System.Drawing.Color]::WhiteSmoke
$box.BorderStyle = 'None'; $box.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$bar = New-Object System.Windows.Forms.FlowLayoutPanel
$bar.Dock = 'Bottom'; $bar.Height = 34
$mute = New-Object System.Windows.Forms.CheckBox
$mute.Text = 'Silenciar'; $mute.ForeColor = [System.Drawing.Color]::WhiteSmoke; $mute.AutoSize = $true
$stop = New-Object System.Windows.Forms.Button
$stop.Text = 'Parar'
$stop.Add_Click({ $synth.SpeakAsyncCancelAll() })
$bar.Controls.AddRange(@($mute, $stop))

$form.Controls.Add($box); $form.Controls.Add($bar); $form.Controls.Add($status)

# ssh saliente: lee las lineas nuevas de la cola (reconecta si se cae)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'ssh'
$psi.Arguments = "-o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o BatchMode=yes $SshHost `"mkdir -p `$(dirname $Queue); touch $Queue; tail -n0 -F $Queue`""
$psi.RedirectStandardOutput = $true; $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true

$script:proc = $null
$script:buf = $null
$script:reader = $null

function Connect-Queue {
    $script:proc = [System.Diagnostics.Process]::Start($psi)
    $script:reader = $script:proc.StandardOutput.ReadLineAsync()
    $status.Text = "conectado a $SshHost"
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 300
$timer.Add_Tick({
    if ($null -eq $script:proc -or $script:proc.HasExited) {
        $status.Text = 'reconectando...'
        try { Connect-Queue } catch { $status.Text = "error: $($_.Exception.Message)" }
        return
    }
    while ($script:reader.IsCompleted) {
        $line = $script:reader.Result
        if ($null -eq $line) { return }
        $script:reader = $script:proc.StandardOutput.ReadLineAsync()
        try {
            $text = ($line | ConvertFrom-Json).text
            if ($text) {
                $box.Text = $text
                if (-not $mute.Checked) { $synth.SpeakAsyncCancelAll(); [void]$synth.SpeakAsync($text) }
            }
        } catch { }
    }
})
$timer.Start()

$form.Add_FormClosing({ $timer.Stop(); if ($script:proc -and -not $script:proc.HasExited) { $script:proc.Kill() }; $synth.Dispose() })
[void]$form.ShowDialog()
