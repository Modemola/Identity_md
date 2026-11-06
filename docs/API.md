# KEPT public API

Free and read-only. No key is needed. CORS is open, and responses are cached at the edge for 5 minutes. Every number is read from the KeptVault contract on chain, so nothing here can be edited by hand.

Base URL: `https://keptmd.vercel.app`

## Score: `/api/score`

A team's promise record and one number for it. Use it to show KEPT on a token page, a launchpad listing or a portfolio.

| query | returns |
| --- | --- |
| `?token=0x…` | every pledge that locks this token. Use this when you know a project's token but not its team. |
| `?team=0x…` | every pledge whose beneficiary is this address |
| `&format=svg` | a 20 px badge instead of JSON |

```
GET /api/score?token=0x9b8fd5aa7ac4fe302cb1a50ad90b4900b2924fa3
```
```json
{
  "query": { "token": "0x9b8fd5aa7ac4fe302cb1a50ad90b4900b2924fa3" },
  "score": 75,
  "kept": 2,
  "broken": 0,
  "open": 1,
  "formula": "(kept + 1) / (kept + broken + 2), rounded; null until a promise settles",
  "pledges": [
    {
      "chainId": 4663, "id": 1, "name": "KEPT team roadmap",
      "beneficiary": "0xd333…b016", "token": "0x9b8f…4fa3", "symbol": "KEPT",
      "locked": "150M", "score": 75, "kept": 2, "broken": 0, "open": 1,
      "url": "https://keptmd.vercel.app/#/pledge/1"
    }
  ],
  "checked": [4663]
}
```

**How the score works.** It is the kept rate, starting from one kept and one broken promise: `(kept + 1) / (kept + broken + 2)`, rounded to a whole number. One kept promise scores 67, not 100. Ten kept and none broken scores 92. One broken promise scores 33. A team with no settled promise has `score: null`: no record yet, which is different from a bad one.

**Suggested display:**
- green at 75 and above
- amber from 50 to 74
- red below 50
- grey for `null`

Link to the pledge `url` so people can check the verdicts themselves.

**Badge:**
```html
<img src="https://keptmd.vercel.app/api/score?token=0x…&format=svg" alt="KEPT score">
```

## Record badge: `/api/badge`

| query | returns |
| --- | --- |
| `?pledge=1` | one pledge's record |
| `?team=0x…` | every pledge for that beneficiary |
| `&style=card` | a 440x120 card instead of the 20 px badge |

## Verdict card: `/api/verdict`

One milestone's outcome as a 1200x675 SVG, sized for an X post.

| query | returns |
| --- | --- |
| `?pledge=1&m=0` | milestone 1 of pledge 1 (`m` counts from 0) |
| `&format=json` | the outcome, the numbers and ready-to-post text |

## Chains

Robinhood Chain (4663) is the default. Once KEPT's Ethereum vault is live, `/api/score` includes it automatically, and `&chain=1` selects it on `/api/badge` and `/api/verdict`.
