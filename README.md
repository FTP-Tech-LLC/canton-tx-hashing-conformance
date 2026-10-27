# canton-tx-hashing-conformance

The hash vectors of `@canton-network/core-tx-hashing` live in the wallet repository, in `core/tx-hashing/vectors/`, and the package's tests run them.

This repository checks the same vectors against two implementations that share no hashing code with the package. It also holds the tools that captured the vectors from a Canton participant.

| Script                    | Hashes with                                                                       | Vectors                                              |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `python/check_vectors.py` | the Python hashing examples of Canton v3.5.1, unmodified                          | `v2/`, `v3/`, `mutation/`, `held-out/`               |
| `ts/check-visualizer.ts`  | `hashPreparedTransaction` of `@canton-network/core-tx-visualizer` 1.9.1 (V2 only) | the V2 vectors of `v2/`, `mutation/` and `held-out/` |

The visualizer decodes with `@canton-network/core-ledger-proto`, as the package does, so it checks the V2 hashing, not the decoding.

These are the two references that Canton Dev Fund proposal [canton-foundation/canton-dev-fund#617](https://github.com/canton-foundation/canton-dev-fund/pull/617) names. Both scripts also run on [`captures/canton-3.6.4-pv36/`](captures/README.md), the corpus captured again on Canton 3.6.4 with protocol version 36.

`reject/` runs in the package's tests only: the Python example hashes most of it without an error ([where they differ](VECTORS.md#where-the-package-differs)).

## Running the checks

You need Python 3.10 to 3.13, Node 24, curl and a POSIX shell (WSL or Git Bash on Windows). Clone both repositories side by side:

```sh
git clone https://github.com/FTP-Tech-LLC/canton-tx-hashing-conformance
git clone --branch feat/core-tx-hashing https://github.com/FTP-Tech-LLC/wallet
cd canton-tx-hashing-conformance
```

1. Hash the vectors with the Python example:

    ```sh
    python3.13 -m venv .venv  # or python3.10 to python3.12
    . .venv/bin/activate
    pip install --only-binary :all: --require-hashes -r python/requirements.txt
    ./python/fetch_reference.sh
    python -I python/check_vectors.py ../wallet/core/tx-hashing/vectors
    ```

    The last line is `python v2: 24/24, v3: 31/31, mutation: 16/16, held-out: 12/12, mismatches: 0`.

2. Hash the V2 vectors with the visualizer:

    ```sh
    cd ts
    npm ci
    node check-visualizer.ts ../../wallet/core/tx-hashing/vectors
    ```

    The last line is `visualizer 1.9.1: accepted 24/24, mutation 7/7, held-out 0/0`. The held-out vectors are all V3.

For the Canton 3.6.4 capture, run `python -I python/check_vectors.py captures/canton-3.6.4-pv36` and, in `ts/`, `node check-visualizer.ts ../captures/canton-3.6.4-pv36`. They print the same lines. A script that finds a mismatch prints the vector's id with both hashes and exits non-zero.

`fetch_reference.sh` downloads the Python example and its `.proto` files from `digital-asset/canton` at `v3.5.1` (commit `8d252e65`), and `google/rpc/status.proto` from `googleapis/googleapis`, and checks each file against a pinned sha256. `ts/package-lock.json` locks the visualizer and the `core-ledger-proto` 1.9.1 released with it.

## CI

[`conformance.yml`](.github/workflows/conformance.yml) runs on every push and on demand, against the wallet branch:

- `python` and `visualizer`: the two checks above, on the wallet's vectors and on the 3.6.4 capture;
- `mutation`: makes `mutation/` and `reject/` again with `generator/mutate-vectors.ts`, and fails if a file changes.

## More

- [generator/README.md](generator/README.md): how the vectors are captured from a local Canton participant.
- [VECTORS.md](VECTORS.md): what each vector covers, and where the package differs from the Python example and the participant.
- [captures/README.md](captures/README.md): the Canton 3.6.4 capture and the capture with times before 1970.

## License

Apache License 2.0, in [LICENSE](LICENSE).
