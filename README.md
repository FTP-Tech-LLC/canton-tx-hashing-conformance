# canton-tx-hashing-conformance

Checks the hash vectors of `@canton-network/core-tx-hashing` against two implementations that share no hashing code with it:

- Canton's Python hashing example (V2 and V3);
- the published `@canton-network/core-tx-visualizer` 1.9.1 (V2), the release that the acceptance criteria of Canton Dev Fund proposal [canton-foundation/canton-dev-fund#617](https://github.com/canton-foundation/canton-dev-fund/pull/617) name.

The package and its vectors live in `core/tx-hashing/` of the wallet repository. [VECTORS.md](VECTORS.md) is the reference for the vectors. It says where the package, Canton's Scala hasher and the Python example differ, what the participant writes, and what each vector covers.

These checks and the generators of the vectors live here, not in the wallet. So the wallet's CI needs no Python, protoc, Canton sources, old visualizer release, participant or Daml SDK.

## What is checked

| Script                    | Reference                                                                                                                                 | Vectors                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `python/check_vectors.py` | The Python hashing example of Canton v3.5.1, unmodified: `daml_transaction_hashing_v2.py` for V2, `daml_transaction_hashing_v3.py` for V3 | `v2/`, `v3/`, `mutation/`, `held-out/`               |
| `ts/check-visualizer.ts`  | `hashPreparedTransaction` of the published `@canton-network/core-tx-visualizer` 1.9.1, which hashes V2 only                               | the V2 vectors of `v2/`, `mutation/` and `held-out/` |

The Python example decodes with upb, which refuses some malformed encodings that protobuf-ts accepts ([Decoder leniency](VECTORS.md#decoder-leniency)). The visualizer decodes with `@canton-network/core-ledger-proto`, as the package does, so it checks the V2 hashing, not the decoding.

CI runs both scripts on the wallet's vectors and on [`captures/canton-3.6.4-pv36/`](captures/README.md#canton-364-pv36), the corpus captured again on Canton 3.6.4 with protocol version 36.

`reject/` is not run. The Python example does not make the refusals that the reject vectors expect: it hashes most of them ([where the package differs](VECTORS.md#where-the-package-differs-from-the-scala-hasher-and-the-python-example)). The tests of the package in the wallet repository run them.

## Running locally

You need:

- Python 3.10 to 3.13. grpcio-tools 1.70.0 has no wheels for 3.14, and setuptools 84.0.0 needs 3.10.
- Node 24.22.1 and curl.
- A POSIX shell. On Windows, run the commands in WSL or Git Bash.
- The branch `feat/core-tx-hashing` of the wallet repository, checked out next to this repository as `../wallet`.

To clone both side by side:

```sh
git clone https://github.com/FTP-Tech-LLC/canton-tx-hashing-conformance
git clone --branch feat/core-tx-hashing https://github.com/FTP-Tech-LLC/wallet wallet
cd canton-tx-hashing-conformance
```

Run, from this repository:

1. Install the pinned Python packages in a virtual environment:

    ```sh
    python3.13 -m venv .venv  # or python3.10 to python3.12
    . .venv/bin/activate
    pip install --only-binary :all: --require-hashes -r python/requirements.txt
    ```

2. Fetch the Python example and generate its bindings:

    ```sh
    ./python/fetch_reference.sh
    ```

    It ends with `reference and bindings in <this repository>/python/build`.

3. Hash the wallet's vectors and the Canton 3.6.4 capture with the Python example:

    ```sh
    python -I python/check_vectors.py ../wallet/core/tx-hashing/vectors
    python -I python/check_vectors.py captures/canton-3.6.4-pv36
    ```

    Each prints `python v2: 24/24, v3: 31/31, mutation: 16/16, held-out: 12/12, mismatches: 0`.

4. Install the visualizer and hash the V2 vectors with it:

    ```sh
    cd ts
    npm ci
    node check-visualizer.ts ../../wallet/core/tx-hashing/vectors
    node check-visualizer.ts ../captures/canton-3.6.4-pv36
    ```

    Each prints `visualizer 1.9.1: accepted 24/24, mutation 7/7, held-out 0/0`.

### What a run checks

- If a vector does not give its expected hash, the script prints its id, or its file name, with both hashes or with the error. It then exits non-zero.
- `check_vectors.py` needs vectors in `v2/`, `v3/`, `mutation/` and `held-out/`, and every vector of `held-out/` must be V3. So a run without the held-out V3 cases fails.
- `check-visualizer.ts` hashes every vector of `v2/`, `mutation/` and `held-out/` whose scheme is V2 and that has an expected hash. `v2/` must hold at least one.
- The held-out vectors are all V3, so the visualizer counts `held-out 0/0`. It counts the same for a missing `mutation/` or `held-out/`.
- `check-visualizer.ts` also exits non-zero if the installed visualizer is not 1.9.1.

### Script details

- `check_vectors.py` hashes each vector as the example's `interactive_submission.py` does (lines 142-149). It calls `encode_prepared_transaction(prepared_transaction, create_nodes_dict(prepared_transaction))` of the module for the vector's scheme, so the example looks up the nodes and seeds itself.
- `fetch_reference.sh` checks every file it downloads against the sha256 pinned in the script. It deletes `python/build/` first and writes it only if every step passes, so after any failure there is none.
- `PYTHON` selects the interpreter of `fetch_reference.sh`, `python3` by default.
- pip installs wheels only and builds nothing from source. Python runs with `-I`, so neither the current directory nor the script's directory is on its import path.
- `ts/.npmrc` turns off install scripts. Node 24 runs `check-visualizer.ts` by stripping its types, so `npm ci` installs only the visualizer and its dependencies.

## Generating the vectors

`generator/` holds the tools that made the vectors and the Daml package of their scenarios. They write into `../wallet/core/tx-hashing/vectors/` and change nothing else in the wallet checkout.

The generators run the package's source from `../wallet/core/tx-hashing/src`. `generator/tsconfig.json` maps `@canton-network/core-ledger-proto` to `../wallet/core/ledger-proto/src`, and the wallet's `tsx`, started in `generator/`, applies that mapping.

### Mutation and reject vectors

`mutate-vectors.ts` makes `mutation/` and `reject/` from `v2/` and `v3/`, and needs no participant.

1. Install the wallet's `tsx` and the dependencies of `@canton-network/core-ledger-proto`, as the `mutation` job of CI does, with the wallet's pnpm 12.15.0:

    ```sh
    # in ../wallet
    pnpm install --frozen-lockfile --ignore-scripts --filter wallet-kernel --filter @canton-network/core-ledger-proto
    ```

2. Make the vectors and compare them with the committed ones:

    ```sh
    cd generator
    ../../wallet/node_modules/.bin/tsx mutate-vectors.ts
    git -C ../../wallet status --short core/tx-hashing/vectors
    ```

    The run ends with `mutation: 16 written, reject: 45 written`. On the committed `v2/` and `v3/` it writes the committed files again, so `git -C ../../wallet status --short core/tx-hashing/vectors` then prints nothing. The `mutation` job of CI checks the same.

- It fails on a mutation vector that the package refuses or hashes like its accepted vector. It also fails on a reject vector that the package hashes or refuses with another code.
- For a refusal it prints the code, path and message.
- A run writes nothing if any vector fails. Otherwise it replaces `mutation/` and `reject/` as a whole, so the files of a case it no longer has go.

### Accepted and held-out vectors

`generate-vectors.ts` captures `v2/` and `v3/` from the local Canton setup of the wallet, and `held-out/` with `--held-out`.

| Part   | What the generator uses                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canton | 3.5.10, the version `--network=mainnet` selects (`scripts/src/lib/version-config.json` in `../wallet`)                                                     |
| Setup  | `canton/mainnet/canton.conf` and `canton/mainnet/bootstrap.sc` in `../wallet`. The bootstrap gives the synchronizer protocol version 35.                   |
| DAR    | `generator/daml/.daml/dist/hash-vectors-0.2.0.dar`, built with Daml SDK 3.5.11 from dpm (`generator/daml/daml.yaml`). It is a build output, not committed. |

1. Prepare the wallet's Canton setup:

    ```sh
    # in ../wallet
    pnpm install --frozen-lockfile
    pnpm generate:all
    pnpm script:fetch:canton --network=mainnet
    ```

    `pnpm generate:all` installs `dpm`, the Daml package manager, unless it is there, and downloads the Splice LocalNet, about 800 MB. It took 5-7 minutes in the two capture runs. Open terminal 2 after it, so that `dpm` is on its `PATH`.

2. In terminal 1, start the mock OAuth2 server and Canton:

    ```sh
    # terminal 1, in ../wallet
    pnpm pm2 start ecosystem.config.js --only mock-oauth2-server
    pnpm start:canton --network=mainnet
    ```

    `pnpm start:canton` does not return: it starts Canton under pm2 and keeps printing its log. Wait until it prints `WALLET-KERNEL-BOOTSTRAP ParticipantId is:` (`canton/mainnet/bootstrap.sc:123`).

    That line comes after the participant is connected to the synchronizer (`canton/mainnet/bootstrap.sc:114-118`). `/livez` of the JSON API answers 200 earlier, so it does not show that the setup is ready.

3. In terminal 2, build the DAR and run the generator:

    ```sh
    # terminal 2, in this repository
    (cd generator/daml && dpm build)
    cd generator
    ../../wallet/node_modules/.bin/tsx generate-vectors.ts --execute
    ../../wallet/node_modules/.bin/tsx generate-vectors.ts --held-out --execute
    ```

    The two runs end with lines like these:

    ```
    v2: 24 written, v3: 31 written, mismatches: 0, executed: 53 ok, refused as expected: 2
    held-out: 12 written, mismatches: 0, executed: 12 ok, refused as expected: 0
    ```

4. Keep or drop the new vectors. They differ from the committed ones, as every run makes new parties, contracts and times. So the result is `mismatches: 0` and the executions, not the files.

    To keep them, make `mutation/` and `reject/` again with [`mutate-vectors.ts`](#mutation-and-reject-vectors). Until then the package's `src/mutation.test.ts` fails: it checks that each mutation vector is its accepted vector with one byte changed.

    To go back to the committed vectors:

    ```sh
    git -C ../../wallet checkout -- core/tx-hashing/vectors
    ```

5. Stop the local Canton setup:

    ```sh
    # in ../wallet
    pnpm pm2 delete canton mock-oauth2-server
    ```

    Its storage is in memory, so every start begins from an empty ledger.

Options of `generate-vectors.ts`:

- `--execute` executes every transaction as well, signed over the package's hash, not over the participant's. The participant checks each signature against the hash it computes itself. It refuses to execute `create-and-exercise`, as the generator expects.
- `--only <scenario>` runs that scenario only and writes only its vectors.
- `--held-out` runs the scenarios of the held-out vectors in place of the others, and writes each vector to `held-out/held-out-v3-<scenario>.json`. It replaces `held-out/` as a whole, touches no other folder and takes no `--only`, as all held-out vectors come from one run.
- `--synchronizer <id>` names the synchronizer to use. Without it the generator stops when the participant is connected to more than one, and names them.

What a run does:

- The generator uploads the DAR, onboards two external parties with new Ed25519 keys and runs the scenarios in their order. Each runs after the generator has executed what its transaction needs, such as the contract it exercises.
- A run writes nothing if any vector fails. For a mismatch it prints the scenario with both hashes, and for a refusal by the package its code, path and message.
- Without `--only` it replaces `v2/` and `v3/`, so the files of a scenario it no longer has go. A run without `--held-out` never touches `mutation/`, `reject/` or `held-out/`.
- The new vectors name the package id of version 0.2.0 of the DAR.

### Changing HashVectors.daml

The participant refuses a changed DAR next to the one it has: with the same version (`KNOWN_PACKAGE_VERSION`) and with a new one (`NOT_VALID_UPGRADE_PACKAGE`). An upgrade must implement the interfaces of the version it upgrades, and each version of this package implements only the interfaces it defines itself.

So after a change to `HashVectors.daml`, start Canton again: `pnpm start:canton` replaces the running one, and its ledger starts empty.

## Vectors from another language

Each vector is a JSON file with the bytes of a prepared transaction and its scheme. It also holds the hash it must give, or the error it must be refused with. The [vectors README](https://github.com/nicky2pc/canton-tx-hashing/blob/feat/core-tx-hashing/core/tx-hashing/vectors/README.md) gives the format and the steps, in [Running the corpus from another language](https://github.com/nicky2pc/canton-tx-hashing/blob/feat/core-tx-hashing/core/tx-hashing/vectors/README.md#running-the-corpus-from-another-language).

`python/check_vectors.py` is a short runner of that kind for the vectors with a hash. Run `reject/` as well: neither implementation here covers it.

## Pinned sources

| Source                                                       | Pinned to                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Python example and the `.proto` files                    | `digital-asset/canton` at `8d252e6592354ac244eb65c850c4ef2a9a9b63c2`, the tag `v3.5.1`. The files are listed below.                                                                                                                             |
| `google/rpc/status.proto`, which `event.proto` imports       | `googleapis/googleapis` at `3597f7db2191c00b100400991ef96e52d62f5841`. The example's `setup.sh` downloads it from the same commit.                                                                                                              |
| The well-known types `any`, `duration`, `empty`, `timestamp` | The `.proto` files bundled with grpcio-tools, the Python modules of protobuf.                                                                                                                                                                   |
| Python packages                                              | grpcio-tools 1.70.0 (protoc 29.0) and protobuf 5.29.3, the versions of the example's `requirements.txt`. grpcio 1.70.0 and setuptools 84.0.0, which grpcio-tools requires. `python/requirements.txt` has the hashes of all their files on PyPI. |
| npm packages                                                 | `@canton-network/core-tx-visualizer` 1.9.1 and `@canton-network/core-ledger-proto` 1.9.1, released with it, locked in `ts/package-lock.json`.                                                                                                   |
| The generators                                               | `tsx` 4.23.15 and the packages they load, from the wallet's `pnpm-lock.yaml`. The `mutation` job installs them with `--frozen-lockfile` and the wallet's pnpm 12.15.0.                                                                          |
| CI                                                           | Python 3.13, Node from the wallet's `.nvmrc` (24.22.1), every action pinned to a commit.                                                                                                                                                        |

The visualizer asks for `@canton-network/core-ledger-proto` `^1.9.1`, which would resolve to a newer release. So `ts/package.json` sets 1.9.1 with an `overrides` entry.

The files from `digital-asset/canton`:

- `community/app/src/pack/examples/08-interactive-submission/`: `daml_transaction_hashing_common.py`, `daml_transaction_hashing_v2.py`, `daml_transaction_hashing_v3.py`.
- `community/ledger-api-proto/src/main/protobuf/com/daml/ledger/api/v2/`: `commands.proto`, `crypto.proto`, `event.proto`, `package_reference.proto`, `trace_context.proto`, `transaction.proto`, `transaction_filter.proto`, `interactive/interactive_submission_common_data.proto`, `interactive/interactive_submission_service.proto`, `interactive/transaction/v1/interactive_submission_data.proto`.
- `community/daml-lf/ledger-api-value-proto/src/main/protobuf/com/daml/ledger/api/v2/value.proto`.

## CI

CI runs three jobs on every push, on a manual run and every Monday at 06:00 UTC. Each run checks the wallet branch as it is then.

- `python` and `visualizer` run the two scripts on the wallet's vectors and on `captures/canton-3.6.4-pv36/`.
- `mutation` runs `mutate-vectors.ts` and fails if it changes a file of `mutation/` or `reject/`.

GitHub disables the schedule of a public repository after 60 days without activity.

## License

Apache License 2.0, in [LICENSE](LICENSE).
