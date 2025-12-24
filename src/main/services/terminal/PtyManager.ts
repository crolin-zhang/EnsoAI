import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { TerminalCreateOptions } from '@shared/types';
import * as pty from 'node-pty-prebuilt-multiarch';
import { detectShell } from './ShellDetector';

const isWindows = process.platform === 'win32';

interface PtySession {
  pty: pty.IPty;
  onData: (data: string) => void;
  onExit?: (exitCode: number, signal?: number) => void;
}

// GUI apps don't inherit shell PATH, add common paths
function getEnhancedPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || homedir();
  const currentPath = process.env.PATH || '';

  if (isWindows) {
    // Windows: Add common Node.js paths
    const additionalPaths = [
      join(home, 'AppData', 'Roaming', 'npm'),
      join(home, '.volta', 'bin'),
      join(home, 'scoop', 'shims'),
    ];
    const allPaths = [...new Set([...additionalPaths, ...currentPath.split(delimiter)])];
    return allPaths.join(delimiter);
  }

  // Unix: Add common paths
  const additionalPaths = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    join(home, '.nvm', 'versions', 'node', 'current', 'bin'),
    join(home, '.npm-global', 'bin'),
    join(home, '.local', 'bin'),
  ];
  const allPaths = [...new Set([...additionalPaths, ...currentPath.split(delimiter)])];
  return allPaths.join(delimiter);
}

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private counter = 0;

  create(
    options: TerminalCreateOptions,
    onData: (data: string) => void,
    onExit?: (exitCode: number, signal?: number) => void
  ): string {
    const id = `pty-${++this.counter}`;
    const shell = options.shell || detectShell();
    const home = process.env.HOME || process.env.USERPROFILE || homedir();
    const cwd = options.cwd || home;

    const args = options.args || [];

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd,
      env: {
        ...process.env,
        ...options.env,
        PATH: getEnhancedPath(),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    });

    ptyProcess.onData((data) => {
      onData(data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(id);
      onExit?.(exitCode, signal);
    });

    this.sessions.set(id, { pty: ptyProcess, onData, onExit });

    return id;
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.kill();
      this.sessions.delete(id);
    }
  }

  destroyAll(): void {
    for (const id of this.sessions.keys()) {
      this.destroy(id);
    }
  }
}
