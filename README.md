# canton-tx-hashing-conformance

Checks the hash vectors of `@canton-network/core-tx-hashing` against two references whose hashing code is written separately from the package:

- the Python hashing example of Canton v3.5.1, unmodified. It decodes with protobuf (upb), which refuses some malformed encodings that protobuf-ts accepts ([Decoder leniency](VECTORS.md#decoder-leniency) in VECTORS.md).
- the published `@canton-network/core-tx-visualizer` 1.9.1, which hashes V2 only. It decodes with `@canton-network/core-ledger-proto` (protobuf-ts), as the package does, so it checks the V2 hashing but not the decoding.

[VECTORS.md](VECTORS.md) is the reference for the vectors: where the package, Canton's Scala hasher and the Python example differ, what the participant writes, and what each vector covers.

The package and its vectors live in the wallet repository, in `core/tx-hashing/`. These checks and the generators of the vectors live here so that the wallet's CI needs no Python, no protoc, no Canton sources, no old release of the visualizer, no participant and no Daml SDK.

## What is checked

| Script                    | Vectors                                              | Implementation                                                                   |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `python/check_vectors.py` | `v2/`, `v3/`, `mutation/`, `held-out/`               | `daml_transaction_hashing_v2.py` for V2, `daml_transaction_hashing_v3.py` for V3 |
| `ts/check-visualizer.ts`  | the V2 vectors of `v2/`, `mutation/` and `held-out/` | `hashPreparedTransaction` of `@canton-network/core-tx-visualizer` 1.9.1          |

CI runs both scripts on the wallet's vectors and on [`captures/canton-3.6.4-pv36/`](captures/README.md#canton-364-pv36), the corpus captured again on Canton 3.6.4 with protocol version 36.

The Python reference hashes each vector as the example's `interactive_submission.py` does (lines 142-149): `encode_prepared_transaction(prepared_transaction, create_nodes_dict(prepared_transaction))` of the module of the vector's scheme, with its own lookup of nodes and seeds. For it `v2/`, `v3/`, `mutation/` and `held-out/` must hold vectors, and every vector of `held-out/` must be V3, so that a run without the held-out V3 cases fails. The visualizer hashes every vector of `v2/`, `mutation/` and `held-out/` whose scheme is V2 and that has an expected hash, and `v2/` must hold at least one. The held-out vectors are all V3, so it counts `held-out 0/0`, as it does for a missing `mutation/` or `held-out/`.

Each script prints one line of counts, `python v2: N/N, v3: M/M, mutation: K/K, held-out: H/H, mismatches: 0` or `visualizer 1.9.1: accepted N/N, mutation K/K, held-out H/H`. If a vector does not give its expected hash, the script prints its id, or its file name, with both hashes or with the error, and exits non-zero. `check-visualizer.ts` also exits non-zero if the installed visualizer is not 1.9.1.

`reject/` is not run. The Python reference does not make the refusals that the reject vectors expect: it hashes most of them ([where the package differs](VECTORS.md#where-the-package-differs-from-the-scala-hasher-and-the-python-example)). The tests of the package in the wallet repository run them.

## Running locally

Needs Python 3.10 to 3.13 (grpcio-tools 1.70.0 has no wheels for 3.14, setuptools 84.0.0 needs 3.10), Node 24.22.1, curl, and the branch `feat/core-tx-hashing` of the wallet repository checked out next to this repository, as `../wallet`.

```sh
python3.13 -m venv .venv
. .venv/bin/activate
pip install --only-binary :all: --require-hashes -r python/requirements.txt
./python/fetch_reference.sh
python -I python/check_vectors.py ../wallet/core/tx-hashing/vectors
python -I python/check_vectors.py captures/canton-3.6.4-pv36
```

```sh
cd ts
npm ci
node check-visualizer.ts ../../wallet/core/tx-hashing/vectors
node check-visualizer.ts ../captures/canton-3.6.4-pv36
```

`fetch_reference.sh` downloads into a new temporary directory, checks every file against the sha256 pinned in the script, generates the bindings with `grpc_tools.protoc` and only then moves the result to `python/build/`: `reference/` (the three Python files), `proto/` (the `.proto` files) and `gen/` (the bindings). It deletes `python/build/` first, so after any failure there is none. `PYTHON` selects the interpreter, `python3` by default. Python runs with `-I`, so neither the current directory nor the script's directory is on its import path, and `check_vectors.py` adds only `python/build/gen` and `python/build/reference`, at the end. pip installs wheels only and builds nothing from source. `ts/.npmrc` turns off install scripts, and Node 24 runs `check-visualizer.ts` by stripping its types, so `npm ci` installs only the visualizer and its dependencies.

## Generating the vectors

`generator/` holds the tools that made the vectors and the Daml package of their scenarios. They write into `../wallet/core/tx-hashing/vectors/` and change nothing else in the wallet checkout. They import the package's source from `../wallet/core/tx-hashing/src` by relative path, and `generator/tsconfig.json` maps `@canton-network/core-ledger-proto` to `../wallet/core/ledger-proto/src`. The wallet's `tsx`, started in `generator/`, applies that mapping to the generators and to the package's source alike, so each is loaded once, from the wallet checkout. They need `pnpm install` in `../wallet`, with its pnpm 12.15.0.

`mutate-vectors.ts` makes `mutation/` and `reject/` from `v2/` and `v3/`, and needs no participant:

```sh
cd generator
../../wallet/node_modules/.bin/tsx mutate-vectors.ts
```

It fails on a mutation vector that the package refuses or hashes like its accepted vector, and on a reject vector that the package hashes or refuses with another code. For a refusal it prints the code, path and message. A run writes nothing if any vector fails, and otherwise replaces `mutation/` and `reject/` as a whole, so the files of a case it no longer has go. The same accepted vectors always give the same files: the `mutation` job of CI runs it against the wallet branch and fails if it changes a file. The run ends with `mutation: 16 written, reject: 45 written`.

`generate-vectors.ts` captures `v2/` and `v3/` from the local Canton setup of the wallet: Canton 3.5.10, the version `--network=mainnet` selects (`scripts/src/lib/version-config.json`), run with `canton/mainnet/canton.conf` and `canton/mainnet/bootstrap.sc`, which bootstraps the synchronizer with protocol version 35 (paths in `../wallet`). The DAR is built with Daml SDK 3.5.11 from dpm (`generator/daml/daml.yaml`) into `generator/daml/.daml/dist/hash-vectors-0.2.0.dar`, a build output that is not committed. Run `pnpm install`, `pnpm generate:all` and `pnpm script:fetch:canton --network=mainnet` in `../wallet` first. `pnpm start:canton` does not return: it starts Canton under pm2 and keeps printing its log. Run it in terminal 1, and continue in terminal 2 once terminal 1 has printed `WALLET-KERNEL-BOOTSTRAP ParticipantId is:` (`canton/mainnet/bootstrap.sc:123`), which comes after the participant is connected to the synchronizer (`canton/mainnet/bootstrap.sc:114-118`). `/livez` of the JSON API answers 200 earlier, so it does not show that the setup is ready.

```sh
# terminal 1, in ../wallet
pnpm pm2 start ecosystem.config.js --only mock-oauth2-server
pnpm start:canton --network=mainnet

# terminal 2, in this repository, once terminal 1 has printed WALLET-KERNEL-BOOTSTRAP ParticipantId is:
(cd generator/daml && dpm build)
cd generator
../../wallet/node_modules/.bin/tsx generate-vectors.ts --execute
```

- `--execute` executes every transaction as well, signed over the package's hash, not over the participant's: the participant checks each signature against the hash it computes itself. It refuses to execute `create-and-exercise`, as the generator expects.
- `--only <scenario>` runs that scenario only and writes only its vectors.
- `--held-out` runs the scenarios of the held-out vectors in place of the others and writes each vector to `held-out/held-out-v3-<scenario>.json`. It replaces `held-out/` as a whole, touches no other folder and takes no `--only`, as all held-out vectors come from one run.
- `--synchronizer <id>` names the synchronizer to use. Without it the generator stops when the participant is connected to more than one, and names them.

The generator uploads the DAR, onboards two external parties with new Ed25519 keys and runs the scenarios in their order, each after executing what its transaction needs, such as the contract it exercises. A run writes nothing if any vector fails. For a mismatch it prints the scenario with both hashes, and for a refusal by the package its code, path and message. Without `--only` it replaces `v2/` and `v3/`, so the files of a scenario it no longer has go. It never touches `mutation/`, `reject/` or `held-out/`: make `mutation/` and `reject/` again with `mutate-vectors.ts` after it. Until then the package's `src/mutation.test.ts` fails, since it checks that each mutation vector is its accepted vector with one byte changed. Every run makes new parties, contracts and times, so its vectors are new as well, and they name the package id of version 0.2.0 of the DAR. The run ends with a line like `v2: 24 written, v3: 31 written, mismatches: 0, executed: 53 ok, refused as expected: 2`.

Stop the local Canton setup with `pnpm pm2 delete canton mock-oauth2-server` in `../wallet`. Its storage is in memory, so every start begins from an empty ledger. After a change to `HashVectors.daml`, start Canton again before a run: `pnpm start:canton` replaces the running one. The participant refuses a changed DAR under the version of the one it has (`KNOWN_PACKAGE_VERSION`), and under a new version too (`NOT_VALID_UPGRADE_PACKAGE`). A new version must implement the interfaces of the version it upgrades, while the templates of each version of this package implement the interfaces that this version defines itself.

## Vectors from another language

Each vector is a JSON file with the bytes of a prepared transaction, its scheme, and the hash it must give or the error it must be refused with. The [vectors README](https://github.com/nicky2pc/canton-tx-hashing/blob/feat/core-tx-hashing/core/tx-hashing/vectors/README.md) gives the format and the steps in [Running the corpus from another language](https://github.com/nicky2pc/canton-tx-hashing/blob/feat/core-tx-hashing/core/tx-hashing/vectors/README.md#running-the-corpus-from-another-language). `python/check_vectors.py` is a short runner of that kind for the vectors with a hash. Run `reject/` as well: neither implementation here covers it.

## Pinned sources

- `digital-asset/canton` at `8d252e6592354ac244eb65c850c4ef2a9a9b63c2`, the tag `v3.5.1`:
    - `community/app/src/pack/examples/08-interactive-submission/`: `daml_transaction_hashing_common.py`, `daml_transaction_hashing_v2.py`, `daml_transaction_hashing_v3.py`.
    - `community/ledger-api-proto/src/main/protobuf/com/daml/ledger/api/v2/`: `commands.proto`, `crypto.proto`, `event.proto`, `package_reference.proto`, `trace_context.proto`, `transaction.proto`, `transaction_filter.proto`, `interactive/interactive_submission_common_data.proto`, `interactive/interactive_submission_service.proto`, `interactive/transaction/v1/interactive_submission_data.proto`.
    - `community/daml-lf/ledger-api-value-proto/src/main/protobuf/com/daml/ledger/api/v2/value.proto`.
- `googleapis/googleapis` at `3597f7db2191c00b100400991ef96e52d62f5841`: `google/rpc/status.proto`, which `event.proto` imports. The example's `setup.sh` downloads it from the same commit.
- The well-known types `any`, `duration`, `empty` and `timestamp`: the `.proto` files bundled with grpcio-tools, the Python modules of protobuf.
- Python packages, with the hashes of all their files on PyPI in `python/requirements.txt`: grpcio-tools 1.70.0 (protoc 29.0) and protobuf 5.29.3, the versions of the example's `requirements.txt`; grpcio 1.70.0 and setuptools 84.0.0, which grpcio-tools requires.
- npm packages, locked in `ts/package-lock.json`: `@canton-network/core-tx-visualizer` 1.9.1 and `@canton-network/core-ledger-proto` 1.9.1, released with it. The visualizer asks for `^1.9.1`, which would resolve to a newer release, so `ts/package.json` sets 1.9.1 with an `overrides` entry.
- The generators: `tsx` 4.23.15 and the packages they load, from the wallet's `pnpm-lock.yaml`, which the `mutation` job installs with `--frozen-lockfile` and the wallet's pnpm 12.15.0.
- CI: Python 3.13, Node from the wallet's `.nvmrc` (24.22.1), every action pinned to a commit.

## Wallet repository

CI runs on every push to this repository, on a manual run and every Monday at 06:00 UTC, each time against the branch as it is then. GitHub disables the schedule of a public repository after 60 days without activity. Until the branch is public, CI checks it out from the private `nicky2pc/canton-tx-hashing` with the secret `WALLET_REPO_TOKEN`: a fine-grained personal access token with read-only access to the contents of that repository and no other. Once the branch is in a public fork, set `repository` in the three wallet checkouts of `.github/workflows/conformance.yml` to the fork, remove their `token` lines, delete the secret, and point the links in this README to the fork.

## License

Apache License 2.0, in [LICENSE](LICENSE).
