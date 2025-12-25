import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { GitWorktree, WorktreeCreateOptions, WorktreeRemoveOptions } from '@shared/types';
import simpleGit, { type SimpleGit } from 'simple-git';

const execAsync = promisify(exec);

/**
 * Kill processes that have their working directory under the specified path (Windows only)
 */
async function killProcessesInDirectory(dirPath: string): Promise<void> {
  if (process.platform !== 'win32') return;

  try {
    // Use PowerShell to find and kill node.exe processes with working directory under the path
    const normalizedPath = dirPath.replace(/\//g, '\\');
    const psScript = `
      Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        try {
          $cwd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
          $cwd -like "*${normalizedPath.replace(/\\/g, '\\\\')}*"
        } catch { $false }
      } | Stop-Process -Force -ErrorAction SilentlyContinue
    `;
    await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
  } catch {
    // Ignore errors - process killing is best effort
  }
}

export class WorktreeService {
  private git: SimpleGit;

  constructor(workdir: string) {
    this.git = simpleGit(workdir);
  }

  async list(): Promise<GitWorktree[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: GitWorktree[] = [];
    let current: Partial<GitWorktree> = {};

    for (const line of result.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as GitWorktree);
        }
        current = {
          path: line.substring(9),
          isMainWorktree: false,
          isLocked: false,
          prunable: false,
        };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.isMainWorktree = true;
      } else if (line === 'locked') {
        current.isLocked = true;
      } else if (line === 'prunable') {
        current.prunable = true;
      }
    }

    if (current.path) {
      worktrees.push(current as GitWorktree);
    }

    // Mark first worktree as main
    if (worktrees.length > 0) {
      worktrees[0].isMainWorktree = true;
    }

    return worktrees;
  }

  async add(options: WorktreeCreateOptions): Promise<void> {
    const args = ['worktree', 'add'];

    if (options.newBranch) {
      args.push('-b', options.newBranch);
    }

    args.push(options.path);

    if (options.branch) {
      args.push(options.branch);
    }

    await this.git.raw(args);
  }

  async remove(options: WorktreeRemoveOptions): Promise<void> {
    // Prune stale worktree entries first
    await this.prune();

    const args = ['worktree', 'remove'];
    if (options.force) {
      args.push('--force');
    }
    args.push(options.path);

    try {
      await this.git.raw(args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle "Permission denied" or "not a working tree" errors
      const isPermissionDenied = errorMessage.includes('Permission denied');
      const isNotWorktree = errorMessage.includes('is not a working tree');

      if (isPermissionDenied || isNotWorktree) {
        // Try to clean up the directory manually
        if (existsSync(options.path)) {
          // First attempt: try to kill processes using the directory
          await killProcessesInDirectory(options.path);

          // Wait a bit for processes to terminate
          await new Promise((resolve) => setTimeout(resolve, 500));

          try {
            if (process.platform === 'win32') {
              // Use Windows rmdir which can be more effective for locked files
              await execAsync(`rmdir /s /q "${options.path}"`);
            } else {
              await rm(options.path, { recursive: true, force: true });
            }
          } catch (rmError) {
            // If manual deletion also fails, throw a more helpful error
            throw new Error(
              `Failed to remove worktree directory: ${options.path}. ` +
                `Please close any programs using this directory and try again.`
            );
          }
        }
        // Prune again to clean up any stale entries
        await this.prune();
      } else {
        throw error;
      }
    }

    // Delete branch if requested
    if (options.deleteBranch && options.branch) {
      try {
        await this.git.raw(['branch', '-D', options.branch]);
      } catch {
        // Ignore branch deletion errors (branch may not exist or be in use)
      }
    }
  }

  async prune(): Promise<void> {
    await this.git.raw(['worktree', 'prune']);
  }
}
