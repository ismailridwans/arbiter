import type { Broker, Fill, OrderBook, Position, SizedOrder } from '../types';
import type { PolymarketClient } from '../polymarket/client';
import { simulateBuy, feeUsd } from '../coherence/pricing';

/**
 * Paper broker: fills orders by walking the LIVE order book — so simulated fills
 * reflect real available liquidity and slippage — but commits no on-chain
 * capital. Each leg is a BUY of `order.token` (the YES or NO token the strategy
 * chose); a market-neutral arb is expressed as a basket of such buys.
 */
export class PaperBroker implements Broker {
  readonly mode = 'paper' as const;
  private readonly positions = new Map<string, Position>();
  private feesUsd = 0;
  private investedUsd = 0;

  constructor(
    private readonly client: PolymarketClient,
    private readonly takerFeeBps: number,
  ) {}

  getBook(tokenId: string): Promise<OrderBook> {
    return this.client.fetchOrderBook(tokenId);
  }

  async submit(order: SizedOrder): Promise<Fill> {
    const book = await this.client.fetchOrderBook(order.token.tokenId);
    const res = simulateBuy(book, order.size);
    const fee = feeUsd(res.cash, this.takerFeeBps);
    this.feesUsd += fee;
    this.investedUsd += res.cash + fee;
    this.record(order, res.filled, res.cash);
    return {
      order,
      filledSize: res.filled,
      avgPrice: res.avgPrice,
      costUsd: res.cash,
      feeUsd: fee,
      timestamp: Date.now(),
      simulated: true,
    };
  }

  private record(order: SizedOrder, filled: number, cash: number): void {
    if (filled <= 0) return;
    const prev = this.positions.get(order.token.tokenId);
    const shares = (prev?.shares ?? 0) + filled;
    const costUsd = (prev?.costUsd ?? 0) + cash;
    this.positions.set(order.token.tokenId, {
      tokenId: order.token.tokenId,
      market: order.market.question,
      outcome: order.token.outcome,
      shares,
      avgPrice: shares > 0 ? costUsd / shares : 0,
      costUsd,
    });
  }

  getPositions(): Position[] {
    return [...this.positions.values()];
  }
  getFeesUsd(): number {
    return this.feesUsd;
  }
  getInvestedUsd(): number {
    return this.investedUsd;
  }
}
