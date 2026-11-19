// Who holds a token right now: the launcher, the launch pool or curve, burned, and everyone else.
// Read live with one batched JSON-RPC request, so a record always shows what the launcher could
// still sell today.

const SEL = { totalSupply: "18160ddd", balanceOf: "70a08231" };
const DEAD = ["0x000000000000000000000000000000000000dead", "0x0000000000000000000000000000000000000000"];
const word = (a) => a.slice(2).toLowerCase().padStart(64, "0");

/**
 * Shares of `token`'s supply, in basis points of the live total supply.
 * `launcher` and `pools` are addresses; a pool can be a bonding curve or a v4 PoolManager.
 */
export async function holdings(rpcUrl, token, { launcher, pools = [] }) {
  const calls = [
    [token, `0x${SEL.totalSupply}`],
    [token, `0x${SEL.balanceOf}${word(launcher)}`],
    ...pools.map((p) => [token, `0x${SEL.balanceOf}${word(p)}`]),
    ...DEAD.map((d) => [token, `0x${SEL.balanceOf}${word(d)}`]),
  ];
  const body = calls.map(([to, data], id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [{ to, data }, "latest"] }));
  const r = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`rpc ${r.status}`);
  const out = (await r.json()).sort((a, b) => a.id - b.id).map((x) => (x.result && x.result !== "0x" ? BigInt(x.result) : 0n));
  const [supply, mine, ...rest] = out;
  const inPools = rest.slice(0, pools.length).reduce((a, b) => a + b, 0n);
  const burned = rest.slice(pools.length).reduce((a, b) => a + b, 0n);
  if (supply === 0n) return null;
  const bps = (x) => Number((x * 10_000n) / supply);
  const others = supply - mine - inPools - burned;
  return {
    supply: supply.toString(),
    launcherBps: bps(mine),
    poolBps: bps(inPools),
    burnedBps: bps(burned),
    othersBps: bps(others > 0n ? others : 0n),
    launcher: mine.toString(),
  };
}

/** "32.4%" from basis points. */
export const pctText = (bps) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: bps < 100 ? 2 : 1 })}%`;
