# Captures

Two live checks of the package against a Canton participant, run outside CI with the generators of `generator/`. They are kept here so that they can be checked again.

Each vector has the format that `core/tx-hashing/vectors/README.md` of the wallet repository gives.

| Folder                                   | What it holds                                               | Canton           | Protocol version | CI runs it   |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------- | ---------------- | ------------ |
| [`canton-3.6.4-pv36/`](#canton-364-pv36) | The corpus captured again                                   | 3.6.4            | 36               | both scripts |
| [`pre-1970/`](#pre-1970)                 | Four prepare responses with a ledger time bound before 1970 | 3.5.10 and 3.6.4 | 35 and 36        | no           |

## `canton-3.6.4-pv36/`

The corpus captured again from a Canton 3.6.4 participant whose synchronizer runs protocol version 36.

- It was made with the package before the pre-1970 fix and this repository at `a344991`. The package of the published branch gives the same hash for every vector of this capture that has one.
- Canton 3.6.4 came from `https://www.canton.io/releases/canton-open-source-3.6.4.tar.gz`, sha256 `5441af83237d891e326dca825527ac0a076a848fbfdcb142d69c29e7010fa8f9`. No checksum is published next to it.
- It was unpacked into `.canton/3.6.4/` of the wallet and started under pm2 with the arguments of `scripts/src/start-canton.ts`.
- It ran with the wallet's `canton/devnet/canton.conf` and a copy of its `canton/devnet/bootstrap.sc` with `testedProtocolVersion` set to `ProtocolVersion.v36`.
- `pnpm start:canton` cannot start it, as `version-config.json` has no 3.6.4 entry.
- Each of the 67 vectors of `v2/`, `v3/` and `held-out/` names Canton 3.6.4 and protocol version 36 in its `source`. Its `synchronizerId` ends in `::36-0`.
- `mutation/` and `reject/` are made from `v2/` and `v3/`.

| Run                                        | Last line                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `generate-vectors.ts --execute`            | `v2: 24 written, v3: 31 written, mismatches: 0, executed: 53 ok, refused as expected: 2` |
| `generate-vectors.ts --held-out --execute` | `held-out: 12 written, mismatches: 0, executed: 12 ok, refused as expected: 0`           |
| `mutate-vectors.ts`                        | `mutation: 16 written, reject: 44 written`                                               |
| `python/check_vectors.py`                  | `python v2: 24/24, v3: 31/31, mutation: 16/16, held-out: 12/12, mismatches: 0`           |
| `ts/check-visualizer.ts`                   | `visualizer 1.9.1: accepted 24/24, mutation 7/7, held-out 0/0`                           |

What the capture shows:

- The package gave the participant's hash for all 67 prepare responses.
- The generator executed each transaction signed over the package's hash. The participant accepted all but `create-and-exercise` under V2 and V3, which has two roots and is refused on Canton 3.5.10 as well.
- Each vector was compared, field by field, with the committed vector of the same id: 4318 leaf fields on each side. The only difference is `metadata.synchronizerId`, `::35-0` against `::36-0`, in all 67.
- Masked, as they differ in every run:
    - contract ids, party fingerprints and package ids, kept as numbered placeholders;
    - the times of the metadata and of the input contracts, and the two times passed to the choice of `ledger-time-bounds`;
    - node seeds, key hashes, the transaction UUID and the command id.
- Each `eventBlob` was compared by its shape only, and the input contracts after sorting both sides by content.
- Its `v2/` and `v3/` vectors name version 0.2.0 of the DAR, as the held-out vectors do.
- It has 44 reject vectors, since `reject-v3-transaction-lf-3` came later.

## `pre-1970/`

Four prepare responses whose minimum ledger effective time is 1960-01-01T00:00:00Z. No accepted vector of the corpus can hold such a time ([VECTORS.md](../VECTORS.md#hashed-by-the-package-and-the-participant-not-by-python)).

- `generate-vectors.ts --only ledger-time-bounds-pre-1970 --execute` made them.
- It ran with the package that has the pre-1970 fix and this repository at `9d78db0`, plus the one scenario of `scenario.diff`. It runs the choice of `ledger-time-bounds` with a lower bound before 1970.
- It ran under V2 and V3 on Canton 3.5.10 with protocol version 35 (`canton-3.5.10-pv35/`) and on Canton 3.6.4 with protocol version 36 (`canton-3.6.4-pv36/`).
- Each run ended with `v2: 1 written, v3: 1 written, mismatches: 0, executed: 2 ok, refused as expected: 0`.

In all four:

- the participant wrote `metadata.minLedgerEffectiveTime` as the uint64 2^64 - 315619200000000;
- the package's hash and the participant's `preparedTransactionHash` agree;
- the participant accepted the execution signed over the package's hash.

CI does not run this folder: the Python example raises `struct.error` on all four.
