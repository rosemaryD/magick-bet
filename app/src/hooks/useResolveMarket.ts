import { useState, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import idl from '../idl/oracle_bet.json';
import { DELEGATION_PROGRAM, ER_RPC, ER_WS_RPC, L1_RPC, MAGIC_PROGRAM, PYTH_LAZER_STORAGE } from '../constants';
import { ensureErFeeBootstrap } from '../lib/erFeeBootstrap';
import { deriveMagicContextPda } from '../lib/pda';

interface ResolveParams {
  marketId: bigint;
  marketPubkey: PublicKey;
}

function isResolvedStatus(data: Buffer): boolean {
  try {
    let offset = 8 + 8 + 32;
    const questionLen = data.readUInt32LE(offset);
    offset += 4 + questionLen;
    offset += 8 + 8 + 8 + 8;
    const statusVal = data.readUInt8(offset);
    return statusVal === 1;
  } catch {
    return false;
  }
}

function normalizeResolveError(error: unknown): string {
  if (!(error instanceof Error)) return 'Failed to resolve market';

  if (error.message.includes('Unauthorized')) {
    return 'Only the market creator can resolve this market.';
  }
  if (error.message.includes('ResolutionTimeNotReached')) {
    return 'Resolution time is not reached yet.';
  }
  if (error.message.includes('must be delegated to ER')) {
    return error.message;
  }
  if (error.message.includes('InvalidAccountForFee')) {
    return 'ER fee account is not ready. Retry in a few seconds.';
  }
  if (error.message.includes('WalletSignTransactionError')) {
    return 'Wallet rejected signing. Please approve the transaction in your wallet.';
  }
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'RPC is unreachable. Check your network and retry.';
  }

  return error.message;
}

export function useResolveMarket() {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async ({ marketId, marketPubkey }: ResolveParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        setError('Wallet not connected');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const l1Connection = new Connection(L1_RPC, 'confirmed');
        const l1MarketInfo = await l1Connection.getAccountInfo(marketPubkey, 'confirmed');
        if (!l1MarketInfo) {
          throw new Error('Market not found on L1');
        }
        if (!l1MarketInfo.owner.equals(DELEGATION_PROGRAM)) {
          throw new Error('Market must be delegated to ER before resolve.');
        }

        const bootstrap = await ensureErFeeBootstrap({
          connection: l1Connection,
          publicKey: wallet.publicKey,
          sendTransaction: wallet.sendTransaction,
        });
        if (bootstrap.toppedUp || bootstrap.delegated) {
          console.info(
            `[ER_FEE] escrow=${bootstrap.escrowPda.toBase58()} toppedUp=${bootstrap.toppedUp} delegated=${bootstrap.delegated}`,
          );
        }

        const erConnection = new Connection(ER_RPC, {
          commitment: 'confirmed',
          wsEndpoint: ER_WS_RPC,
        });
        const provider = new AnchorProvider(
          erConnection,
          wallet as unknown as Wallet,
          { commitment: 'confirmed', skipPreflight: true },
        );
        const program = new Program(idl as any, provider);

        const magicContext = deriveMagicContextPda();

        const tx = await (program.methods as any)
          .resolveMarket(new BN(marketId.toString()))
          .accounts({
            market: marketPubkey,
            priceFeed: PYTH_LAZER_STORAGE,
            magicContext,
            magicProgram: MAGIC_PROGRAM,
            resolver: wallet.publicKey,
          })
          .transaction();

        const { blockhash, lastValidBlockHeight } = await erConnection.getLatestBlockhash('confirmed');
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = blockhash;
        const signedTx = await wallet.signTransaction(tx);
        const sig = await erConnection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
        });
        const confirmation = await erConnection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        if (confirmation.value.err) {
          throw new Error(`resolve_market failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.info('[TX] resolve_market submitted:', sig);

        const startTime = Date.now();
        const maxWait = 60_000;
        const pollInterval = 2_000;

        await new Promise<void>((resolvePromise, reject) => {
          const poll = async () => {
            if (Date.now() - startTime > maxWait) {
              reject(new Error('Timeout waiting for market to resolve on L1'));
              return;
            }

            try {
              const accountInfo = await l1Connection.getAccountInfo(marketPubkey);
              if (accountInfo && isResolvedStatus(accountInfo.data as Buffer)) {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                console.info(`[ER_SYNC] Market state synced to L1 in ${elapsed}s`);
                resolvePromise();
                return;
              }
            } catch {
              // Continue polling.
            }

            setTimeout(poll, pollInterval);
          };

          void poll();
        });
      } catch (e) {
        setError(normalizeResolveError(e));
      } finally {
        setIsLoading(false);
      }
    },
    [wallet],
  );

  return { resolve, isLoading, error };
}
