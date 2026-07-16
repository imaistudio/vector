import { createPrivateKey, sign } from 'node:crypto';

const API_BASE_URL = 'https://api.appstoreconnect.apple.com';
const INTERNAL_AVAILABLE_STATES = new Set(['IN_BETA_TESTING']);
const EXTERNAL_AVAILABLE_STATES = new Set(['IN_BETA_TESTING']);
const REVIEW_PENDING_STATES = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW']);
const EXTERNAL_REVIEW_PENDING_STATES = new Set([
  'WAITING_FOR_BETA_REVIEW',
  'IN_BETA_REVIEW',
]);
const EXTERNAL_REVIEW_SUBMITTABLE_STATES = new Set([
  'READY_FOR_BETA_SUBMISSION',
  'READY_FOR_REVIEW',
]);
const INTERNAL_ACTIVATION_PENDING_STATES = new Set([
  'PROCESSING',
  'IN_EXPORT_COMPLIANCE_REVIEW',
  'READY_FOR_BETA_TESTING',
]);
const EXTERNAL_ACTIVATION_PENDING_STATES = new Set([
  'PROCESSING',
  'IN_EXPORT_COMPLIANCE_REVIEW',
  'READY_FOR_BETA_SUBMISSION',
  'READY_FOR_BETA_TESTING',
  'BETA_APPROVED',
]);
const TERMINAL_BETA_STATES = new Set([
  'PROCESSING_EXCEPTION',
  'MISSING_EXPORT_COMPLIANCE',
  'EXPIRED',
  'BETA_REJECTED',
  'REJECTED',
  'BUILD_REMOVED',
]);

export const isInternalBuildAvailable = state =>
  INTERNAL_AVAILABLE_STATES.has(state);
export const isExternalBuildAvailable = state =>
  EXTERNAL_AVAILABLE_STATES.has(state);
export const isExternalReviewPending = (externalState, reviewState) =>
  EXTERNAL_REVIEW_PENDING_STATES.has(externalState) ||
  REVIEW_PENDING_STATES.has(reviewState);
export const isInternalActivationPending = state =>
  INTERNAL_ACTIVATION_PENDING_STATES.has(state);
export const isExternalActivationPending = state =>
  EXTERNAL_ACTIVATION_PENDING_STATES.has(state);
export const isTerminalTestFlightState = state =>
  TERMINAL_BETA_STATES.has(state);

export class AppStoreConnectError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'AppStoreConnectError';
    this.status = status;
    this.code = code;
  }
}

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const numberFromEnvironment = (environment, name, fallback, minimum = 0) => {
  const configured = environment[name];
  const rawValue =
    typeof configured === 'string' && configured.trim() === ''
      ? fallback
      : (configured ?? fallback);
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(
      `${name} must be a number greater than or equal to ${minimum}.`,
    );
  }
  return value;
};

const integerFromEnvironment = (environment, name, fallback) => {
  const value = numberFromEnvironment(environment, name, fallback, 1);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
};

const requiredStringFromEnvironment = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const createTokenProvider = ({
  keyContent,
  keyId,
  issuerId,
  clock = Date.now,
}) => {
  const normalizedKey = keyContent.includes('\\n')
    ? keyContent.replaceAll('\\n', '\n')
    : keyContent;
  const privateKey = createPrivateKey(normalizedKey);
  let cachedToken;
  let expiresAt = 0;

  return () => {
    const nowMilliseconds = clock();
    if (cachedToken && nowMilliseconds < expiresAt - 60_000) {
      return cachedToken;
    }

    const now = Math.floor(nowMilliseconds / 1_000);
    const encode = value => Buffer.from(value).toString('base64url');
    const header = encode(
      JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }),
    );
    const payload = encode(
      JSON.stringify({
        iss: issuerId,
        iat: now,
        exp: now + 20 * 60,
        aud: 'appstoreconnect-v1',
      }),
    );
    const signingInput = `${header}.${payload}`;
    const signature = sign('sha256', Buffer.from(signingInput), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');

    cachedToken = `${signingInput}.${signature}`;
    expiresAt = (now + 20 * 60) * 1_000;
    return cachedToken;
  };
};

const appleErrorDetails = async response => {
  try {
    const payload = await response.json();
    const firstError = payload.errors?.[0];
    return {
      code: firstError?.code,
      detail:
        firstError?.detail ?? firstError?.title ?? `HTTP ${response.status}`,
    };
  } catch {
    return { detail: `HTTP ${response.status}` };
  }
};

export const createAppStoreConnectClient = ({
  keyContent,
  keyId,
  issuerId,
  fetchImplementation = fetch,
  wait = sleep,
}) => {
  const token = createTokenProvider({ keyContent, keyId, issuerId });

  const request = async (
    pathOrUrl,
    { method = 'GET', body, expectedStatuses = [200] } = {},
  ) => {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${API_BASE_URL}${pathOrUrl}`;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetchImplementation(url, {
        method,
        headers: {
          Authorization: `Bearer ${token()}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (expectedStatuses.includes(response.status)) {
        return response.status === 204 ? undefined : response.json();
      }

      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter =
          retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
        const delay = Number.isFinite(retryAfter)
          ? Math.min(retryAfter * 1_000, 15_000)
          : Math.min(1_000 * 2 ** (attempt - 1), 15_000);
        await wait(delay);
        continue;
      }

      const error = await appleErrorDetails(response);
      throw new AppStoreConnectError(
        `App Store Connect ${method} request failed (${response.status}): ${error.detail}`,
        { status: response.status, code: error.code },
      );
    }

    throw new Error(
      'App Store Connect request retry loop exited unexpectedly.',
    );
  };

  const listAll = async path => {
    const resources = [];
    let next = path;

    while (next) {
      const response = await request(next);
      resources.push(...(response.data ?? []));
      next = response.links?.next;
    }

    return resources;
  };

  return { request, listAll };
};

export const parseGroupSelector = value => {
  const selector = value?.trim();
  if (!selector || selector === '*') return { mode: 'all', values: [] };
  if (selector.toLowerCase() === 'none') return { mode: 'none', values: [] };

  return {
    mode: 'selected',
    values: selector
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  };
};

const parseGroupSelectorForLane = (value, lane) => {
  const defaultSelector = lane === 'external' ? 'none' : '*';
  return parseGroupSelector(value?.trim() ? value : defaultSelector);
};

export const selectGroups = (groups, selectorValue, lane) => {
  const laneGroups = groups.filter(
    group =>
      Boolean(group.attributes?.isInternalGroup) === (lane === 'internal'),
  );
  const selector = parseGroupSelectorForLane(selectorValue, lane);

  if (selector.mode === 'all') return laneGroups;
  if (selector.mode === 'none') return [];

  const selected = laneGroups.filter(
    group =>
      selector.values.includes(group.id) ||
      selector.values.includes(group.attributes?.name),
  );
  const matched = new Set(
    selected.flatMap(group => [group.id, group.attributes?.name]),
  );
  const missing = selector.values.filter(value => !matched.has(value));

  if (missing.length > 0) {
    throw new Error(
      `Unknown ${lane} TestFlight group selector(s): ${missing.join(', ')}`,
    );
  }

  return selected;
};

const findApp = async (client, bundleId) => {
  const response = await client.request(
    `/v1/apps?filter%5BbundleId%5D=${encodeURIComponent(bundleId)}&limit=2`,
  );
  const app = response.data?.find(
    item => item.attributes?.bundleId === bundleId,
  );
  if (!app) {
    throw new Error(
      `No App Store Connect app found for bundle ID ${bundleId}.`,
    );
  }
  return app;
};

const findBuild = async (client, appId, buildNumber) => {
  const response = await client.request(
    `/v1/builds?filter%5Bapp%5D=${encodeURIComponent(appId)}` +
      `&filter%5Bversion%5D=${encodeURIComponent(buildNumber)}` +
      '&sort=-uploadedDate&limit=2',
  );
  return response.data?.find(item => item.attributes?.version === buildNumber);
};

const waitForValidBuild = async ({
  client,
  appId,
  buildNumber,
  attempts,
  delayMs,
  wait,
}) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const build = await findBuild(client, appId, buildNumber);
    if (!build) {
      console.log(
        `TestFlight build ${buildNumber} is not visible yet (${attempt}/${attempts}).`,
      );
    } else {
      const state = build.attributes?.processingState ?? 'UNKNOWN';
      console.log(
        `TestFlight build ${buildNumber} processing state: ${state} (${attempt}/${attempts}).`,
      );

      if (state === 'VALID') return build;
      if (state === 'FAILED' || state === 'INVALID') {
        throw new Error(
          `TestFlight build ${buildNumber} finished processing with state ${state}.`,
        );
      }
    }

    if (attempt < attempts) await wait(delayMs);
  }

  throw new Error(
    `TestFlight build ${buildNumber} did not become VALID within ${attempts} attempts.`,
  );
};

const groupContainsBuild = async (client, group, buildId) => {
  if (
    group.attributes?.isInternalGroup &&
    group.attributes?.hasAccessToAllBuilds
  ) {
    return true;
  }

  const response = await client.request(
    `/v1/betaGroups?filter%5Bid%5D=${encodeURIComponent(group.id)}` +
      `&filter%5Bbuilds%5D=${encodeURIComponent(buildId)}&limit=1`,
  );
  return response.data?.some(betaGroup => betaGroup.id === group.id) ?? false;
};

const waitForGroupAssociation = async (
  client,
  group,
  buildId,
  wait,
  attempts,
  delayMs,
) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await groupContainsBuild(client, group, buildId)) return true;
    if (attempt < attempts) await wait(delayMs);
  }
  return false;
};

const ensureGroupContainsBuild = async (
  client,
  group,
  buildId,
  wait,
  attempts,
  delayMs,
) => {
  if (await groupContainsBuild(client, group, buildId)) {
    return group.attributes?.hasAccessToAllBuilds
      ? 'automatic'
      : 'already-added';
  }

  try {
    await client.request(
      `/v1/builds/${encodeURIComponent(buildId)}/relationships/betaGroups`,
      {
        method: 'POST',
        expectedStatuses: [204],
        body: { data: [{ type: 'betaGroups', id: group.id }] },
      },
    );
  } catch (error) {
    if (
      !(error instanceof AppStoreConnectError) ||
      (error.status !== 409 && error.status !== 422) ||
      !(await waitForGroupAssociation(
        client,
        group,
        buildId,
        wait,
        attempts,
        delayMs,
      ))
    ) {
      throw error;
    }
  }

  if (
    !(await waitForGroupAssociation(
      client,
      group,
      buildId,
      wait,
      attempts,
      delayMs,
    ))
  ) {
    throw new Error(
      `App Store Connect did not confirm build association for group ${group.attributes?.name ?? group.id}.`,
    );
  }
  return 'added';
};

const getBuildBetaDetail = async (client, buildId) => {
  const response = await client.request(
    `/v1/builds/${encodeURIComponent(buildId)}/buildBetaDetail` +
      '?fields%5BbuildBetaDetails%5D=internalBuildState,externalBuildState',
  );
  return response.data;
};

const getReviewSubmission = async (client, buildId) => {
  const response = await client.request(
    `/v1/betaAppReviewSubmissions?filter%5Bbuild%5D=${encodeURIComponent(buildId)}` +
      '&fields%5BbetaAppReviewSubmissions%5D=betaReviewState,submittedDate&limit=200',
  );
  return (response.data ?? []).sort((left, right) =>
    String(right.attributes?.submittedDate ?? '').localeCompare(
      String(left.attributes?.submittedDate ?? ''),
    ),
  )[0];
};

const createReviewSubmission = async (client, buildId) => {
  const response = await client.request('/v1/betaAppReviewSubmissions', {
    method: 'POST',
    expectedStatuses: [201],
    body: {
      data: {
        type: 'betaAppReviewSubmissions',
        relationships: {
          build: { data: { type: 'builds', id: buildId } },
        },
      },
    },
  });
  return response.data;
};

const createReviewSubmissionIdempotently = async (
  client,
  buildId,
  wait,
  attempts,
  delayMs,
) => {
  try {
    return await createReviewSubmission(client, buildId);
  } catch (error) {
    if (
      !(error instanceof AppStoreConnectError) ||
      (error.status !== 409 && error.status !== 422)
    ) {
      throw error;
    }

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const review = await getReviewSubmission(client, buildId);
      if (review) return review;
      if (attempt < attempts) await wait(delayMs);
    }
    throw error;
  }
};

const failForTerminalBetaState = (
  betaDetail,
  { requireInternal = true, requireExternal = true } = {},
) => {
  const internalState = betaDetail?.attributes?.internalBuildState;
  const externalState = betaDetail?.attributes?.externalBuildState;
  const selectedStates = [
    ...(requireInternal ? [internalState] : []),
    ...(requireExternal ? [externalState] : []),
  ];
  const terminalState = selectedStates.find(state =>
    isTerminalTestFlightState(state),
  );
  if (terminalState) {
    throw new Error(
      `TestFlight distribution cannot continue while the build state is ${terminalState}. Resolve export compliance or the reported App Store Connect issue first.`,
    );
  }
};

const waitForLaneStates = async ({
  client,
  buildId,
  requireInternal,
  requireExternal,
  attempts,
  delayMs,
  wait,
}) => {
  let betaDetail;
  let review;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    betaDetail = await getBuildBetaDetail(client, buildId);
    failForTerminalBetaState(betaDetail, { requireInternal, requireExternal });

    const internalState =
      betaDetail.attributes?.internalBuildState ?? 'UNKNOWN';
    const externalState =
      betaDetail.attributes?.externalBuildState ?? 'UNKNOWN';
    if (requireExternal) {
      review = await getReviewSubmission(client, buildId);
      if (!review && EXTERNAL_REVIEW_SUBMITTABLE_STATES.has(externalState)) {
        review = await createReviewSubmissionIdempotently(
          client,
          buildId,
          wait,
          attempts,
          delayMs,
        );
      }
    }
    const reviewState = review?.attributes?.betaReviewState;
    const internalAvailable =
      !requireInternal || isInternalBuildAvailable(internalState);
    const externalAvailable =
      !requireExternal || isExternalBuildAvailable(externalState);

    console.log(
      `TestFlight lane states: internal=${internalState}, external=${externalState}` +
        `${reviewState ? `, review=${reviewState}` : ''} (${attempt}/${attempts}).`,
    );

    if (internalAvailable && externalAvailable) {
      return {
        betaDetail,
        review,
        internalActivationPending: false,
        externalReviewPending: false,
        externalActivationPending: false,
      };
    }

    if (reviewState === 'REJECTED') {
      throw new Error(
        'Apple rejected this build for Beta App Review. Resolve the review issue before distributing it externally.',
      );
    }

    if (attempt < attempts) await wait(delayMs);
  }

  const reviewState = review?.attributes?.betaReviewState;
  const internalState = betaDetail?.attributes?.internalBuildState;
  const externalState = betaDetail?.attributes?.externalBuildState;
  const internalAvailable =
    !requireInternal || isInternalBuildAvailable(internalState);
  const externalAvailable =
    !requireExternal || isExternalBuildAvailable(externalState);
  const internalActivationPending =
    requireInternal && isInternalActivationPending(internalState);
  const externalReviewPending =
    requireExternal && isExternalReviewPending(externalState, reviewState);
  const externalActivationPending =
    requireExternal && isExternalActivationPending(externalState);

  if (
    (internalAvailable || internalActivationPending) &&
    (externalAvailable || externalReviewPending || externalActivationPending)
  ) {
    return {
      betaDetail,
      review,
      internalActivationPending,
      externalReviewPending,
      externalActivationPending,
    };
  }

  throw new Error(
    'App Store Connect did not confirm that the selected TestFlight lanes are available.',
  );
};

const escapeMarkdown = value =>
  String(value).replaceAll('|', '\\|').replaceAll('`', '\\`');

export const formatTestFlightSummary = result => {
  const reviewState = result.review?.attributes?.betaReviewState;
  const lines = [
    '',
    '## TestFlight distribution',
    '',
    `- Bundle ID: \`${escapeMarkdown(result.bundleId)}\``,
    `- Build number: \`${escapeMarkdown(result.buildNumber)}\``,
    `- App Store Connect build ID: \`${escapeMarkdown(result.build.id)}\``,
    `- Processing state: \`${escapeMarkdown(result.build.attributes?.processingState)}\``,
    `- Internal lane: \`${escapeMarkdown(result.internalLane)}\``,
    `- External/public lane: \`${escapeMarkdown(result.externalLane)}\``,
    `- Internal build state: \`${escapeMarkdown(result.betaDetail.attributes?.internalBuildState ?? 'UNKNOWN')}\``,
    `- External build state: \`${escapeMarkdown(result.betaDetail.attributes?.externalBuildState ?? 'UNKNOWN')}\``,
  ];

  if (reviewState)
    lines.push(`- Beta App Review: \`${escapeMarkdown(reviewState)}\``);
  if (result.externalLane === 'apple-review-pending') {
    lines.push(
      '- External distribution is associated with the selected groups, but Apple must finish Beta App Review before testers can install it.',
    );
  }
  if (result.internalLane === 'activation-pending') {
    lines.push(
      '- Internal distribution is associated with the selected groups and is waiting for App Store Connect to activate testing.',
    );
  }
  if (result.externalLane === 'activation-pending') {
    lines.push(
      '- External distribution is associated with the selected groups and is waiting for App Store Connect or Beta App Review to activate testing.',
    );
  }

  lines.push(
    '',
    '| Lane | Association | Public link enabled |',
    '| --- | --- | --- |',
  );
  for (const item of result.groups) {
    lines.push(
      `| ${escapeMarkdown(item.lane)} | ${escapeMarkdown(item.association)} | ${item.group.attributes?.publicLinkEnabled ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
};

export const distributeTestFlightBuild = async ({
  client,
  bundleId,
  buildNumber,
  internalGroupSelector = '*',
  externalGroupSelector = 'none',
  verifyAttempts = 40,
  verifyDelayMs = 30_000,
  distributionAttempts = 5,
  distributionDelayMs = 15_000,
  wait = sleep,
}) => {
  const app = await findApp(client, bundleId);
  const build = await waitForValidBuild({
    client,
    appId: app.id,
    buildNumber,
    attempts: verifyAttempts,
    delayMs: verifyDelayMs,
    wait,
  });
  const groups = await client.listAll(
    `/v1/apps/${encodeURIComponent(app.id)}/betaGroups` +
      '?fields%5BbetaGroups%5D=name,isInternalGroup,hasAccessToAllBuilds,publicLinkEnabled,publicLink&limit=200',
  );
  const internalGroups = selectGroups(
    groups,
    internalGroupSelector,
    'internal',
  );
  const externalGroups = selectGroups(
    groups,
    externalGroupSelector,
    'external',
  );

  if (
    internalGroups.length === 0 &&
    parseGroupSelectorForLane(internalGroupSelector, 'internal').mode !== 'none'
  ) {
    throw new Error(
      'No internal TestFlight groups are configured. Create one in App Store Connect or set TESTFLIGHT_INTERNAL_GROUPS=none explicitly.',
    );
  }
  if (
    externalGroups.length === 0 &&
    parseGroupSelectorForLane(externalGroupSelector, 'external').mode !== 'none'
  ) {
    throw new Error(
      'No external TestFlight groups are configured. Create one in App Store Connect or set TESTFLIGHT_EXTERNAL_GROUPS=none explicitly.',
    );
  }

  const distributedGroups = [];
  for (const group of internalGroups) {
    distributedGroups.push({
      lane: 'internal',
      group,
      association: await ensureGroupContainsBuild(
        client,
        group,
        build.id,
        wait,
        distributionAttempts,
        distributionDelayMs,
      ),
    });
  }
  for (const group of externalGroups) {
    distributedGroups.push({
      lane: 'external/public',
      group,
      association: await ensureGroupContainsBuild(
        client,
        group,
        build.id,
        wait,
        distributionAttempts,
        distributionDelayMs,
      ),
    });
  }

  const laneStates = await waitForLaneStates({
    client,
    buildId: build.id,
    requireInternal: internalGroups.length > 0,
    requireExternal: externalGroups.length > 0,
    attempts: distributionAttempts,
    delayMs: distributionDelayMs,
    wait,
  });
  const betaDetail = laneStates.betaDetail;
  const review = laneStates.review;

  return {
    app,
    build,
    bundleId,
    buildNumber,
    betaDetail,
    review,
    groups: distributedGroups,
    internalLane:
      internalGroups.length === 0
        ? 'disabled'
        : laneStates.internalActivationPending
          ? 'activation-pending'
          : 'available',
    externalLane:
      externalGroups.length === 0
        ? 'disabled'
        : laneStates.externalReviewPending
          ? 'apple-review-pending'
          : laneStates.externalActivationPending
            ? 'activation-pending'
            : 'available',
  };
};

export const configurationFromEnvironment = environment => ({
  bundleId: requiredStringFromEnvironment(environment, 'IOS_BUNDLE_ID'),
  buildNumber: requiredStringFromEnvironment(
    environment,
    'TESTFLIGHT_BUILD_NUMBER',
  ),
  internalGroupSelector: environment.TESTFLIGHT_INTERNAL_GROUPS ?? '*',
  externalGroupSelector:
    environment.TESTFLIGHT_EXTERNAL_GROUPS?.trim() || 'none',
  verifyAttempts: integerFromEnvironment(
    environment,
    'TESTFLIGHT_VERIFY_ATTEMPTS',
    40,
  ),
  verifyDelayMs: numberFromEnvironment(
    environment,
    'TESTFLIGHT_VERIFY_DELAY_MS',
    30_000,
  ),
  distributionAttempts: integerFromEnvironment(
    environment,
    'TESTFLIGHT_DISTRIBUTION_ATTEMPTS',
    5,
  ),
  distributionDelayMs: numberFromEnvironment(
    environment,
    'TESTFLIGHT_DISTRIBUTION_DELAY_MS',
    15_000,
  ),
});
