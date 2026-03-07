import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { exit, platform } from 'node:process';

function run(cmd: string, args: string[]) {
  console.log(`\n▶️  Running: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    // On Windows we need a shell for commands like pnpm and docker compose
    shell: platform === 'win32',
  });

  if (result.status !== 0) {
    console.error(`❌  Step failed with exit code ${result.status}. Aborting.`);
    exit(result.status ?? 1);
  }
}

console.log(
  '\n🛠️  Starting Vector project setup\n----------------------------------',
);

// 1) Install deps
run('pnpm', ['install']);

// 2) Prepare Husky hooks & other post-install tasks
run('pnpm', ['run', 'prepare']);

const envStatus = existsSync('.env.local')
  ? '.env.local already exists.'
  : 'Create one with: cp sample.env .env.local';

console.log('\n✅  Project setup complete.\n');
console.log('Next steps:');
console.log(`- ${envStatus}`);
console.log('- Update your local auth and Convex environment variables.');
console.log('- Start Convex: pnpm run convex:dev');
console.log('- Start Next.js: pnpm run dev\n');
