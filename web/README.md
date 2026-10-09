# KEPT website

Static site for KEPT. It reads the vault directly from Robinhood Chain and talks to the
user's wallet; there is no backend. The production build is committed at `../dist/` and is
what gets pinned to IPFS.

```sh
npm install
npm run build      # writes ../dist
npm run dev        # local development
```

Addresses live in `src/config.js` and are filled in once the IMD launches deploy. Any of them
can be overridden from the URL for review or local testing:

```
?vault=0x…&hook=0x…&token=0x…&rpc=http://127.0.0.1:8545&chain=31337
```

`../script/LocalDemo.s.sol` seeds a local anvil chain with pledges in every state
(kept, broken, checking, open) for exactly that.
