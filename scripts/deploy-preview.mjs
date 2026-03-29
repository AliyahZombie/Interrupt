import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const port = 13002;
const pidFilePath = path.join(repoRoot, 'preview-13002.pid');
const logFilePath = path.join(repoRoot, 'preview-13002.log');

function readProcCmdline(pid) {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    return raw.replace(/\0/g, ' ').trim();
  } catch {
    return null;
  }
}

function isProbablyVitePreviewForPort(cmdline) {
  if (!cmdline) return false;
  return cmdline.includes('vite') && cmdline.includes('preview') && cmdline.includes(String(port));
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminateProcess(pid, reason) {
  if (!isProcessAlive(pid)) return;

  const cmdline = readProcCmdline(pid);
  if (!isProbablyVitePreviewForPort(cmdline)) {
    throw new Error(
      `Refusing to kill PID ${pid} (${reason}) because it does not look like Vite preview on :${port}. cmdline=${JSON.stringify(cmdline)}`,
    );
  }

  process.stdout.write(`Stopping existing preview (pid=${pid})...\n`);

  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    throw new Error(`Failed to SIGTERM pid=${pid}: ${String(err)}`);
  }

  for (let i = 0; i < 20; i++) {
    if (!isProcessAlive(pid)) return;
    await sleepMs(100);
  }

  process.stdout.write(`Preview still alive; sending SIGKILL (pid=${pid})...\n`);
  try {
    process.kill(pid, 'SIGKILL');
  } catch (err) {
    throw new Error(`Failed to SIGKILL pid=${pid}: ${String(err)}`);
  }
}

function findListenerPidForPort() {
  const result = spawnSync('ss', ['-ltnp', `sport = :${port}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    // ss is expected to exist in our environment, but if it doesn't, we still
    // can proceed with PID-file-only behavior.
    return null;
  }

  const stdout = result.stdout || '';
  const match = stdout.match(/pid=(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

async function stopExistingPreviewIfAny() {
  // 1) PID file-based stop (fast path)
  if (fs.existsSync(pidFilePath)) {
    const rawPid = fs.readFileSync(pidFilePath, 'utf8').trim();
    const pid = Number(rawPid);
    if (Number.isFinite(pid) && pid > 0) {
      await terminateProcess(pid, 'pid file');
    }
  }

  // 2) Port-based stop (covers cases where PID file is stale/missing)
  const pid = findListenerPidForPort();
  if (pid && pid > 0) {
    await terminateProcess(pid, 'port listener');
  }
}

function runBuild() {
  process.stdout.write('Building (vite build)...\n');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Build failed with exit code ${result.status}`);
  }
}

function startPreview() {
  const viteBin = path.join(repoRoot, 'node_modules', '.bin', 'vite');
  if (!fs.existsSync(viteBin)) {
    throw new Error(`Missing Vite binary at ${viteBin}. Did you run npm install?`);
  }

  fs.mkdirSync(path.dirname(logFilePath), {recursive: true});
  const logFd = fs.openSync(logFilePath, 'a');

  process.stdout.write(`Starting Vite preview on 0.0.0.0:${port}...\n`);
  const child = spawn(
    viteBin,
    ['preview', '--host', '0.0.0.0', '--port', String(port), '--strictPort'],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: process.env,
    },
  );

  child.unref();
  fs.writeFileSync(pidFilePath, `${child.pid}\n`);

  process.stdout.write(`Preview started (pid=${child.pid}). Logs: ${logFilePath}\n`);
}

try {
  await stopExistingPreviewIfAny();
  runBuild();
  startPreview();
} catch (err) {
  process.stderr.write(`${String(err)}\n`);
  process.exitCode = 1;
}
