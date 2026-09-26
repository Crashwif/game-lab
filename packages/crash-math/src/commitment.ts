/**
 * What a room commits to on Solana for each chain, and where.
 *
 * The anchor transaction, signed by the operator's published anchor key, does
 * two things at once:
 *
 * 1. It allocates a deterministic address, create_with_seed(anchor key,
 *    chainAnchorSeed(game, chain), Memo program), as a one-byte account owned
 *    by the Memo program. The System program only allocates an account that
 *    is still its own and empty, and the Memo program never gives accounts
 *    back, so this succeeds exactly once. Each (game, chain id) has at most
 *    one anchor, ever. An operator can't anchor several
 *    candidates and keep the one the salt favours, and padding the key's
 *    history hides nothing, because a verifier never scans it.
 * 2. It carries the commitment as a memo: terminal hash, salt slot, edge,
 *    chain length and the minimum time a round takes. Verifiers check that
 *    the transaction the room cites made that allocation, says exactly this,
 *    and landed before the salt slot.
 *
 * The minimum round time makes abandoning a chain cost real time: a chain's
 * successor can't be anchored before its predecessor could have been played
 * out, which anyone can check from Solana's block times.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
/** Longest chain a commitment may name (bounds a verifier's hashing). */
export const MAX_CHAIN_LENGTH = 1_000_000;
/** Rounds are advertised to take at least this long; a chain committing to less is flagged. */
export const ADVERTISED_MIN_ROUND_MS = 10_000;

export interface ChainCommitment {
  chainId: number;
  terminalHash: string;
  saltSlot: number;
  houseEdgeBps: number;
  chainLength: number;
  /** Betting window plus the pause after a crash: no round is shorter. */
  minRoundMs: number;
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Decode(text: string): Uint8Array {
  let n = 0n;
  for (const c of text) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error(`not base58: ${text}`);
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const c of text) {
    if (c !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

/** Solana's Pubkey::create_with_seed: sha256(base || seed || owner). */
export function createWithSeed(base: string, seed: string, owner: string): string {
  const baseBytes = base58Decode(base);
  const ownerBytes = base58Decode(owner);
  if (baseBytes.length !== 32 || ownerBytes.length !== 32) throw new Error('not a 32-byte address');
  if (utf8ToBytes(seed).length > 32) throw new Error('seed longer than 32 bytes');
  return base58Encode(sha256(concatBytes(baseBytes, utf8ToBytes(seed), ownerBytes)));
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** Whether every field is what a commitment can hold: whole, non-negative, in range. */
export function validCommitment(c: ChainCommitment): boolean {
  return (
    isCount(c.chainId) &&
    /^[0-9a-f]{64}$/.test(c.terminalHash) &&
    isCount(c.saltSlot) &&
    isCount(c.houseEdgeBps) &&
    c.houseEdgeBps >= 1 &&
    c.houseEdgeBps <= 5_000 &&
    isCount(c.chainLength) &&
    c.chainLength >= 1 &&
    c.chainLength <= MAX_CHAIN_LENGTH &&
    isCount(c.minRoundMs)
  );
}

/** The seed of a chain's anchor address: 32 hex characters, the most create_with_seed accepts. */
export function chainAnchorSeed(gameId: string, chainId: number): string {
  if (!isCount(chainId)) throw new Error(`chain id ${chainId} is not a whole number`);
  return bytesToHex(sha256(utf8ToBytes(`crashwif-chain:${gameId}:${chainId}`))).slice(0, 32);
}

/** The address the anchor transaction allocates for the Memo program, once, for this chain. */
export function chainAnchorAddress(anchorKey: string, gameId: string, chainId: number): string {
  return createWithSeed(anchorKey, chainAnchorSeed(gameId, chainId), MEMO_PROGRAM);
}

export function chainAnchorMemo(gameId: string, c: ChainCommitment): string {
  if (!validCommitment(c)) throw new Error(`chain ${c.chainId}: not a valid commitment`);
  return `crashwif-chain:v3:${gameId}:${c.chainId}:${c.terminalHash}:${c.saltSlot}:${c.houseEdgeBps}:${c.chainLength}:${c.minRoundMs}`;
}

const MEMO_V3 = /^crashwif-chain:v3:([0-9a-f-]{36}):(0|[1-9]\d{0,15}):([0-9a-f]{64}):(0|[1-9]\d{0,15}):([1-9]\d{0,3}):([1-9]\d{0,6}):(0|[1-9]\d{0,15})$/;

/** The commitment a memo states, or null when it isn't exactly a v3 commitment. */
export function parseChainAnchorMemo(text: string): (ChainCommitment & { gameId: string }) | null {
  const m = MEMO_V3.exec(text);
  if (!m) return null;
  const c = { gameId: m[1]!, chainId: Number(m[2]), terminalHash: m[3]!, saltSlot: Number(m[4]), houseEdgeBps: Number(m[5]), chainLength: Number(m[6]), minRoundMs: Number(m[7]) };
  return validCommitment(c) ? c : null;
}
