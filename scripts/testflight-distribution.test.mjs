import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  AppStoreConnectError,
  configurationFromEnvironment,
  createAppStoreConnectClient,
  distributeTestFlightBuild,
  formatTestFlightSummary,
  isExternalBuildAvailable,
  isExternalActivationPending,
  isExternalReviewPending,
  isInternalActivationPending,
  isInternalBuildAvailable,
  isTerminalTestFlightState,
  parseGroupSelector,
  selectGroups,
} from './testflight-distribution.mjs';

describe('TestFlight environment configuration', () => {
  it('rejects blank bundle IDs and build numbers before polling Apple', () => {
    assert.throws(
      () =>
        configurationFromEnvironment({
          IOS_BUNDLE_ID: ' ',
          TESTFLIGHT_BUILD_NUMBER: '42',
        }),
      /IOS_BUNDLE_ID is required/,
    );
    assert.throws(
      () =>
        configurationFromEnvironment({
          IOS_BUNDLE_ID: 'studio.imai.vector',
          TESTFLIGHT_BUILD_NUMBER: '',
        }),
      /TESTFLIGHT_BUILD_NUMBER is required/,
    );
  });

  it('treats blank numeric settings as unset', () => {
    const configuration = configurationFromEnvironment({
      IOS_BUNDLE_ID: 'studio.imai.vector',
      TESTFLIGHT_BUILD_NUMBER: '42',
      TESTFLIGHT_VERIFY_ATTEMPTS: ' ',
      TESTFLIGHT_VERIFY_DELAY_MS: '',
    });

    assert.equal(configuration.verifyAttempts, 40);
    assert.equal(configuration.verifyDelayMs, 30_000);
    assert.equal(configuration.externalGroupSelector, 'none');
  });

  it('treats a blank external selector as disabled', () => {
    const configuration = configurationFromEnvironment({
      IOS_BUNDLE_ID: 'studio.imai.vector',
      TESTFLIGHT_BUILD_NUMBER: '42',
      TESTFLIGHT_EXTERNAL_GROUPS: ' ',
    });

    assert.equal(configuration.externalGroupSelector, 'none');
  });
});

const groups = [
  {
    type: 'betaGroups',
    id: 'internal-id',
    attributes: { name: 'Team', isInternalGroup: true },
  },
  {
    type: 'betaGroups',
    id: 'external-id',
    attributes: {
      name: 'Public beta',
      isInternalGroup: false,
      publicLink: 'https://testflight.apple.com/join/example',
    },
  },
];

describe('TestFlight group selection', () => {
  it('defaults to every group in the requested lane', () => {
    assert.deepEqual(selectGroups(groups, '', 'internal'), [groups[0]]);
    assert.deepEqual(selectGroups(groups, '*', 'external'), [groups[1]]);
    assert.deepEqual(selectGroups(groups, '', 'external'), []);
  });

  it('selects exact group names and IDs', () => {
    assert.deepEqual(selectGroups(groups, 'Team', 'internal'), [groups[0]]);
    assert.deepEqual(selectGroups(groups, 'external-id', 'external'), [
      groups[1],
    ]);
  });

  it('supports explicitly disabling a lane', () => {
    assert.deepEqual(parseGroupSelector('none'), { mode: 'none', values: [] });
    assert.deepEqual(selectGroups(groups, 'none', 'external'), []);
  });

  it('rejects selectors that do not match the requested lane', () => {
    assert.throws(
      () => selectGroups(groups, 'Public beta', 'internal'),
      /Unknown internal TestFlight group selector/,
    );
  });
});

describe('App Store Connect beta states', () => {
  it('only treats builds in active testing as genuinely available', () => {
    assert.equal(isInternalBuildAvailable('IN_BETA_TESTING'), true);
    assert.equal(isInternalBuildAvailable('READY_FOR_BETA_TESTING'), false);
    assert.equal(isExternalBuildAvailable('IN_BETA_TESTING'), true);
    assert.equal(isExternalBuildAvailable('READY_FOR_BETA_TESTING'), false);
    assert.equal(isExternalBuildAvailable('BETA_APPROVED'), false);
  });

  it('recognizes healthy states that are still waiting for activation', () => {
    assert.equal(isInternalActivationPending('READY_FOR_BETA_TESTING'), true);
    assert.equal(
      isInternalActivationPending('IN_EXPORT_COMPLIANCE_REVIEW'),
      true,
    );
    assert.equal(isExternalActivationPending('BETA_APPROVED'), true);
    assert.equal(isExternalActivationPending('READY_FOR_BETA_TESTING'), true);
  });

  it('recognizes both build-detail and review-resource pending states', () => {
    assert.equal(
      isExternalReviewPending('WAITING_FOR_BETA_REVIEW', undefined),
      true,
    );
    assert.equal(isExternalReviewPending('IN_BETA_REVIEW', undefined), true);
    assert.equal(
      isExternalReviewPending(
        'READY_FOR_BETA_SUBMISSION',
        'WAITING_FOR_REVIEW',
      ),
      true,
    );
    assert.equal(
      isExternalReviewPending('READY_FOR_BETA_SUBMISSION', 'IN_REVIEW'),
      true,
    );
  });

  it('recognizes Apple rejection and removed-build terminal states', () => {
    for (const state of [
      'PROCESSING_EXCEPTION',
      'MISSING_EXPORT_COMPLIANCE',
      'EXPIRED',
      'BETA_REJECTED',
      'REJECTED',
      'BUILD_REMOVED',
    ]) {
      assert.equal(isTerminalTestFlightState(state), true, state);
    }
  });
});

const createFlowClient = ({
  alreadyDistributed = false,
  activationPending = false,
  externalStateOverride,
  externalStateSequence,
  existingReview,
  associationConflict = false,
  associationReadLag = 0,
} = {}) => {
  const associatedGroups = new Set(
    alreadyDistributed ? ['internal-id', 'external-id'] : [],
  );
  const operations = [];
  const remainingAssociationLag = new Map();
  let review =
    (existingReview ?? alreadyDistributed)
      ? {
          type: 'betaAppReviewSubmissions',
          id: 'review-id',
          attributes: { betaReviewState: 'APPROVED' },
        }
      : undefined;
  let betaDetailReads = 0;

  return {
    operations,
    async listAll(path) {
      if (path.includes('/betaGroups?')) return groups;
      throw new Error(`Unexpected list path: ${path}`);
    },
    async request(path, options = {}) {
      if (path.startsWith('/v1/apps?')) {
        return {
          data: [
            {
              type: 'apps',
              id: 'app-id',
              attributes: { bundleId: 'studio.imai.vector' },
            },
          ],
        };
      }
      if (path.startsWith('/v1/builds?')) {
        return {
          data: [
            {
              type: 'builds',
              id: 'build-id',
              attributes: { version: '42', processingState: 'VALID' },
            },
          ],
        };
      }
      if (path.startsWith('/v1/betaGroups?filter%5Bid%5D=')) {
        const groupId = new URL(path, 'https://example.test').searchParams.get(
          'filter[id]',
        );
        const remainingLag = remainingAssociationLag.get(groupId) ?? 0;
        if (remainingLag > 0) {
          remainingAssociationLag.set(groupId, remainingLag - 1);
          return { data: [] };
        }
        return {
          data: associatedGroups.has(groupId)
            ? [{ type: 'betaGroups', id: groupId }]
            : [],
        };
      }
      if (
        path === '/v1/builds/build-id/relationships/betaGroups' &&
        options.method === 'POST'
      ) {
        const groupId = options.body.data[0].id;
        operations.push(`associate:${groupId}`);
        associatedGroups.add(groupId);
        remainingAssociationLag.set(groupId, associationReadLag);
        if (associationConflict) {
          throw new AppStoreConnectError('Concurrent association', {
            status: 409,
          });
        }
        return undefined;
      }
      if (path.includes('/buildBetaDetail')) {
        const sequencedExternalState =
          externalStateSequence?.[
            Math.min(betaDetailReads, externalStateSequence.length - 1)
          ];
        betaDetailReads += 1;
        return {
          data: {
            type: 'buildBetaDetails',
            id: 'detail-id',
            attributes: {
              internalBuildState: activationPending
                ? 'READY_FOR_BETA_TESTING'
                : 'IN_BETA_TESTING',
              externalBuildState:
                sequencedExternalState ??
                externalStateOverride ??
                (activationPending
                  ? 'BETA_APPROVED'
                  : alreadyDistributed
                    ? 'IN_BETA_TESTING'
                    : review
                      ? 'WAITING_FOR_BETA_REVIEW'
                      : 'READY_FOR_BETA_SUBMISSION'),
            },
          },
        };
      }
      if (
        path.startsWith('/v1/betaAppReviewSubmissions?') &&
        options.method !== 'POST'
      ) {
        return { data: review ? [review] : [] };
      }
      if (
        path === '/v1/betaAppReviewSubmissions' &&
        options.method === 'POST'
      ) {
        assert.equal(associatedGroups.has('external-id'), true);
        operations.push('submit-review');
        review = {
          type: 'betaAppReviewSubmissions',
          id: 'review-id',
          attributes: { betaReviewState: 'WAITING_FOR_REVIEW' },
        };
        return { data: review };
      }
      throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${path}`);
    },
  };
};

describe('TestFlight full distribution flow', () => {
  it('associates both lanes before submitting a new external review', async () => {
    const client = createFlowClient();
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: '*',
      distributionAttempts: 1,
      wait: async () => {},
    });

    assert.deepEqual(client.operations, [
      'associate:internal-id',
      'associate:external-id',
      'submit-review',
    ]);
    assert.equal(result.internalLane, 'available');
    assert.equal(result.externalLane, 'apple-review-pending');
  });

  it('is idempotent for an already-distributed and approved build', async () => {
    const client = createFlowClient({ alreadyDistributed: true });
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: '*',
      distributionAttempts: 1,
      wait: async () => {},
    });

    assert.deepEqual(client.operations, []);
    assert.equal(result.internalLane, 'available');
    assert.equal(result.externalLane, 'available');
    assert.deepEqual(
      result.groups.map(group => group.association),
      ['already-added', 'already-added'],
    );
  });

  it('reports approved builds as activation-pending without claiming availability', async () => {
    const client = createFlowClient({
      alreadyDistributed: true,
      activationPending: true,
    });
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: '*',
      distributionAttempts: 1,
      wait: async () => {},
    });

    assert.equal(result.internalLane, 'activation-pending');
    assert.equal(result.externalLane, 'activation-pending');
  });

  it('does not let a disabled external lane block internal distribution', async () => {
    const client = createFlowClient({
      alreadyDistributed: true,
      externalStateOverride: 'BETA_REJECTED',
    });
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: 'none',
      distributionAttempts: 1,
      wait: async () => {},
    });

    assert.equal(result.internalLane, 'available');
    assert.equal(result.externalLane, 'disabled');
  });

  it('waits through non-submittable external states without creating a review', async () => {
    const client = createFlowClient({
      alreadyDistributed: true,
      existingReview: false,
      externalStateOverride: 'PROCESSING',
    });
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: '*',
      distributionAttempts: 1,
      wait: async () => {},
    });

    assert.deepEqual(client.operations, []);
    assert.equal(result.externalLane, 'activation-pending');
  });

  it('submits external review when Apple becomes ready during polling', async () => {
    const client = createFlowClient({
      alreadyDistributed: true,
      existingReview: false,
      externalStateSequence: [
        'PROCESSING',
        'READY_FOR_BETA_SUBMISSION',
        'WAITING_FOR_BETA_REVIEW',
      ],
    });
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: '*',
      distributionAttempts: 3,
      wait: async () => {},
    });

    assert.deepEqual(client.operations, ['submit-review']);
    assert.equal(result.externalLane, 'apple-review-pending');
    assert.equal(
      result.review.attributes.betaReviewState,
      'WAITING_FOR_REVIEW',
    );
  });

  it('recovers when Apple reports a concurrent group association', async () => {
    const client = createFlowClient({ associationConflict: true });
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: '*',
      distributionAttempts: 1,
      wait: async () => {},
    });

    assert.deepEqual(
      result.groups.map(group => group.association),
      ['added', 'added'],
    );
  });

  it('uses the configured distribution window for association read-after-write lag', async () => {
    const client = createFlowClient({ associationReadLag: 3 });
    const delays = [];
    const result = await distributeTestFlightBuild({
      client,
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      externalGroupSelector: 'none',
      distributionAttempts: 5,
      distributionDelayMs: 7_000,
      wait: async delay => delays.push(delay),
    });

    assert.equal(result.groups[0].association, 'added');
    assert.deepEqual(delays, [7_000, 7_000, 7_000]);
  });

  it('fails when a selected external lane is rejected', async () => {
    const client = createFlowClient({
      alreadyDistributed: true,
      externalStateOverride: 'BETA_REJECTED',
    });

    await assert.rejects(
      distributeTestFlightBuild({
        client,
        bundleId: 'studio.imai.vector',
        buildNumber: '42',
        externalGroupSelector: '*',
        distributionAttempts: 1,
        wait: async () => {},
      }),
      /BETA_REJECTED/,
    );
  });
});

describe('App Store Connect retries', () => {
  it('caps Retry-After delays before retrying a throttled request', async () => {
    const { privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const delays = [];
    let requests = 0;
    const client = createAppStoreConnectClient({
      keyContent: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      keyId: 'test-key',
      issuerId: 'test-issuer',
      fetchImplementation: async () => {
        requests += 1;
        return requests === 1
          ? new Response(
              JSON.stringify({ errors: [{ detail: 'Slow down' }] }),
              {
                status: 429,
                headers: {
                  'content-type': 'application/json',
                  'retry-after': '3600',
                },
              },
            )
          : new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
      },
      wait: async delay => delays.push(delay),
    });

    const response = await client.request('/v1/apps');

    assert.deepEqual(response, { data: [] });
    assert.deepEqual(delays, [15_000]);
    assert.equal(requests, 2);
  });
});

describe('TestFlight step summary', () => {
  it('reports Apple review pending without claiming external availability', () => {
    const summary = formatTestFlightSummary({
      bundleId: 'studio.imai.vector',
      buildNumber: '42',
      build: {
        id: 'build-id',
        attributes: { processingState: 'VALID' },
      },
      betaDetail: {
        attributes: {
          internalBuildState: 'IN_BETA_TESTING',
          externalBuildState: 'WAITING_FOR_BETA_REVIEW',
        },
      },
      review: { attributes: { betaReviewState: 'WAITING_FOR_REVIEW' } },
      groups: [
        { lane: 'external/public', group: groups[1], association: 'added' },
      ],
      internalLane: 'available',
      externalLane: 'apple-review-pending',
    });

    assert.match(summary, /External\/public lane: `apple-review-pending`/);
    assert.match(summary, /Beta App Review: `WAITING_FOR_REVIEW`/);
    assert.doesNotMatch(
      summary,
      /https:\/\/testflight\.apple\.com\/join\/example/,
    );
    assert.doesNotMatch(summary, /Public beta/);
    assert.match(summary, /Public link enabled/);
  });
});
