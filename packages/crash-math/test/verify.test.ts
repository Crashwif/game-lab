/**
 * The Solana checks of the verifier: a salt check that fails only on a blockhash that disagrees, an anchor
 * check that says when this RPC cannot settle it, and a history audit that keeps those anchors apart from
 * findings against the room.
 */
import { describe, expect, it } from 'vitest';

import { MEMO_PROGRAM, SYSTEM_PROGRAM, base58Encode, chainAnchorAddress, chainAnchorMemo, chainAnchorSeed } from '../src/commitment.js';
import { auditChains, chainAnchored, verifyAnchor, verifyRoomChain, verifySalt, type ChainSummary } from '../src/verify.js';

const GAME = '11111111-1111-4111-8111-111111111111';
const KEY = '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG';
const SIG = base58Encode(new Uint8Array(64).fill(7));
const SALT = '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi';
const chain = { chainId: 0, terminalHash: 'ab'.repeat(32), saltSlot: 1_000, salt: SALT, houseEdgeBps: 300, chainLength: 100_000, anchorSignature: SIG };

type Answers = Record<string, (params: unknown[]) => unknown>;

/** A Solana RPC answering each method from `answers`, with a null result for anything else. */
const solana = (answers: Answers) => async (_url: string, init?: { body?: string }) => {
  const { method, params } = JSON.parse(init?.body ?? '{}') as { method: string; params: unknown[] };
  return { ok: true, status: 200, json: async () => ({ result: answers[method] ? answers[method]!(params) : null }) };
};

it('keeps the round checks when the Solana RPC cannot answer', async () => {
  const c = { ...chain, nextIndex: 0, retired: false };
  const fetch = async (url: string) => {
    if (url === 'https://rpc.test') throw new Error('offline');
    return { ok: true, status: 200, json: async () => url.endsWith('/chains') ? { chains: [c] } : { chain: c, rounds: [], next: null } };
  };
  const result = await verifyRoomChain('https://rooms.test', GAME, 0, { rpcUrl: 'https://rpc.test', anchorKey: KEY, fetch });
  expect(result.state.failures).toEqual([]);
  expect(result.salt).toMatchObject({ state: 'unsettled', detail: expect.stringContaining('offline') });
  expect(result.anchor).toMatchObject({ ok: false, settled: false, detail: expect.stringContaining('offline') });
  expect(result.history).toMatchObject({ ok: false, complete: false });
  expect(result.listing).toEqual([c]);
});

describe('verifySalt', () => {
  it('agrees with the blockhash of the first finalized block at or after the salt slot', async () => {
    const check = await verifySalt(chain, 'http://rpc', solana({ getBlocks: () => [1_002, 1_003], getBlock: () => ({ blockhash: SALT }) }));
    expect(check).toMatchObject({ ok: true, state: 'ok', slot: 1_002, blockhash: SALT });
  });

  it('fails only a salt that disagrees with the blockhash', async () => {
    const check = await verifySalt(chain, 'http://rpc', solana({ getBlocks: () => [1_002], getBlock: () => ({ blockhash: 'another' }) }));
    expect(check).toMatchObject({ ok: false, state: 'failed', slot: 1_002, blockhash: 'another' });
    expect(check.detail).toMatch(/not the blockhash of block 1002/);
  });

  it('is unsettled while the slot is not reached, while the RPC does not serve the block, and while the salt is not drawn', async () => {
    const notReached = await verifySalt(chain, 'http://rpc', solana({ getBlocks: () => [] }));
    expect(notReached).toMatchObject({ ok: false, state: 'unsettled', slot: null, blockhash: null, detail: expect.stringMatching(/no finalized block at or after slot 1000 yet/) });
    const pruned = await verifySalt(chain, 'http://rpc', solana({ getBlocks: () => [1_002], getBlock: () => null }));
    expect(pruned).toMatchObject({ ok: false, state: 'unsettled', slot: 1_002, blockhash: null, detail: expect.stringMatching(/block 1002 is not served by this RPC/) });
    const undrawn = await verifySalt({ ...chain, salt: null }, 'http://rpc', solana({ getBlocks: () => [1_002], getBlock: () => ({ blockhash: SALT }) }));
    expect(undrawn).toMatchObject({ ok: false, state: 'unsettled', slot: 1_002, blockhash: SALT, detail: expect.stringMatching(/not drawn yet; the chain waits for slot 1000/) });
  });
});

describe('verifyAnchor', () => {
  it('says when this RPC has no transaction for the anchor, settling nothing', async () => {
    const check = await verifyAnchor(GAME, chain, 'http://rpc', KEY, solana({ getTransaction: () => null }));
    expect(check).toMatchObject({ ok: false, settled: false, slot: null, detail: expect.stringMatching(/not found on this RPC/) });
    expect(check.claimed).toBeUndefined();
  });
});

describe('auditChains', () => {
  const listed = (over: Partial<ChainSummary> = {}): ChainSummary => ({ ...chain, nextIndex: 5, retired: false, anchorSlot: null, ...over });
  const address = chainAnchorAddress(KEY, GAME, 0);
  const claimedAt = (claimedAddress: string) => (params: unknown[]) => ({ value: params[0] === claimedAddress ? { owner: MEMO_PROGRAM, lamports: 1_000_000 } : null });

  it('holds a claimed address whose anchor this RPC cannot find apart from findings against the room', async () => {
    const audit = await auditChains(GAME, [listed()], 'http://rpc', KEY, solana({ getTransaction: () => null, getAccountInfo: claimedAt(address) }));
    expect(audit).toEqual({ ok: false, complete: true, anchors: 0, problems: [], unsettled: [expect.stringMatching(/^chain 0's anchor .* was not found on this RPC/)] });
  });

  it('keeps a played chain whose address was never claimed a finding, with no unsettled anchors listed', async () => {
    const audit = await auditChains(GAME, [listed()], 'http://rpc', KEY, solana({ getTransaction: () => null, getAccountInfo: () => ({ value: null }) }));
    expect(audit).toEqual({ ok: false, complete: true, anchors: 0, problems: [expect.stringMatching(/^chain 0 was played without an anchor/)] });
    expect(audit.unsettled).toBeUndefined();
  });

  it('lists a definite finding beside an unsettled anchor', async () => {
    const chains = [listed({ retired: true, nextIndex: 5 }), listed({ chainId: 1, anchorSignature: null, nextIndex: 3 })];
    const audit = await auditChains(GAME, chains, 'http://rpc', KEY, solana({ getTransaction: () => null, getAccountInfo: claimedAt(address) }));
    expect(audit.problems).toEqual([expect.stringMatching(/^chain 1 was played without an anchor/)]);
    expect(audit.unsettled).toEqual([expect.stringMatching(/^chain 0's anchor/)]);
    expect(audit).toMatchObject({ ok: false, complete: true });
  });
});

describe('Published anchor keys', () => {
  const OTHER = base58Encode(new Uint8Array(32).fill(8));
  const UNKNOWN = base58Encode(new Uint8Array(32).fill(9));

  function transaction(key: string, c = chain, slot = 900) {
    const address = chainAnchorAddress(key, GAME, c.chainId);
    return { slot, meta: { err: null, postBalances: [1000000, 1000000] }, transaction: { message: {
      accountKeys: [{ pubkey: key, signer: true }, { pubkey: address, signer: false }],
      instructions: [
        { programId: SYSTEM_PROGRAM, parsed: { type: 'allocateWithSeed', info: { account: address, base: key, seed: chainAnchorSeed(GAME, c.chainId), owner: MEMO_PROGRAM, space: 1 } } },
        { programId: MEMO_PROGRAM, parsed: chainAnchorMemo(GAME, { ...c, minRoundMs: 10000 }) },
      ],
    } } };
  }

  it('verifies a recorded key in the published list and refuses an unknown key', async () => {
    const fetch = solana({ getTransaction: () => transaction(OTHER) });
    expect(await verifyAnchor(GAME, { ...chain, anchorKey: OTHER }, 'https://rpc', [KEY, OTHER], fetch)).toMatchObject({ ok: true });
    expect(await verifyAnchor(GAME, { ...chain, anchorKey: UNKNOWN }, 'https://rpc', [KEY, OTHER], fetch)).toMatchObject({ ok: false, detail: expect.stringContaining('outside the published trusted keys') });
    expect(await verifyAnchor(GAME, { ...chain, anchorKey: KEY }, 'https://rpc', [KEY, OTHER], fetch)).toMatchObject({ ok: false, detail: expect.stringContaining('not signed') });
  });

  it('finds a later anchor under any published key', async () => {
    const later = chainAnchorAddress(OTHER, GAME, 1);
    const fetch = solana({ getAccountInfo: ([address]) => ({ value: address === later ? { owner: MEMO_PROGRAM, lamports: 1 } : null }) });
    expect(await chainAnchored(GAME, 1, 'https://rpc', [KEY, OTHER], fetch)).toBe(true);
  });

  it('rejects two claims for one chain across published keys', async () => {
    const addresses = new Set([KEY, OTHER].map((key) => chainAnchorAddress(key, GAME, 0)));
    const fetch = solana({ getTransaction: () => transaction(KEY), getAccountInfo: ([address]) => ({ value: addresses.has(String(address)) ? { owner: MEMO_PROGRAM, lamports: 1 } : null }) });
    const audit = await auditChains(GAME, [{ ...chain, anchorKey: KEY, nextIndex: 5, retired: false }], 'https://rpc', [KEY, OTHER], fetch);
    expect(audit.ok).toBe(false);
    expect(audit.problems).toContain('chain 0 has more than one claim across the published anchor keys');
  });

  it('enforces play time when consecutive chains use different published keys', async () => {
    const second = { ...chain, chainId: 1, saltSlot: 2000, anchorSignature: 'second' };
    const addresses = new Set([chainAnchorAddress(KEY, GAME, 0), chainAnchorAddress(OTHER, GAME, 1)]);
    const fetch = solana({ getTransaction: ([sig]) => sig === 'second' ? transaction(OTHER, second, 1900) : transaction(KEY),
      getAccountInfo: ([address]) => ({ value: addresses.has(String(address)) ? { owner: MEMO_PROGRAM, lamports: 1 } : null }),
      getBlocks: ([slot]) => [slot], getBlockTime: ([slot]) => slot });
    const audit = await auditChains(GAME, [{ ...chain, anchorKey: KEY, nextIndex: 100000, retired: true }, { ...second, anchorKey: OTHER, nextIndex: 1, retired: false }], 'https://rpc', [KEY, OTHER], fetch);
    expect(audit.ok).toBe(false);
    expect(audit.problems).toEqual([expect.stringMatching(/chain 1 was anchored .* less than/)]);
  });
});
