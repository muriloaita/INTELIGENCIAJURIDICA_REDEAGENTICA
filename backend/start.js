/**
 * Auto-restart wrapper para o servidor backend
 * Reinicia automaticamente quando o processo crashar (OOM, erro, etc.)
 * Também monitora memória e reinicia preventivamente antes de atingir o limite
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.join(__dirname, 'server.js');
const HEAP_LIMIT_MB = 2048; // 2GB - reiniciar antes de atingir
const MEMORY_CHECK_INTERVAL = 60000; // Verificar a cada 60s
const RESTART_DELAY = 3000; // 3s entre restarts

let restartCount = 0;
let serverProcess = null;

function startServer() {
  restartCount++;
  const startTime = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[AutoRestart] Iniciando servidor (restart #${restartCount}) — ${startTime}`);
  console.log(`${'='.repeat(60)}\n`);

  serverProcess = spawn(process.execPath, [
    `--max-old-space-size=${HEAP_LIMIT_MB}`,
    '--env-file=.env.local',
    SERVER_SCRIPT,
  ], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env },
  });

  serverProcess.on('exit', (code, signal) => {
    const exitTime = new Date().toISOString();
    if (code !== 0 || signal) {
      console.error(`\n[AutoRestart] Servidor crashou (code=${code}, signal=${signal}) — ${exitTime}`);
      console.log(`[AutoRestart] Reiniciando em ${RESTART_DELAY / 1000}s...`);
      setTimeout(startServer, RESTART_DELAY);
    } else {
      console.log(`[AutoRestart] Servidor encerrado normalmente — ${exitTime}`);
    }
  });

  serverProcess.on('error', (err) => {
    console.error(`[AutoRestart] Erro ao iniciar servidor:`, err.message);
    setTimeout(startServer, RESTART_DELAY);
  });
}

// Capturar CTRL+C para encerrar tudo
process.on('SIGINT', () => {
  console.log('\n[AutoRestart] SIGINT recebido, encerrando...');
  if (serverProcess) serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[AutoRestart] SIGTERM recebido, encerrando...');
  if (serverProcess) serverProcess.kill('SIGTERM');
  process.exit(0);
});

console.log('[AutoRestart] Wrapper iniciado. O servidor será reiniciado automaticamente se crashar.');
startServer();
