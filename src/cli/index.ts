#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import { api } from '../../convex/_generated/api';
import {
  fetchAuthSession,
  loginWithPassword,
  logout,
  prompt,
  promptSecret,
} from './auth';
import { createConvexClient, runAction, runMutation, runQuery } from './convex';
import { printOutput } from './output';
import {
  clearSession,
  createEmptySession,
  readSession,
  writeSession,
  type CliSession,
} from './session';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

type GlobalOptions = {
  appUrl?: string;
  convexUrl?: string;
  json?: boolean;
  org?: string;
  profile?: string;
};

type Runtime = {
  appUrl: string;
  convexUrl: string;
  json: boolean;
  org?: string;
  profile: string;
  session: CliSession | null;
};

function requiredString(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function normalizeMatch(value: string | undefined | null) {
  return value?.trim().toLowerCase();
}

async function getRuntime(command: Command) {
  const options = command.optsWithGlobals<GlobalOptions>();
  const profile = options.profile ?? 'default';
  const session = await readSession(profile);
  const appUrl =
    options.appUrl ??
    session?.appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';
  const convexUrl =
    options.convexUrl ??
    session?.convexUrl ??
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.CONVEX_URL ??
    'http://127.0.0.1:3210';

  return {
    appUrl,
    convexUrl,
    json: Boolean(options.json),
    org: options.org ?? session?.activeOrgSlug,
    profile,
    session,
  } satisfies Runtime;
}

function requireSession(runtime: Runtime) {
  if (!runtime.session || Object.keys(runtime.session.cookies).length === 0) {
    throw new Error('Not logged in. Run `vector auth login` first.');
  }
  return runtime.session;
}

function requireOrg(runtime: Runtime, explicit?: string) {
  const orgSlug = explicit ?? runtime.org;
  if (!orgSlug) {
    throw new Error(
      'Organization slug is required. Pass `--org <slug>` or run `vector org use <slug>`.',
    );
  }
  return orgSlug;
}

async function getClient(command: Command) {
  const runtime = await getRuntime(command);
  const session = requireSession(runtime);
  const client = await createConvexClient(
    session,
    runtime.appUrl,
    runtime.convexUrl,
  );
  return { client, runtime, session };
}

async function resolveMemberId(
  client: Awaited<ReturnType<typeof createConvexClient>>,
  orgSlug: string,
  ref: string,
) {
  const members = await runQuery(
    client,
    api.organizations.queries.listMembers,
    {
      orgSlug,
    },
  );
  const needle = normalizeMatch(ref);
  const matches = members.filter(member => {
    const user = member.user;
    if (!user) return false;
    return (
      normalizeMatch(String(user._id)) === needle ||
      normalizeMatch(user.email) === needle ||
      normalizeMatch(user.name) === needle ||
      normalizeMatch(user.username) === needle
    );
  });

  if (matches.length === 0) {
    throw new Error(`No member matched "${ref}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple members matched "${ref}"`);
  }
  return String(matches[0]!.user!._id);
}

async function resolveRoleId(
  client: Awaited<ReturnType<typeof createConvexClient>>,
  orgSlug: string,
  ref: string,
) {
  const roles = await runQuery(client, api.roles.list, { orgSlug });
  const needle = normalizeMatch(ref);
  const matches = roles.filter(role => {
    const candidate = role as { _id: string; name?: string; key?: string };
    return (
      normalizeMatch(String(candidate._id)) === needle ||
      normalizeMatch(candidate.name) === needle ||
      normalizeMatch(candidate.key) === needle
    );
  });

  if (matches.length === 0) {
    throw new Error(`No role matched "${ref}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple roles matched "${ref}"`);
  }
  return String((matches[0] as { _id: string })._id);
}

function nullableOption(value: string | undefined, clear = false) {
  if (clear) return null;
  return value;
}

const program = new Command();

program
  .name('vector')
  .description('Vector CLI')
  .showHelpAfterError()
  .option('--app-url <url>', 'Vector app URL')
  .option('--convex-url <url>', 'Convex deployment URL')
  .option('--org <slug>', 'Organization slug override')
  .option('--profile <name>', 'CLI profile name', 'default')
  .option('--json', 'Output JSON');

const authCommand = program.command('auth').description('Authentication');

authCommand
  .command('login [identifier]')
  .option('--password <password>', 'Password')
  .action(async (identifier, options, command) => {
    const runtime = await getRuntime(command);
    const loginId = identifier?.trim() || (await prompt('Email or username: '));
    const password =
      options.password?.trim() || (await promptSecret('Password: '));
    let session = createEmptySession();
    session.appUrl = runtime.appUrl;
    session.convexUrl = runtime.convexUrl;

    session = await loginWithPassword(
      session,
      runtime.appUrl,
      loginId,
      password,
    );
    const authState = await fetchAuthSession(session, runtime.appUrl);
    session = authState.session;

    const client = await createConvexClient(
      session,
      runtime.appUrl,
      runtime.convexUrl,
    );
    const orgs = await runQuery(client, api.users.getOrganizations, {});
    session.activeOrgSlug = orgs[0]?.slug ?? session.activeOrgSlug;

    await writeSession(session, runtime.profile);
    printOutput(
      {
        loggedInAs:
          authState.user?.email ??
          authState.user?.username ??
          authState.user?.name,
        activeOrgSlug: session.activeOrgSlug ?? null,
      },
      runtime.json,
    );
  });

authCommand.command('logout').action(async (_options, command) => {
  const runtime = await getRuntime(command);
  const session = requireSession(runtime);
  await logout(session, runtime.appUrl);
  await clearSession(runtime.profile);
  printOutput({ success: true }, runtime.json);
});

authCommand.command('whoami').action(async (_options, command) => {
  const { client, runtime } = await getClient(command);
  const [user, orgs] = await Promise.all([
    runQuery(client, api.users.getCurrentUser, {}),
    runQuery(client, api.users.getOrganizations, {}),
  ]);
  printOutput(
    {
      user,
      organizations: orgs,
      activeOrgSlug: runtime.org ?? null,
    },
    runtime.json,
  );
});

const orgCommand = program.command('org').description('Organizations');

orgCommand.command('list').action(async (_options, command) => {
  const { client, runtime } = await getClient(command);
  const orgs = await runQuery(client, api.users.getOrganizations, {});
  printOutput(orgs, runtime.json);
});

orgCommand.command('current').action(async (_options, command) => {
  const runtime = await getRuntime(command);
  printOutput({ activeOrgSlug: runtime.org ?? null }, runtime.json);
});

orgCommand.command('use <slug>').action(async (slug, _options, command) => {
  const runtime = await getRuntime(command);
  const session = requireSession(runtime);
  session.activeOrgSlug = slug;
  session.appUrl = runtime.appUrl;
  session.convexUrl = runtime.convexUrl;
  await writeSession(session, runtime.profile);
  printOutput({ activeOrgSlug: slug }, runtime.json);
});

orgCommand
  .command('create')
  .requiredOption('--name <name>')
  .requiredOption('--slug <slug>')
  .action(async (options, command) => {
    const { client, runtime, session } = await getClient(command);
    const result = await runMutation(
      client,
      api.organizations.mutations.create,
      {
        data: {
          name: options.name,
          slug: options.slug,
        },
      },
    );
    if (session) {
      session.activeOrgSlug = options.slug;
      session.appUrl = runtime.appUrl;
      session.convexUrl = runtime.convexUrl;
      await writeSession(session, runtime.profile);
    }
    printOutput(result, runtime.json);
  });

orgCommand
  .command('update [slug]')
  .option('--name <name>')
  .option('--new-slug <slug>')
  .action(async (slug, options, command) => {
    const { client, runtime, session } = await getClient(command);
    const orgSlug = requireOrg(runtime, slug);
    const result = await runMutation(
      client,
      api.organizations.mutations.update,
      {
        orgSlug,
        data: {
          ...(options.name ? { name: options.name } : {}),
          ...(options.newSlug ? { slug: options.newSlug } : {}),
        },
      },
    );
    if (session && options.newSlug && session.activeOrgSlug === orgSlug) {
      session.activeOrgSlug = options.newSlug;
      await writeSession(session, runtime.profile);
    }
    printOutput(result, runtime.json);
  });

orgCommand.command('members [slug]').action(async (slug, _options, command) => {
  const { client, runtime } = await getClient(command);
  const orgSlug = requireOrg(runtime, slug);
  const members = await runQuery(
    client,
    api.organizations.queries.listMembers,
    {
      orgSlug,
    },
  );
  printOutput(members, runtime.json);
});

orgCommand.command('invites [slug]').action(async (slug, _options, command) => {
  const { client, runtime } = await getClient(command);
  const orgSlug = requireOrg(runtime, slug);
  const invites = await runQuery(
    client,
    api.organizations.queries.listInvites,
    {
      orgSlug,
    },
  );
  printOutput(invites, runtime.json);
});

orgCommand
  .command('invite [slug]')
  .requiredOption('--email <email>')
  .option('--role <role>', 'member or admin', 'member')
  .action(async (slug, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime, slug);
    const result = await runMutation(
      client,
      api.organizations.mutations.invite,
      {
        orgSlug,
        email: options.email,
        role: options.role,
      },
    );
    printOutput(result, runtime.json);
  });

orgCommand
  .command('member-role <member>')
  .requiredOption('--role <role>', 'member or admin')
  .action(async (member, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const userId = await resolveMemberId(client, orgSlug, member);
    const result = await runMutation(
      client,
      api.organizations.mutations.updateMemberRole,
      {
        orgSlug,
        userId: userId as any,
        role: options.role,
      },
    );
    printOutput(result, runtime.json);
  });

orgCommand
  .command('remove-member <member>')
  .action(async (member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const userId = await resolveMemberId(client, orgSlug, member);
    const result = await runMutation(
      client,
      api.organizations.mutations.removeMember,
      {
        orgSlug,
        userId: userId as any,
      },
    );
    printOutput(result ?? { success: true }, runtime.json);
  });

const roleCommand = program.command('role').description('Organization roles');

roleCommand.command('list [slug]').action(async (slug, _options, command) => {
  const { client, runtime } = await getClient(command);
  const orgSlug = requireOrg(runtime, slug);
  const roles = await runQuery(client, api.roles.list, { orgSlug });
  printOutput(roles, runtime.json);
});

roleCommand.command('get <role>').action(async (role, _options, command) => {
  const { client, runtime } = await getClient(command);
  const orgSlug = requireOrg(runtime);
  const roleId = await resolveRoleId(client, orgSlug, role);
  const [summary, permissions] = await Promise.all([
    runQuery(client, api.roles.get, { orgSlug, roleId }),
    runQuery(client, api.roles.getPermissions, { roleId }),
  ]);
  printOutput({ summary, permissions }, runtime.json);
});

roleCommand
  .command('create')
  .requiredOption('--name <name>')
  .requiredOption('--permissions <permissions>', 'Comma-separated permissions')
  .option('--description <description>')
  .action(async (options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runMutation(client, api.roles.create, {
      orgSlug,
      name: options.name,
      description: options.description,
      permissions: options.permissions
        .split(',')
        .map((value: string) => value.trim())
        .filter(Boolean),
    });
    printOutput({ roleId: result }, runtime.json);
  });

roleCommand
  .command('update <role>')
  .requiredOption('--name <name>')
  .requiredOption('--permissions <permissions>', 'Comma-separated permissions')
  .option('--description <description>')
  .action(async (role, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const roleId = await resolveRoleId(client, orgSlug, role);
    const result = await runMutation(client, api.roles.update, {
      orgSlug,
      roleId,
      name: options.name,
      description: options.description,
      permissions: options.permissions
        .split(',')
        .map((value: string) => value.trim())
        .filter(Boolean),
    });
    printOutput(result ?? { success: true }, runtime.json);
  });

roleCommand
  .command('assign <role> <member>')
  .action(async (role, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const [roleId, userId] = await Promise.all([
      resolveRoleId(client, orgSlug, role),
      resolveMemberId(client, orgSlug, member),
    ]);
    const result = await runMutation(client, api.roles.assign, {
      orgSlug,
      roleId,
      userId: userId as any,
    });
    printOutput({ assignmentId: result }, runtime.json);
  });

roleCommand
  .command('unassign <role> <member>')
  .action(async (role, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const [roleId, userId] = await Promise.all([
      resolveRoleId(client, orgSlug, role),
      resolveMemberId(client, orgSlug, member),
    ]);
    const result = await runMutation(client, api.roles.removeAssignment, {
      orgSlug,
      roleId,
      userId: userId as any,
    });
    printOutput(result ?? { success: true }, runtime.json);
  });

program.command('refdata [slug]').action(async (slug, _options, command) => {
  const { client, runtime } = await getClient(command);
  const orgSlug = requireOrg(runtime, slug);
  const result = await runAction(client, api.cli.listWorkspaceReferenceData, {
    orgSlug,
  });
  printOutput(result, runtime.json);
});

program
  .command('icons <query>')
  .option('--limit <n>')
  .action(async (query, options, command) => {
    const { client, runtime } = await getClient(command);
    const result = await runAction(client, api.cli.searchIcons, {
      query,
      limit: options.limit ? Number(options.limit) : undefined,
    });
    printOutput(result, runtime.json);
  });

const teamCommand = program.command('team').description('Teams');

teamCommand
  .command('list [slug]')
  .option('--limit <n>')
  .action(async (slug, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime, slug);
    const result = await runAction(client, api.cli.listTeams, {
      orgSlug,
      limit: options.limit ? Number(options.limit) : undefined,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('get <teamKey>')
  .action(async (teamKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.getTeam, {
      orgSlug,
      teamKey,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('create')
  .requiredOption('--key <key>')
  .requiredOption('--name <name>')
  .option('--description <description>')
  .option('--visibility <visibility>')
  .option('--icon <icon>')
  .option('--color <color>')
  .action(async (options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.createTeam, {
      orgSlug,
      key: options.key,
      name: options.name,
      description: options.description,
      visibility: options.visibility,
      icon: options.icon,
      color: options.color,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('update <teamKey>')
  .option('--name <name>')
  .option('--description <description>')
  .option('--clear-description')
  .option('--visibility <visibility>')
  .option('--icon <icon>')
  .option('--clear-icon')
  .option('--color <color>')
  .option('--clear-color')
  .action(async (teamKey, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.updateTeam, {
      orgSlug,
      teamKey,
      name: options.name,
      description: nullableOption(
        options.description,
        options.clearDescription,
      ),
      visibility: options.visibility,
      icon: nullableOption(options.icon, options.clearIcon),
      color: nullableOption(options.color, options.clearColor),
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('delete <teamKey>')
  .action(async (teamKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.deleteTeam, {
      orgSlug,
      teamKey,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('members <teamKey>')
  .action(async (teamKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const team = await runAction(client, api.cli.getTeam, { orgSlug, teamKey });
    const result = await runQuery(client, api.teams.queries.listMembers, {
      teamId: team.id as any,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('add-member <teamKey> <member>')
  .option('--role <role>', 'member or lead', 'member')
  .action(async (teamKey, member, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.addTeamMember, {
      orgSlug,
      teamKey,
      memberName: member,
      role: options.role,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('remove-member <teamKey> <member>')
  .action(async (teamKey, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.removeTeamMember, {
      orgSlug,
      teamKey,
      memberName: member,
    });
    printOutput(result, runtime.json);
  });

teamCommand
  .command('set-lead <teamKey> <member>')
  .action(async (teamKey, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const leadName = member === 'null' ? null : member;
    const result = await runAction(client, api.cli.changeTeamLead, {
      orgSlug,
      teamKey,
      leadName,
    });
    printOutput(result, runtime.json);
  });

const projectCommand = program.command('project').description('Projects');

projectCommand
  .command('list [slug]')
  .option('--team <teamKey>')
  .option('--limit <n>')
  .action(async (slug, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime, slug);
    const result = await runAction(client, api.cli.listProjects, {
      orgSlug,
      teamKey: options.team,
      limit: options.limit ? Number(options.limit) : undefined,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('get <projectKey>')
  .action(async (projectKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.getProject, {
      orgSlug,
      projectKey,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('create')
  .requiredOption('--key <key>')
  .requiredOption('--name <name>')
  .option('--description <description>')
  .option('--team <teamKey>')
  .option('--status <statusName>')
  .option('--visibility <visibility>')
  .option('--icon <icon>')
  .option('--color <color>')
  .action(async (options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.createProject, {
      orgSlug,
      key: options.key,
      name: options.name,
      description: options.description,
      teamKey: options.team,
      statusName: options.status,
      visibility: options.visibility,
      icon: options.icon,
      color: options.color,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('update <projectKey>')
  .option('--name <name>')
  .option('--description <description>')
  .option('--team <teamKey>')
  .option('--clear-team')
  .option('--status <statusName>')
  .option('--clear-status')
  .option('--visibility <visibility>')
  .option('--start-date <date>')
  .option('--clear-start-date')
  .option('--due-date <date>')
  .option('--clear-due-date')
  .option('--icon <icon>')
  .option('--clear-icon')
  .option('--color <color>')
  .option('--clear-color')
  .action(async (projectKey, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.updateProject, {
      orgSlug,
      projectKey,
      name: options.name,
      description: options.description,
      teamKey: nullableOption(options.team, options.clearTeam),
      statusName: nullableOption(options.status, options.clearStatus),
      visibility: options.visibility,
      startDate: nullableOption(options.startDate, options.clearStartDate),
      dueDate: nullableOption(options.dueDate, options.clearDueDate),
      icon: nullableOption(options.icon, options.clearIcon),
      color: nullableOption(options.color, options.clearColor),
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('delete <projectKey>')
  .action(async (projectKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.deleteProject, {
      orgSlug,
      projectKey,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('members <projectKey>')
  .action(async (projectKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const project = await runAction(client, api.cli.getProject, {
      orgSlug,
      projectKey,
    });
    const result = await runQuery(client, api.projects.queries.listMembers, {
      projectId: project.id as any,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('add-member <projectKey> <member>')
  .option('--role <role>', 'member or lead', 'member')
  .action(async (projectKey, member, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.addProjectMember, {
      orgSlug,
      projectKey,
      memberName: member,
      role: options.role,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('remove-member <projectKey> <member>')
  .action(async (projectKey, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.removeProjectMember, {
      orgSlug,
      projectKey,
      memberName: member,
    });
    printOutput(result, runtime.json);
  });

projectCommand
  .command('set-lead <projectKey> <member>')
  .action(async (projectKey, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const leadName = member === 'null' ? null : member;
    const result = await runAction(client, api.cli.changeProjectLead, {
      orgSlug,
      projectKey,
      leadName,
    });
    printOutput(result, runtime.json);
  });

const issueCommand = program.command('issue').description('Issues');

issueCommand
  .command('list [slug]')
  .option('--project <projectKey>')
  .option('--team <teamKey>')
  .option('--limit <n>')
  .action(async (slug, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime, slug);
    const result = await runAction(client, api.cli.listIssues, {
      orgSlug,
      projectKey: options.project,
      teamKey: options.team,
      limit: options.limit ? Number(options.limit) : undefined,
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('get <issueKey>')
  .action(async (issueKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.getIssue, {
      orgSlug,
      issueKey,
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('create')
  .requiredOption('--title <title>')
  .option('--description <description>')
  .option('--project <projectKey>')
  .option('--team <teamKey>')
  .option('--priority <priorityName>')
  .option('--visibility <visibility>')
  .option('--assignee <member>')
  .option('--state <stateName>')
  .option('--start-date <date>')
  .option('--due-date <date>')
  .option('--parent <issueKey>')
  .action(async (options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.createIssue, {
      orgSlug,
      title: options.title,
      description: options.description,
      projectKey: options.project,
      teamKey: options.team,
      priorityName: options.priority,
      visibility: options.visibility,
      assigneeName: options.assignee,
      stateName: options.state,
      startDate: options.startDate,
      dueDate: options.dueDate,
      parentIssueKey: options.parent,
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('update <issueKey>')
  .option('--title <title>')
  .option('--description <description>')
  .option('--priority <priorityName>')
  .option('--clear-priority')
  .option('--team <teamKey>')
  .option('--clear-team')
  .option('--project <projectKey>')
  .option('--clear-project')
  .option('--visibility <visibility>')
  .option('--assignee <member>')
  .option('--clear-assignee')
  .option('--state <stateName>')
  .option('--start-date <date>')
  .option('--clear-start-date')
  .option('--due-date <date>')
  .option('--clear-due-date')
  .option('--parent <issueKey>')
  .option('--clear-parent')
  .action(async (issueKey, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.updateIssue, {
      orgSlug,
      issueKey,
      title: options.title,
      description: options.description,
      priorityName: nullableOption(options.priority, options.clearPriority),
      teamKey: nullableOption(options.team, options.clearTeam),
      projectKey: nullableOption(options.project, options.clearProject),
      visibility: options.visibility,
      assigneeName: nullableOption(options.assignee, options.clearAssignee),
      stateName: options.state,
      startDate: nullableOption(options.startDate, options.clearStartDate),
      dueDate: nullableOption(options.dueDate, options.clearDueDate),
      parentIssueKey: nullableOption(options.parent, options.clearParent),
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('delete <issueKey>')
  .action(async (issueKey, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.deleteIssue, {
      orgSlug,
      issueKey,
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('assign <issueKey> <member>')
  .option('--state <stateName>')
  .action(async (issueKey, member, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.assignIssue, {
      orgSlug,
      issueKey,
      assigneeName: member,
      stateName: options.state,
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('unassign <issueKey> <member>')
  .action(async (issueKey, member, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.unassignIssue, {
      orgSlug,
      issueKey,
      assigneeName: member,
    });
    printOutput(result, runtime.json);
  });

issueCommand
  .command('comment <issueKey>')
  .requiredOption('--body <body>')
  .action(async (issueKey, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const issue = await runAction(client, api.cli.getIssue, {
      orgSlug,
      issueKey,
    });
    const result = await runMutation(client, api.issues.mutations.addComment, {
      issueId: issue.id as any,
      body: options.body,
    });
    printOutput(result, runtime.json);
  });

const documentCommand = program.command('document').description('Documents');

documentCommand
  .command('list [slug]')
  .option('--folder-id <id>')
  .option('--limit <n>')
  .action(async (slug, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime, slug);
    const result = await runAction(client, api.cli.listDocuments, {
      orgSlug,
      folderId: options.folderId,
      limit: options.limit ? Number(options.limit) : undefined,
    });
    printOutput(result, runtime.json);
  });

documentCommand
  .command('get <documentId>')
  .action(async (documentId, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.getDocument, {
      orgSlug,
      documentId,
    });
    printOutput(result, runtime.json);
  });

documentCommand
  .command('create')
  .requiredOption('--title <title>')
  .option('--content <content>')
  .option('--team <teamKey>')
  .option('--project <projectKey>')
  .option('--folder-id <id>')
  .option('--visibility <visibility>')
  .option('--icon <icon>')
  .option('--color <color>')
  .action(async (options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.createDocument, {
      orgSlug,
      title: options.title,
      content: options.content,
      teamKey: options.team,
      projectKey: options.project,
      folderId: options.folderId,
      visibility: options.visibility,
      icon: options.icon,
      color: options.color,
    });
    printOutput(result, runtime.json);
  });

documentCommand
  .command('update <documentId>')
  .option('--title <title>')
  .option('--content <content>')
  .option('--team <teamKey>')
  .option('--clear-team')
  .option('--project <projectKey>')
  .option('--clear-project')
  .option('--folder-id <id>')
  .option('--clear-folder')
  .option('--visibility <visibility>')
  .option('--icon <icon>')
  .option('--clear-icon')
  .option('--color <color>')
  .option('--clear-color')
  .action(async (documentId, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.updateDocument, {
      orgSlug,
      documentId,
      title: options.title,
      content: options.content,
      teamKey: nullableOption(options.team, options.clearTeam),
      projectKey: nullableOption(options.project, options.clearProject),
      folderId: nullableOption(options.folderId, options.clearFolder),
      visibility: options.visibility,
      icon: nullableOption(options.icon, options.clearIcon),
      color: nullableOption(options.color, options.clearColor),
    });
    printOutput(result, runtime.json);
  });

documentCommand
  .command('move <documentId>')
  .option('--folder-id <id>')
  .option('--clear-folder')
  .action(async (documentId, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const folderId = options.clearFolder
      ? null
      : requiredString(options.folderId, 'folder-id');
    const result = await runAction(client, api.cli.moveDocumentToFolder, {
      orgSlug,
      documentId,
      folderId,
    });
    printOutput(result, runtime.json);
  });

documentCommand
  .command('delete <documentId>')
  .action(async (documentId, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.deleteDocument, {
      orgSlug,
      documentId,
    });
    printOutput(result, runtime.json);
  });

const folderCommand = program.command('folder').description('Document folders');

folderCommand.command('list [slug]').action(async (slug, _options, command) => {
  const { client, runtime } = await getClient(command);
  const orgSlug = requireOrg(runtime, slug);
  const result = await runAction(client, api.cli.listFolders, { orgSlug });
  printOutput(result, runtime.json);
});

folderCommand
  .command('create')
  .requiredOption('--name <name>')
  .option('--description <description>')
  .option('--icon <icon>')
  .option('--color <color>')
  .action(async (options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.createFolder, {
      orgSlug,
      name: options.name,
      description: options.description,
      icon: options.icon,
      color: options.color,
    });
    printOutput(result, runtime.json);
  });

folderCommand
  .command('update <folderId>')
  .option('--name <name>')
  .option('--description <description>')
  .option('--clear-description')
  .option('--icon <icon>')
  .option('--clear-icon')
  .option('--color <color>')
  .option('--clear-color')
  .action(async (folderId, options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.updateFolder, {
      orgSlug,
      folderId,
      name: options.name,
      description: nullableOption(
        options.description,
        options.clearDescription,
      ),
      icon: nullableOption(options.icon, options.clearIcon),
      color: nullableOption(options.color, options.clearColor),
    });
    printOutput(result, runtime.json);
  });

folderCommand
  .command('delete <folderId>')
  .action(async (folderId, _options, command) => {
    const { client, runtime } = await getClient(command);
    const orgSlug = requireOrg(runtime);
    const result = await runAction(client, api.cli.deleteFolder, {
      orgSlug,
      folderId,
    });
    printOutput(result, runtime.json);
  });

async function main() {
  await program.parseAsync(process.argv);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
