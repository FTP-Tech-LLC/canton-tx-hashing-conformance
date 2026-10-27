# Generator

The tools that made the vectors in `core/tx-hashing/vectors/` of the wallet repository, and the Daml package of their scenarios in `daml/`. They run the package's source from `../../wallet/core/tx-hashing/src` and write only into `../../wallet/core/tx-hashing/vectors/`.

## Mutation and reject vectors

`mutate-vectors.ts` makes `mutation/` and `reject/` from `v2/` and `v3/`, without a participant. The `mutation` job of CI runs the same commands:

```sh
# in ../../wallet, with pnpm 12.15.0
pnpm install --frozen-lockfile --ignore-scripts \
    --filter wallet-kernel --filter @canton-network/core-ledger-proto
# in this folder
../../wallet/node_modules/.bin/tsx mutate-vectors.ts
git -C ../../wallet status --short core/tx-hashing/vectors
```

The run ends with `mutation: 16 written, reject: 45 written`. From the committed `v2/` and `v3/` it writes the committed files again, so `git status` prints nothing.

A run writes nothing if a mutation vector is refused or keeps the hash of its accepted vector, or if a reject vector is hashed or refused with another code.

## Accepted and held-out vectors

`generate-vectors.ts` captures `v2/` and `v3/` from the wallet's local Canton setup, and `held-out/` with `--held-out`. That setup runs Canton 3.5.10 with protocol version 35. The scenarios use the `hash-vectors` DAR that `daml/` builds with Daml SDK 3.5.11.

1. Prepare the wallet's Canton setup:

    ```sh
    # in ../../wallet
    pnpm install --frozen-lockfile
    pnpm generate:all
    pnpm script:fetch:canton --network=mainnet
    ```

    `pnpm generate:all` installs `dpm`, the Daml package manager, and downloads the Splice LocalNet, about 800 MB. It took 5-7 minutes.

2. In terminal 1, start the mock OAuth2 server and Canton:

    ```sh
    # in ../../wallet
    pnpm pm2 start ecosystem.config.js --only mock-oauth2-server
    pnpm start:canton --network=mainnet
    ```

    `pnpm start:canton` keeps running and prints Canton's log. Wait for `WALLET-KERNEL-BOOTSTRAP ParticipantId is:`, which comes once the participant is connected to the synchronizer.

3. In a new terminal 2, so that `dpm` is on its `PATH`, build the DAR and run the generator:

    ```sh
    # in this folder
    (cd daml && dpm build)
    ../../wallet/node_modules/.bin/tsx generate-vectors.ts --execute
    ../../wallet/node_modules/.bin/tsx generate-vectors.ts --held-out --execute
    ```

    The two runs end with:

    ```
    v2: 24 written, v3: 31 written, mismatches: 0, executed: 53 ok, refused as expected: 2
    held-out: 12 written, mismatches: 0, executed: 12 ok, refused as expected: 0
    ```

4. The new files differ from the committed ones, as every run makes new parties, contracts and times. The result is `mismatches: 0` and the executions. To go back to the committed vectors:

    ```sh
    git -C ../../wallet checkout -- core/tx-hashing/vectors
    ```

    To keep the new ones instead, run `mutate-vectors.ts` again. Until then the package's mutation test fails.

5. Stop Canton. Its storage is in memory, so the next start begins with an empty ledger.

    ```sh
    # in ../../wallet
    pnpm pm2 delete canton mock-oauth2-server
    ```

Options of `generate-vectors.ts`:

- `--execute`: also executes each transaction, signed over the package's hash. The participant checks the signature against the hash it computes itself. It refuses to execute `create-and-exercise`, which has two roots, as the generator expects.
- `--only <scenario>`: runs one scenario.
- `--held-out`: runs the held-out scenarios and replaces `held-out/`.
- `--synchronizer <id>`: the synchronizer to use, if the participant is connected to more than one.

A run writes nothing if the package gives another hash than the participant for any prepare response.

## Changing `HashVectors.daml`

The participant refuses a changed DAR next to the one it has, with the same version or a new one. So after a change, start Canton again: `pnpm start:canton` replaces the running one, with an empty ledger.
