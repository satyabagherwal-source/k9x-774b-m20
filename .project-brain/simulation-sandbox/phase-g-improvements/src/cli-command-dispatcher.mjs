/**
 * Phase G Improvement 1: Reusable CLI Command Dispatcher
 * Affects: Domain H (Technical Construction) & Domain I (Content & Information)
 * 
 * Provides a modular, zero-dependency command line dispatcher with:
 * - Subcommand registration and metadata specification
 * - Automated --help / -h documentation generation
 * - Typed option parsing (--flag, --opt <val>, -f)
 * - Positional argument bounds checking
 * - Standardized exit-code contracts (0: Success, 1: Execution Error, 2: Usage Error)
 */

export class CliCommandDispatcher {
  constructor({ programName, version, description }) {
    this.programName = programName || 'cli';
    this.version = version || '1.0.0';
    this.description = description || '';
    this.commands = new Map();
  }

  registerCommand({ name, description, usage, minArgs = 0, options = [], handler }) {
    if (!name || typeof handler !== 'function') {
      throw new Error(`Invalid command registration: "name" and "handler" function are required.`);
    }
    this.commands.set(name, {
      name,
      description: description || '',
      usage: usage || `${this.programName} ${name}`,
      minArgs,
      options,
      handler
    });
    return this;
  }

  generateHelpText() {
    const lines = [];
    lines.push(`${this.programName} v${this.version} — ${this.description}\n`);
    lines.push('USAGE:');
    lines.push(`  ${this.programName} <command> [arguments] [options]\n`);
    lines.push('COMMANDS:');

    for (const [name, cmd] of this.commands.entries()) {
      lines.push(`  ${name.padEnd(20)} ${cmd.description}`);
      if (cmd.usage) {
        lines.push(`    Usage: ${cmd.usage}`);
      }
      if (cmd.options && cmd.options.length > 0) {
        lines.push('    Options:');
        for (const opt of cmd.options) {
          lines.push(`      ${opt.flag.padEnd(16)} ${opt.description || ''}`);
        }
      }
      lines.push('');
    }

    lines.push('GLOBAL OPTIONS:');
    lines.push('  --help, -h          Display this help manual');
    lines.push('  --version, -v       Display version');
    lines.push('\nEXIT CODES:');
    lines.push('  0   Success');
    lines.push('  1   Command execution or validation error');
    lines.push('  2   Usage syntax error or unknown command\n');

    return lines.join('\n');
  }

  parseArgs(rawArgs) {
    const commandName = rawArgs[0];
    const rest = rawArgs.slice(1);
    const options = {};
    const positional = [];

    for (let i = 0; i < rest.length; i++) {
      const item = rest[i];
      if (item.startsWith('--')) {
        const key = item.slice(2);
        if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
          options[key] = rest[i + 1];
          i++;
        } else {
          options[key] = true;
        }
      } else if (item.startsWith('-') && item.length === 2) {
        const key = item.slice(1);
        if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
          options[key] = rest[i + 1];
          i++;
        } else {
          options[key] = true;
        }
      } else {
        positional.push(item);
      }
    }

    return { commandName, positional, options };
  }

  async dispatch(rawArgs = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr } = {}) {
    const { commandName, positional, options } = this.parseArgs(rawArgs);

    if (!commandName || commandName === 'help' || commandName === '--help' || commandName === '-h') {
      stdout.write(this.generateHelpText());
      return 0;
    }

    if (commandName === 'version' || commandName === '--version' || commandName === '-v') {
      stdout.write(`${this.programName} v${this.version}\n`);
      return 0;
    }

    const cmd = this.commands.get(commandName);
    if (!cmd) {
      stderr.write(`Unknown command: "${commandName}". Run "${this.programName} --help" for available commands.\n`);
      return 2;
    }

    if (positional.length < cmd.minArgs) {
      stderr.write(`Usage Error: Command "${commandName}" requires at least ${cmd.minArgs} positional argument(s).\nUsage: ${cmd.usage}\n`);
      return 2;
    }

    try {
      const exitCode = await cmd.handler({ positional, options, stdout, stderr });
      return typeof exitCode === 'number' ? exitCode : 0;
    } catch (err) {
      stderr.write(`Error: ${err.message}\n`);
      return 1;
    }
  }
}

