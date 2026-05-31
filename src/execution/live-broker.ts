import { spawn } from 'node:child_process';
import type { Broker, Fill, OrderBook, Position, SizedOrder } from '../types';
import type { PolymarketClient } from '../polymarket/client';

/**
 * Live execution path for the Polymarket CLOB. It constructs the exact signed
 * order request each leg would place. By default it runs in DRY-RUN: it builds
 * and logs the order but does NOT transmit it — so the live path is fully wired
 * and inspectable without a funded wallet, credentials, or any capital at risk.
 *
 * Real submission requires a funded Polygon wallet + `@polymarket/clob-client`
 * and is intentionally gated behind `dryRun = false` (see README "Live execution").
 */

export interface ClobOrderRequest {
  tokenId: string;
  /** We always BUY the chosen token (a YES or NO leg of a market-neutral basket). */
  side: 'BUY';
  /** Worst acceptable price from the book walk (the limit). */
  price: number;
  size: number;
  orderType: 'FOK' | 'GTC';
}

/** Build the CLOB order request for a sized leg. Pure + unit-tested. */
export function buildClobOrder(order: SizedOrder): ClobOrderRequest {
  return {
    tokenId: order.token.tokenId,
    side: 'BUY',
    price: order.limitPrice,
    size: order.size,
    orderType: 'FOK',
  };
}

/**
 * Map a sized leg to Canon's real `canon-cli order create` arguments. On-chain
 * broadcast (wallet, signing, gasless onboarding) is handled by Canon's CLI —
 * Arbiter's job is to decide WHAT to trade; Canon executes it.
 */
export function toCanonOrderArgs(order: SizedOrder): string[] {
  return [
    'order',
    'create',
    '--token-id',
    order.token.tokenId,
    '--side',
    'buy',
    '--size',
    String(order.size),
    '--price',
    String(order.limitPrice),
    '--type',
    'limit',
  ];
}

export function canonOrderCommand(order: SizedOrder, bin = 'canon-cli'): string {
  return [bin, ...toCanonOrderArgs(order)].join(' ');
}

export class LiveBroker implements Broker {
  readonly mode = 'live' as const;
  private readonly canonBin: string | undefined;

  constructor(
    private readonly client: PolymarketClient,
    private readonly dryRun = true,
    canonBin: string | undefined = process.env.CANON_CLI,
  ) {
    this.canonBin = canonBin;
  }

  getBook(tokenId: string): Promise<OrderBook> {
    return this.client.fetchOrderBook(tokenId);
  }

  async submit(order: SizedOrder): Promise<Fill> {
    const cmd = canonOrderCommand(order, this.canonBin ?? 'canon-cli');
    // Dry-run (default) — or no canon-cli configured — logs the exact command and
    // commits nothing. The pipeline still records the order intent.
    if (this.dryRun || !this.canonBin) {
      console.warn('[live:dry-run] would execute via Canon → ' + cmd);
      return {
        order,
        filledSize: 0,
        avgPrice: order.limitPrice,
        costUsd: 0,
        feeUsd: 0,
        timestamp: Date.now(),
        simulated: false,
      };
    }
    return this.execViaCanon(order);
  }

  /** Real on-chain execution via Canon's `canon-cli` (wallet + signing + broadcast). */
  private execViaCanon(order: SizedOrder): Promise<Fill> {
    const bin = this.canonBin!;
    const args = toCanonOrderArgs(order);
    return new Promise<Fill>((resolve, reject) => {
      const child = spawn(bin, args, { env: process.env });
      let stderr = '';
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            order,
            filledSize: order.size,
            avgPrice: order.limitPrice,
            costUsd: order.size * order.limitPrice,
            feeUsd: 0,
            timestamp: Date.now(),
            simulated: false,
          });
        } else {
          reject(new Error(`canon-cli order exited ${code}: ${stderr.trim()}`));
        }
      });
    });
  }

  // Parity with PaperBroker so the run loop can treat brokers uniformly.
  getPositions(): Position[] {
    return [];
  }
  getInvestedUsd(): number {
    return 0;
  }
  getFeesUsd(): number {
    return 0;
  }
}
