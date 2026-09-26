/**
 * Independent fairness verification. Uses only this package's maths and the
 * published data, never the server's own verdicts (the game server's CLI and
 * the web fairness page both run it): every revealed seed must hash to the
 * previous link (the chain's committed terminal hash for round 0), and every
 * crash point must equal crashFromSeed(seed, salt, edge). The salt can be
 * checked against Solana: the blockhash of the first finalized block at or
 * after the announced slot.
 */
import * as fairChain from './chain.js';
import { ADVERTISED_MIN_ROUND_MS, MEMO_PROGRAM, SYSTEM_PROGRAM, chainAnchorAddress, chainAnchorSeed, parseChainAnchorMemo, type ChainCommitment } from './commitment.js';
import * as free from './free.js';

export * from './commitment.js';

export interface PublishedChain {
  chainId: number;
  terminalHash: string;
  saltSlot: number;
  salt: string | null;
  houseEdgeBps: number;
  /** Rounds the server says it has settled; fewer served is a failure. */
  nextIndex?: number;
  /** The Solana transaction that published this commitment before its salt slot (chainAnchorMemo). */
  anchorSignature?: string | null;
  /** Rounds in the chain; part of the anchored commitment. */
  chainLength?: number;
}

export interface AnchorCheck {
  ok: boolean;
  /** The cited transaction made the chain's one funded claim (even if its memo or timing then failed). */
  claimed?: boolean;
  /** It claimed the address but landed at or after the salt slot. */
  late?: boolean;
  /** Slot the anchor landed in, when found. */
  slot: number | null;
  detail: string;
  /** The commitment the anchor states, when it matched (its minimum round time is what a verifier needs next). */
  commitment?: ChainCommitment;
}

export interface PublishedRound {
  roundIndex: number;
  seed: string;
  crashX100: number;
}

export interface VerifyFailure {
  roundIndex: number;
  reason: 'gap' | 'bad_link' | 'bad_crash' | 'no_salt' | 'truncated';
  detail: string;
}

export interface VerifyState {
  /** The link the next round's seed must hash to. */
  previousLink: string;
  nextIndex: number;
  checked: number;
  failures: VerifyFailure[];
}

export const startVerification = (chain: PublishedChain): VerifyState => ({ previousLink: chain.terminalHash, nextIndex: 0, checked: 0, failures: [] });

/** Verifies the next contiguous rounds; call again with later pages. */
export function verifyRounds(chain: PublishedChain, rounds: PublishedRound[], state: VerifyState): VerifyState {
  const next = { ...state, failures: [...state.failures] };
  for (const r of rounds) {
    if (r.roundIndex !== next.nextIndex) {
      next.failures.push({ roundIndex: next.nextIndex, reason: 'gap', detail: `expected round ${next.nextIndex}, got ${r.roundIndex}` });
      return next; // later links can't be checked without the missing seed
    }
    if (!fairChain.verifyChainLink(r.seed, next.previousLink)) {
      next.failures.push({ roundIndex: r.roundIndex, reason: 'bad_link', detail: `sha256(seed) is not the previous link ${next.previousLink.slice(0, 16)}…` });
    }
    if (!chain.salt) {
      next.failures.push({ roundIndex: r.roundIndex, reason: 'no_salt', detail: 'the chain has no salt yet' });
    } else {
      const expected = free.crashFromSeed(r.seed, chain.salt, chain.houseEdgeBps);
      if (expected !== r.crashX100) next.failures.push({ roundIndex: r.roundIndex, reason: 'bad_crash', detail: `published ${r.crashX100}, recomputed ${expected}` });
    }
    next.previousLink = r.seed;
    next.nextIndex = r.roundIndex + 1;
    next.checked += 1;
  }
  return next;
}

type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The platform fetch (browsers and Node 18+); this package targets plain ES2022 without DOM types. */
const globalFetch = (): FetchLike => (globalThis as unknown as { fetch: FetchLike }).fetch;

async function rpc<T>(fetchImpl: FetchLike, url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message: string; code?: number } };
  if (body.error) throw new RpcError(`${method}: ${body.error.message}`, body.error.code ?? null);
  return body.result as T;
}

/** The RPC node answered with an error (as opposed to not answering at all). */
export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
  ) {
    super(message);
  }
}

/** Whether `chain.salt` is the blockhash of the first finalized block at or after `chain.saltSlot`. */
export async function verifySalt(chain: PublishedChain, rpcUrl: string, fetchImpl: FetchLike = globalFetch()): Promise<{ ok: boolean; slot: number | null; blockhash: string | null }> {
  const blocks = await rpc<number[]>(fetchImpl, rpcUrl, 'getBlocks', [chain.saltSlot, chain.saltSlot + 500, { commitment: 'finalized' }]);
  const slot = blocks.find((b) => b >= chain.saltSlot) ?? null;
  if (slot === null) return { ok: false, slot: null, blockhash: null };
  const block = await rpc<{ blockhash: string } | null>(fetchImpl, rpcUrl, 'getBlock', [slot, { commitment: 'finalized', transactionDetails: 'none', rewards: false, maxSupportedTransactionVersion: 0 }]);
  // An RPC that has pruned the block, or answers nothing, fails the check rather than the whole verification.
  if (!block || typeof block.blockhash !== 'string') return { ok: false, slot, blockhash: null };
  return { ok: chain.salt !== null && block.blockhash === chain.salt, slot, blockhash: block.blockhash };
}

interface ParsedTransaction {
  slot: number;
  blockTime?: number | null;
  meta: { err: unknown; postBalances?: number[] } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: { programId: string; parsed?: unknown }[];
    };
  };
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/**
 * Whether `chain.anchorSignature` is this chain's anchor: a finalized, successful transaction signed by
 * `anchorKey` that allocated the chain's anchor address for the Memo program (which can happen only once per
 * game and chain id), whose memo states exactly this chain's commitment, in a slot before the salt slot.
 */
export async function verifyAnchor(rawGameId: string, chain: PublishedChain, rpcUrl: string, anchorKey: string, fetchImpl: FetchLike = globalFetch()): Promise<AnchorCheck> {
  // Game ids are lowercase UUIDs wherever they are hashed: accept one typed in capitals.
  const gameId = rawGameId.toLowerCase();
  if (!chain.anchorSignature) return { ok: false, slot: null, detail: 'the chain was not anchored on Solana' };
  if (!isCount(chain.chainId) || !isCount(chain.saltSlot) || !isCount(chain.chainLength ?? -1)) {
    return { ok: false, slot: null, detail: "the server's chain id, salt slot or length isn't a whole number" };
  }
  const tx = await rpc<ParsedTransaction | null>(fetchImpl, rpcUrl, 'getTransaction', [chain.anchorSignature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]);
  if (!tx) return { ok: false, slot: null, detail: `anchor ${chain.anchorSignature} not found (or not finalized)` };
  if (tx.meta?.err) return { ok: false, slot: tx.slot, detail: 'the anchor transaction failed' };
  const { accountKeys, instructions } = tx.transaction.message;
  if (!accountKeys.some((k) => k.pubkey === anchorKey && k.signer)) return { ok: false, slot: tx.slot, detail: `the anchor is not signed by ${anchorKey}` };
  // The one-time allocation of the chain's anchor address is what makes this its only anchor.
  const address = chainAnchorAddress(anchorKey, gameId, chain.chainId);
  const assigned = instructions.some((ix) => {
    if (ix.programId !== SYSTEM_PROGRAM) return false;
    const parsed = ix.parsed as { type?: string; info?: { account?: string; base?: string; seed?: string; owner?: string; space?: number } } | undefined;
    return (
      parsed?.type === 'allocateWithSeed' &&
      parsed.info?.account === address &&
      parsed.info.base === anchorKey &&
      parsed.info.seed === chainAnchorSeed(gameId, chain.chainId) &&
      parsed.info.owner === MEMO_PROGRAM &&
      (parsed.info.space ?? 0) > 0
    );
  });
  if (!assigned) return { ok: false, slot: tx.slot, detail: `the anchor didn't claim chain ${chain.chainId}'s anchor address` };
  // Funded, or the claim doesn't stick: an account left with no lamports is deleted and the address is free
  // again. A funded account owned by the Memo program can never be drained or re-allocated.
  const addressIndex = accountKeys.findIndex((k) => k.pubkey === address);
  if (addressIndex < 0 || !((tx.meta?.postBalances?.[addressIndex] ?? 0) > 0)) {
    return { ok: false, slot: tx.slot, detail: `the anchor left chain ${chain.chainId}'s anchor address unfunded, so the claim didn't stick` };
  }
  const memos = instructions.filter((ix) => ix.programId === MEMO_PROGRAM).map((ix) => (typeof ix.parsed === 'string' ? parseChainAnchorMemo(ix.parsed) : null));
  const stated = memos.length === 1 ? memos[0] : null;
  if (
    !stated ||
    stated.gameId !== gameId ||
    stated.chainId !== chain.chainId ||
    stated.terminalHash !== chain.terminalHash ||
    stated.saltSlot !== chain.saltSlot ||
    stated.houseEdgeBps !== chain.houseEdgeBps ||
    stated.chainLength !== chain.chainLength
  ) {
    return { ok: false, claimed: true, slot: tx.slot, detail: 'the anchor memo does not match this chain' };
  }
  const { gameId: _gameId, ...commitment } = stated;
  if (tx.slot >= chain.saltSlot) return { ok: false, claimed: true, late: true, slot: tx.slot, detail: `anchored in slot ${tx.slot}, not before the salt slot ${chain.saltSlot}`, commitment };
  return { ok: true, claimed: true, slot: tx.slot, detail: `anchored in slot ${tx.slot}, before the salt slot ${chain.saltSlot}`, commitment };
}

/** A committed chain as GET /rooms/:id/chains lists it. */
export interface ChainSummary {
  chainId: number;
  terminalHash: string;
  saltSlot: number;
  salt?: string | null;
  houseEdgeBps: number;
  chainLength: number;
  nextIndex: number;
  retired: boolean;
  anchorSignature: string | null;
  createdAt?: string;
}

export interface AnchorAudit {
  ok: boolean;
  /** False when the audit could not look at every chain (the listing failed, or it lists more than a verifier checks). */
  complete: boolean;
  /** Anchored chains that verified. */
  anchors: number;
  problems: string[];
}

async function blockTime(fetchImpl: FetchLike, rpcUrl: string, slot: number): Promise<number | null> {
  return rpc<number | null>(fetchImpl, rpcUrl, 'getBlockTime', [slot]);
}

/** The first finalized block at or after `slot` (the salt rule), or null if there is none yet. */
async function firstBlockFrom(fetchImpl: FetchLike, rpcUrl: string, slot: number): Promise<number | null> {
  const blocks = await rpc<number[]>(fetchImpl, rpcUrl, 'getBlocks', [slot, slot + 500, { commitment: 'finalized' }]);
  return blocks.find((b) => b >= slot) ?? null;
}

/** What every chain of a room must commit to (the advertised game); tests and private rooms may relax them. */
export interface ChainRules {
  houseEdgeBps: number;
  minRoundMs: number;
  minChainLength: number;
}

/**
 * The rooms' own chains are 100,000 rounds, so abandoning one to re-roll costs at least 100,000 × 10 s, over
 * eleven days (at 1,000 rounds it would cost under three hours).
 */
export const ADVERTISED_RULES: ChainRules = { houseEdgeBps: free.DEFAULT_EDGE_BPS, minRoundMs: ADVERTISED_MIN_ROUND_MS, minChainLength: 100_000 };

/** How many ids past the newest listed chain are checked for claims held back. */
const HELD_BACK_LOOKAHEAD = 3;
/** More chains than a room could play in centuries: a server listing more is stalling the verifier. */
export const MAX_AUDITED_CHAINS = 10_000;

/** Whether chain `chainId`'s anchor address has been claimed for good (a later chain exists once the next id is). */
export async function chainAnchored(rawGameId: string, chainId: number, rpcUrl: string, anchorKey: string, fetchImpl: FetchLike = globalFetch()): Promise<boolean> {
  if (!isCount(chainId)) throw new Error(`chain id ${chainId} is not a whole number`);
  return claimedAddress(fetchImpl, rpcUrl, chainAnchorAddress(anchorKey, rawGameId.toLowerCase(), chainId));
}

async function claimedAddress(fetchImpl: FetchLike, rpcUrl: string, address: string): Promise<boolean> {
  const info = await rpc<{ value: { owner: string; lamports: number } | null }>(fetchImpl, rpcUrl, 'getAccountInfo', [address, { encoding: 'base64', commitment: 'finalized' }]);
  return info.value?.owner === MEMO_PROGRAM && info.value.lamports > 0;
}

/**
 * The room's whole history, checked against Solana rather than the server's word.
 *
 * Every listed chain is one of:
 * - verified: its cited anchor made the chain's one funded claim, states its commitment and landed before
 *   the salt slot; it must also follow `rules` (edge, minimum round time, length) and, once retired, have
 *   been played to its end;
 * - a wasted id: never played, and either never claimed (its anchor never landed) or claimed too late by
 *   the transaction it cites. Honest rooms produce these when an anchor is dropped;
 * - pending: the newest chain, not played yet, whose anchor hasn't finalized;
 * - anything else fails.
 *
 * Then: chain ids run 0, 1, 2, ... without gaps; no id just past the newest is already claimed (a candidate
 * held back); and each verified chain's next claim, whatever came of it, landed no sooner than the chain
 * could have been played out after its salt block (chain length times its minimum round time). So
 * abandoning a chain costs that time, and parking failed or late chains in between doesn't avoid it.
 */
export async function auditChains(
  rawGameId: string,
  chains: ChainSummary[],
  rpcUrl: string,
  anchorKey: string,
  fetchImpl: FetchLike = globalFetch(),
  rules: ChainRules = ADVERTISED_RULES,
): Promise<AnchorAudit> {
  const gameId = rawGameId.toLowerCase();
  if (chains.length > MAX_AUDITED_CHAINS) return { ok: false, complete: false, anchors: 0, problems: [`the server lists ${chains.length} chains, more than the ${MAX_AUDITED_CHAINS} a verifier checks`] };
  const problems: string[] = [];
  const sorted = [...chains].sort((a, b) => a.chainId - b.chainId);
  if (sorted.some((c, i) => !isCount(c.chainId) || c.chainId !== i)) problems.push("the server's chain ids aren't 0, 1, 2, ... without gaps");
  // One chain is played at a time: a chain is retired before the next is committed, so only the newest may be active.
  for (const c of sorted.slice(0, -1)) if (!c.retired) problems.push(`chain ${c.chainId} is listed as active, but chain ${sorted[sorted.length - 1]!.chainId} came after it`);
  const verified: { chainId: number; commitment: ChainCommitment }[] = [];
  const claims: { chainId: number; slot: number }[] = [];
  for (const c of sorted) {
    // Every field the checks below compare must be what it claims to be: a missing or
    // non-numeric nextIndex would make "played to the end" vacuously true.
    if (
      !isCount(c.chainId) ||
      !isCount(c.chainLength) ||
      !isCount(c.nextIndex) ||
      c.nextIndex > c.chainLength ||
      typeof c.retired !== 'boolean' ||
      !(c.anchorSignature === null || typeof c.anchorSignature === 'string')
    ) {
      problems.push(`the server's entry for chain ${String(c.chainId)} isn't well-formed`);
      continue;
    }
    const check = c.anchorSignature ? await verifyAnchor(gameId, { ...c, salt: null }, rpcUrl, anchorKey, fetchImpl) : null;
    if (check?.ok && check.commitment && check.slot !== null) {
      verified.push({ chainId: c.chainId, commitment: check.commitment });
      claims.push({ chainId: c.chainId, slot: check.slot });
      const k = check.commitment;
      if (k.houseEdgeBps !== rules.houseEdgeBps) problems.push(`chain ${c.chainId} has a ${k.houseEdgeBps / 100}% edge, not the advertised ${rules.houseEdgeBps / 100}%`);
      if (k.minRoundMs < rules.minRoundMs) problems.push(`chain ${c.chainId} commits to rounds of ${k.minRoundMs} ms, less than the advertised ${rules.minRoundMs} ms`);
      if (k.chainLength < rules.minChainLength) problems.push(`chain ${c.chainId} is ${k.chainLength} rounds long, less than the advertised ${rules.minChainLength}`);
      if (c.retired && c.nextIndex < c.chainLength) problems.push(`chain ${c.chainId} was retired after ${c.nextIndex} of ${c.chainLength} rounds`);
      continue;
    }
    const unplayed = c.nextIndex === 0 && c.retired;
    const newest = c === sorted[sorted.length - 1];
    // Claimed late and never played: wasted, or about to be (the newest chain, before the server retires it).
    if (check?.claimed && check.late && check.slot !== null && c.nextIndex === 0 && (c.retired || newest)) {
      claims.push({ chainId: c.chainId, slot: check.slot }); // a late claim still counts for pace
      continue;
    }
    const claimed = await claimedAddress(fetchImpl, rpcUrl, chainAnchorAddress(anchorKey, gameId, c.chainId));
    if (!claimed && unplayed) continue; // an anchor that never landed: a wasted id
    // The newest chain, nothing played yet, its anchor not finalized: nothing to hide so far. Once a round is
    // played it must verify like any other.
    if (!claimed && c.nextIndex === 0 && !c.retired && newest) continue;
    problems.push(
      claimed
        ? `chain ${c.chainId}'s anchor address was claimed, but not by a valid anchor the server cites${check ? ` (${check.detail})` : ''}`
        : `chain ${c.chainId} was ${c.nextIndex > 0 ? 'played' : 'left active'} without an anchor${check ? ` (${check.detail})` : ''}`,
    );
  }
  // Candidates anchored in advance and held back would show just past the newest listed id.
  const after = sorted.length > 0 && isCount(sorted[sorted.length - 1]!.chainId) ? sorted[sorted.length - 1]!.chainId + 1 : 0;
  for (let id = after; id < after + HELD_BACK_LOOKAHEAD; id++) {
    if (await claimedAddress(fetchImpl, rpcUrl, chainAnchorAddress(anchorKey, gameId, id))) problems.push(`chain ${id} was anchored but the server doesn't list it`);
  }
  // Each verified chain must have had time to be played out before the next claim, whatever came of it.
  for (const v of verified) {
    // The earliest later claim, whatever its id: claiming out of order doesn't avoid the wait.
    const next = claims.filter((c) => c.chainId > v.chainId).reduce<{ chainId: number; slot: number } | null>((a, c) => (a === null || c.slot < a.slot ? c : a), null);
    if (!next) continue;
    const saltBlock = await firstBlockFrom(fetchImpl, rpcUrl, v.commitment.saltSlot);
    const [start, end] = await Promise.all([saltBlock === null ? null : blockTime(fetchImpl, rpcUrl, saltBlock), blockTime(fetchImpl, rpcUrl, next.slot)]);
    if (start === null || end === null) {
      problems.push(`chain ${v.chainId}'s play time couldn't be checked (no block time)`);
      continue;
    }
    // Block times are whole seconds: allow one second either way.
    const neededMs = v.commitment.chainLength * v.commitment.minRoundMs;
    if ((end - start + 1) * 1000 < neededMs) {
      problems.push(`chain ${next.chainId} was anchored ${end - start}s after chain ${v.chainId}'s salt, less than the ${Math.ceil(neededMs / 1000)}s its ${v.commitment.chainLength} rounds take at least`);
    }
  }
  return { ok: problems.length === 0, complete: true, anchors: verified.length, problems };
}

/**
 * Whether the chain's entry in /chains says the same as the chain /rounds served: otherwise the
 * history audit and the rounds check could each be shown a different, passing story. An active chain may have
 * settled more rounds between the two requests.
 */
function listingMismatch(chain: PublishedChain, chains: ChainSummary[]): string | null {
  const listed = chains.find((c) => c.chainId === chain.chainId);
  if (!listed) return `chain ${chain.chainId} isn't in the server's chain history`;
  const fields: (keyof ChainSummary & keyof PublishedChain)[] = ['terminalHash', 'saltSlot', 'salt', 'houseEdgeBps', 'chainLength', 'anchorSignature'];
  const differ = fields.filter((f) => (listed[f] ?? null) !== (chain[f] ?? null));
  const rounds = listed.retired ? listed.nextIndex !== chain.nextIndex : !(typeof listed.nextIndex === 'number' && listed.nextIndex >= (chain.nextIndex ?? 0));
  if (rounds) differ.push('nextIndex');
  const hint = differ.length === 1 && differ[0] === 'nextIndex' && listed.retired ? '; if the chain ended while you were verifying, verify it again' : '';
  return differ.length ? `chain ${chain.chainId}'s entry in the history differs from the chain its rounds came with (${differ.join(', ')})${hint}` : null;
}

/** Pages through a room chain's published rounds and verifies all of them. */
export async function verifyRoomChain(
  baseUrl: string,
  rawGameId: string,
  chainId: number,
  options: { rpcUrl?: string; anchorKey?: string; fetch?: FetchLike; pageSize?: number; maxPages?: number; rules?: ChainRules; onPage?: (state: VerifyState) => void } = {},
): Promise<{
  chain: PublishedChain;
  state: VerifyState;
  salt: Awaited<ReturnType<typeof verifySalt>> | null;
  anchor: AnchorCheck | null;
  history: AnchorAudit | null;
  /** The chain history exactly as checked, or null if it couldn't be fetched (listingError says why). */
  listing: ChainSummary[] | null;
  listingError: string | null;
  /** Where this chain's history entry differs from the chain its rounds came with. */
  consistency: string | null;
}> {
  if (!isCount(chainId)) throw new Error(`chain id ${chainId} is not a whole number`);
  const gameId = rawGameId.toLowerCase();
  const fetchImpl = options.fetch ?? globalFetch();
  const base = baseUrl.replace(/\/$/, '');
  let from: number | null = 0;
  let chain: PublishedChain | null = null;
  let state: VerifyState | null = null;
  // Bounded, and each page must move forward: a server can't keep a verifier paging forever.
  for (let pages = 0; from !== null; pages++) {
    if (pages >= (options.maxPages ?? 2_000)) throw new Error(`the server kept paging past ${pages} pages`);
    const url = `${base}/rooms/${gameId}/chains/${chainId}/rounds?from=${from}&limit=${options.pageSize ?? 1_000}`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
    const page = (await response.json()) as { chain: PublishedChain; rounds: PublishedRound[]; next: number | null };
    if (page.chain.chainId !== chainId) throw new Error(`asked for chain ${chainId}, the server answered with chain ${page.chain.chainId}`);
    chain ??= page.chain;
    state = verifyRounds(chain, page.rounds, state ?? startVerification(chain));
    options.onPage?.(state);
    if (page.next !== null && page.next <= from) throw new Error(`the server's next page (${page.next}) doesn't move past ${from}`);
    from = page.next;
  }
  // The server stopped paging before the rounds it says it settled: the missing ones can't be checked.
  if (chain && state && !state.failures.some((f) => f.reason === 'gap')) {
    if (chain.nextIndex === undefined) {
      state = { ...state, failures: [...state.failures, { roundIndex: state.nextIndex, reason: 'truncated', detail: "the server didn't say how many rounds it settled" }] };
    } else if (state.nextIndex < chain.nextIndex) {
      state = { ...state, failures: [...state.failures, { roundIndex: state.nextIndex, reason: 'truncated', detail: `the server settled ${chain.nextIndex} rounds but served ${state.nextIndex}` }] };
    }
  }
  const salt = options.rpcUrl && chain ? await verifySalt(chain, options.rpcUrl, fetchImpl) : null;
  const anchor = options.rpcUrl && options.anchorKey && chain ? await verifyAnchor(gameId, chain, options.rpcUrl, options.anchorKey, fetchImpl) : null;
  // The chain history, fetched once and returned, so whoever shows or compares it uses the listing that was checked.
  const list = async (): Promise<ChainSummary[]> => {
    const response = await fetchImpl(`${base}/rooms/${gameId}/chains`);
    if (!response.ok) throw new Error(`GET ${base}/rooms/${gameId}/chains: HTTP ${response.status}`);
    const { chains } = (await response.json()) as { chains: ChainSummary[] };
    if (!Array.isArray(chains)) throw new Error("the server's chain history isn't a list");
    return chains;
  };
  let listing: ChainSummary[] | null = null;
  let listingError: string | null = null;
  let history: AnchorAudit | null = null;
  try {
    listing = await list();
    if (options.rpcUrl && options.anchorKey) {
      history = await auditChains(gameId, listing, options.rpcUrl, options.anchorKey, fetchImpl, options.rules);
      // A chain committed between listing and the look-ahead reads as held back: list again once to tell.
      if (history.problems.some((p) => p.endsWith("the server doesn't list it"))) {
        listing = await list();
        history = await auditChains(gameId, listing, options.rpcUrl, options.anchorKey, fetchImpl, options.rules);
      }
    }
  } catch (error) {
    // Reported on its own: a history that can't be checked doesn't take the rounds verdict down with it.
    listingError = `the chain history could not be checked: ${(error as Error).message}`;
    if (options.rpcUrl && options.anchorKey) history = { ok: false, complete: false, anchors: 0, problems: [listingError] };
  }
  // The entry for this chain must match what its rounds came with, in whichever listing was finally checked.
  const consistency = chain && listing ? listingMismatch(chain, listing) : null;
  if (history && consistency) history = { ...history, ok: false, problems: [...history.problems, consistency] };
  return { chain: chain!, state: state!, salt, anchor, history, listing, listingError, consistency };
}
