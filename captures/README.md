# Captures

Two live checks of the package against a Canton participant, run outside CI with the generators of `generator/`. They are kept here so that they can be checked again. Each vector has the format that `core/tx-hashing/vectors/README.md` of the wallet repository gives.

## `canton-3.6.4-pv36/`

The corpus captured again from a Canton 3.6.4 participant whose synchronizer runs protocol version 36, with the wallet at `26b8eee7` and this repository at `a344991`. Canton ran with the wallet's `canton/devnet/canton.conf` and a copy of `canton/devnet/bootstrap.sc` that sets `testedProtocolVersion` to `ProtocolVersion.v36`. Each of the 67 vectors of `v2/`, `v3/` and `held-out/` names Canton 3.6.4 and protocol version 36 in its `source`, and its `synchronizerId` ends in `::36-0`. `mutation/` and `reject/` are made from `v2/` and `v3/`.

| Run                                        | Last line                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `generate-vectors.ts --execute`            | `v2: 24 written, v3: 31 written, mismatches: 0, executed: 53 ok, refused as expected: 2` |
| `generate-vectors.ts --held-out --execute` | `held-out: 12 written, mismatches: 0, executed: 12 ok, refused as expected: 0`           |
| `mutate-vectors.ts`                        | `mutation: 16 written, reject: 44 written`                                               |
| `python/check_vectors.py`                  | `python v2: 24/24, v3: 31/31, mutation: 16/16, held-out: 12/12, mismatches: 0`           |
| `ts/check-visualizer.ts`                   | `visualizer 1.9.1: accepted 24/24, mutation 7/7, held-out 0/0`                           |

The package gave the participant's hash for all 67 prepare responses. The generator executed each transaction signed over the package's hash, and the participant accepted all but `create-and-exercise` under V2 and V3, which has two roots and is refused on Canton 3.5.10 as well. Compared with the corpus field by field, leaving out the values that differ in every run (contract ids, party fingerprints, times, seeds, key hashes, UUIDs and command ids) and the package ids, the capture differs only in `metadata.synchronizerId`. Its `v2/` and `v3/` vectors name version 0.2.0 of the DAR, as the held-out vectors do. It has 44 reject vectors, since `reject-v3-transaction-lf-3` came later. CI runs both scripts on this folder as on the corpus.

## `pre-1970/`

Four prepare responses whose minimum ledger effective time is 1960-01-01T00:00:00Z, which no accepted vector of the corpus can hold ([VECTORS.md](../VECTORS.md#hashed-by-the-package-and-the-participant-not-by-python)). `generate-vectors.ts --only ledger-time-bounds-pre-1970 --execute` made them, with the wallet at `8011c87d` and this repository at `9d78db0` plus the one scenario of `scenario.diff`: the choice of `ledger-time-bounds` with a lower bound before 1970. It ran under V2 and V3 on Canton 3.5.10 with protocol version 35 (`canton-3.5.10-pv35/`) and on Canton 3.6.4 with protocol version 36 (`canton-3.6.4-pv36/`). Each run ended with `v2: 1 written, v3: 1 written, mismatches: 0, executed: 2 ok, refused as expected: 0`.

In all four the participant wrote `metadata.minLedgerEffectiveTime` as the uint64 2^64 - 315619200000000, the package's hash and the participant's `preparedTransactionHash` agree, and the participant accepted the execution signed over the package's hash. CI does not run this folder: the Python example raises `struct.error` on all four.
