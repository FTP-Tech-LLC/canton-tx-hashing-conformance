# Vectors: reference

What the vectors cover, how they were made, and where `@canton-network/core-tx-hashing` (the package) differs from Canton's Python hashing example and the participant.

The vectors and their file format are in `core/tx-hashing/vectors/` of the wallet repository.

## How the vectors were made

| Folders                   | Made by                         | From                                                                                                        |
| ------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `v2/`, `v3/`, `held-out/` | `generator/generate-vectors.ts` | a Canton 3.5.10 participant on protocol version 35, from the wallet's `pnpm start:canton --network=mainnet` |
| `mutation/`, `reject/`    | `generator/mutate-vectors.ts`   | `v2/` and `v3/`                                                                                             |

- A prepare response became a vector only if the package gave the participant's hash for it.
- With `--execute`, the generator also executes each transaction signed over the package's hash, and the participant checks that signature against its own hash. The held-out run executed all 12.
- The `synchronizerId` in the metadata of every accepted and held-out vector ends in `::35-0`.
- `mutate-vectors.ts` edits a copy of the participant's bytes field by field. What it does not edit stays as the participant wrote it.

The scenarios use the `hash-vectors` DAR of `generator/daml/`, built with Daml SDK 3.5.11 for LF 2.3. Version 0.2.0 added the templates of the held-out vectors.

| DAR version | Package id                                                         | Vectors      |
| ----------- | ------------------------------------------------------------------ | ------------ |
| 0.1.0       | `7ac0650ef4d386a42bcbc7fe129f41806daa04063ff0970a5a3cdd6f4f829e68` | `v2/`, `v3/` |
| 0.2.0       | `a81ca4e098df0239f15c7df191e5ad6a7751f510abb99f49dd3807faed7c35b9` | `held-out/`  |

## Scenarios

- Each scenario ran once with V2, unless it is V3 only, and once with V3, as two different transactions.
- The transactions act as one external party, except `create-multi-signatory` (two parties) and `input-contracts-disclosed` (the second party).
- In the last column, the children of a node follow it in brackets.

| Scenario                    | V2  | Transaction                                                                                                                                      |
| --------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create-plain`              | yes | Create `Plain`, a record of one party                                                                                                            |
| `create-all-values`         | yes | Create `AllKinds`, with one field of each of the 16 value types                                                                                  |
| `create-unicode-text`       | yes | Create `Texts`: two- to four-byte UTF-8, combining and zero width characters, Hebrew, U+FEFF, U+FFFF, and text map keys z, é, U+FF5E and U+1F600 |
| `create-multi-signatory`    | yes | Create `Joint` with two signatories, who both act and both sign                                                                                  |
| `create-empty-collections`  | yes | Create `Empties`: empty list, text map, gen map and text, None, a list that holds an empty list                                                  |
| `create-and-exercise`       | yes | Two roots: Create `Plain` and the non-consuming Exercise `Check` on it. Prepared, not executed                                                   |
| `exercise-consuming`        | yes | Consuming Exercise `Plain.Replace` [Create `Plain`]                                                                                              |
| `exercise-nonconsuming`     | yes | Non-consuming Exercise `Plain.Check`, which returns a Bool                                                                                       |
| `exercise-archive`          | yes | Consuming Exercise `Archive` on a `Plain`                                                                                                        |
| `exercise-nested-creates`   | yes | Exercise `Driver.NestedCreates` [Create, Exercise [Create, Exercise [Create]]]                                                                   |
| `exercise-deep-nesting`     | yes | Exercise `Driver.DeepNesting` [Exercise [Exercise [Exercise `Driver.MakePlain` [Create]]]]                                                       |
| `exercise-choice-observers` | yes | Exercise `Plain.Announce` with a choice observer                                                                                                 |
| `exercise-interface`        | yes | Exercise `Poke` on a `Plain` through the interface `Asset`                                                                                       |
| `exercise-result-record`    | yes | Exercise `Plain.Describe`, which returns a record                                                                                                |
| `fetch-in-choice`           | yes | Exercise `Driver.FetchPlain` [Fetch `Plain`]                                                                                                     |
| `fetch-interface`           | yes | Exercise `Driver.FetchAsset` [Fetch `Plain` through `Asset`]                                                                                     |
| `numeric-scales`            | yes | Create `Numerics`: scales 0, 10 and 37, up to 38 digits, negative and zero                                                                       |
| `time-bounds`               | yes | Create `Times`: the first and last timestamp and date, the epoch, and the microsecond and day before it                                          |
| `optional-nested`           | yes | Create `Optionals`: None, Some, Some None, nested optionals, Some of a record, a trailing None                                                   |
| `maps`                      | yes | Create `Maps`: text maps, a text map of text maps, gen maps with Int keys and with record keys                                                   |
| `variant-enum`              | yes | Create `Variants`: variants of a value and of fields, enums, `Either`                                                                            |
| `input-contracts-disclosed` | yes | Exercise `Shared.Use` by a party that sees the contract only as a disclosed contract                                                             |
| `ledger-time-bounds`        | yes | Exercise `Driver.CheckTime`, with the minimum and maximum ledger effective time in the metadata                                                  |
| `rollback`                  | yes | Exercise `Driver.TryCatch` [Rollback [Fetch `Driver`, Exercise `Driver.Noop`]]                                                                   |
| `create-with-key`           | no  | Create `Keyed` with a key                                                                                                                        |
| `exercise-by-key`           | no  | Exercise `Driver.ArchiveByKey` [consuming Exercise `Archive` on `Keyed`, by key]                                                                 |
| `fetch-by-key`              | no  | Exercise `Driver.FetchKeyed` [Fetch `Keyed`, by key]                                                                                             |
| `lookup-by-key-found`       | no  | Exercise `Driver.LookupKeyed` [QueryByKey, not exhaustive, with the contract it found]                                                           |
| `lookup-by-key-empty`       | no  | Exercise `Driver.LookupKeyed` [QueryByKey, exhaustive, without a contract]                                                                       |
| `max-record-time`           | no  | Create `Plain`, with `maxRecordTime` in the metadata                                                                                             |
| `int64-big`                 | no  | Create `Ints`: 2^53 + 1, -(2^53 + 1), and the largest and the smallest int64                                                                     |

Keys and `maxRecordTime` are V3 only, as V2 does not hash them.

`int64-big` is V3 only, as the V2 vectors also run against core-tx-visualizer 1.9.1, which hashes an `Int64` through a double.

## Held-out vectors

The held-out vectors check the package against participant output that did not exist while it was written.

- They come from one later run, with templates that no other vector uses: `Escrow`, `Ticket`, `Tag`, `Registry` and the interface `Badge`.
- The package's code did not change for them, and each gave the participant's hash.
- Each has a contract key and is V3 only.

Between them they cover each part of the hash that V3 changes:

| Part of the hash                                | Scenarios                                                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The encoding without the version prefixes of V2 | all twelve                                                                                                                                                           |
| A key on a create node                          | `create-record-key`, `create-variant-key`, `create-unicode-key`, and below an exercise in `by-key-in-choice`, `exercise-by-key-command` and `max-record-time-by-key` |
| A key on an exercise node, `byKey = false`      | `exercise-record-key`, `exercise-interface-keyed`                                                                                                                    |
| A key on an exercise node, `byKey = true`       | `by-key-in-choice`, `by-key-in-rollback`, `exercise-by-key-command`, `max-record-time-by-key`                                                                        |
| A key on a fetch node, `byKey = false`          | `fetch-keyed-by-id`                                                                                                                                                  |
| A key on a fetch node, `byKey = true`           | `exercise-record-key`, `by-key-in-choice`, `by-key-in-rollback`                                                                                                      |
| `QueryByKey` nodes that find contracts          | `exercise-record-key`, `query-by-key-several`, `by-key-in-choice`, `by-key-in-rollback`                                                                              |
| `QueryByKey` nodes that find none               | `exercise-record-key`, `query-by-key-variant-key-empty`                                                                                                              |
| `metadata.maxRecordTime`                        | `max-record-time-by-key`                                                                                                                                             |

| Scenario                         | Transaction                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `create-record-key`              | Create `Escrow`, signed by both parties, with a record key and both parties as maintainers                                       |
| `create-variant-key`             | Create `Ticket`, whose key holds a variant with a record and `Some (Some "Balcon")`                                              |
| `create-unicode-key`             | Create `Tag`, with the text `ключ · 鍵 · 🔑` in its key                                                                          |
| `exercise-record-key`            | Exercise `Escrow.Audit` by id [QueryByKey that finds it, QueryByKey that finds none, Fetch `Escrow` by key]                      |
| `exercise-interface-keyed`       | Exercise `Present` on a `Tag` by id through the interface `Badge`                                                                |
| `fetch-keyed-by-id`              | Exercise `Registry.Inspect` [Fetch `Tag` by id]                                                                                  |
| `query-by-key-several`           | Exercise `Registry.FindAll` [QueryByKey, exhaustive, with two `Tag` contracts]                                                   |
| `query-by-key-variant-key-empty` | Exercise `Registry.FindTicket` [QueryByKey that finds none, with a constructor without fields and `Some None`]                   |
| `by-key-in-choice`               | Exercise `Registry.Sweep` [Fetch `Tag` by key, Exercise `Tag.Rename` by key [Create `Tag`], QueryByKey that finds the new `Tag`] |
| `by-key-in-rollback`             | Exercise `Registry.Rehearse` [Rollback [Fetch `Tag` by key, Exercise `Tag.Ping` by key, QueryByKey]]                             |
| `exercise-by-key-command`        | An `ExerciseByKey` command: consuming Exercise `Ticket.Reseat` [Create `Ticket`]                                                 |
| `max-record-time-by-key`         | An `ExerciseByKey` command: consuming Exercise `Tag.Rename` [Create `Tag`], with `maxRecordTime` in the metadata                 |

## Mutation vectors

A mutation vector is an accepted vector with one byte changed in a field that its scheme hashes, and the hash that results.

The change keeps the field valid and of the same length:

| Field  | Change                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| String | The last ASCII letter or digit becomes the next one of its run (`0`-`9`, `a`-`f`, `g`-`z`, `A`-`F`, `G`-`Z`), so a contract id stays hex |
| Seed   | The lowest bit of the first byte flips                                                                                                   |
| Time   | The lowest bit flips, so the time moves by a microsecond                                                                                 |

The changed fields, which `source.mutation` names with the change:

- under V2 and V3: a contract id, a party, a numeric, a choice, a seed, a command id, the preparation time;
- under V3 also: the maximum record time, the text in a contract key.

No participant saw these bytes, so the expected hash is the package's. `python/check_vectors.py` checks each against the Python example, which hashes these fields as they are written.

The package's mutation test changes every hashed value of every accepted vector, one at a time. Each change must give another hash, or a refusal where one byte breaks the input.

## Reject vectors

Each reject vector is an accepted vector with an edit, another scheme or limits, which `source.mutation` describes. Each error code of the package has at least one:

| Code                          | Vectors                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DECODE_FAILED`               | `reject-v2-truncated`, `reject-v3-empty`                                                                                                                          |
| `UNKNOWN_FIELD`               | `reject-v2-unknown-field-in-node`, `reject-v3-unknown-field-in-metadata`, `reject-v2-party-in-unknown-value-member`                                               |
| `UNSUPPORTED_SCHEME`          | `reject-scheme-v4`, `reject-scheme-unspecified`, `reject-scheme-lower-case`                                                                                       |
| `UNSUPPORTED_NODE_VERSION`    | `reject-v2-node-without-version`                                                                                                                                  |
| `UNSUPPORTED_LF_VERSION`      | `reject-v2-lf-2`, `reject-v2-lf-2-2`, `reject-v3-lf-dev`, `reject-v3-lf-3`, `reject-v3-transaction-lf-3`, `reject-v3-key-in-lf-2-1`, `reject-v3-by-key-in-lf-2-1` |
| `FIELD_NOT_COVERED_BY_SCHEME` | `reject-v2-query-by-key`, `reject-v2-key`, `reject-v2-by-key`, `reject-v2-max-record-time`, `reject-v3-seed-on-fetch`, `reject-v2-seed-on-rollback`               |
| `MISSING_FIELD`               | `reject-v3-no-roots`, `reject-v2-no-metadata`, `reject-v3-rollback-without-children`, `reject-v3-exercise-without-chosen-value`                                   |
| `MISSING_NODE_SEED`           | `reject-v2-exercise-without-seed`, `reject-v3-create-without-seed`                                                                                                |
| `DUPLICATE_NODE_SEED`         | `reject-v3-two-seeds-for-one-node`                                                                                                                                |
| `INVALID_NODE_ID`             | `reject-v3-node-id-leading-zero`                                                                                                                                  |
| `DUPLICATE_NODE_ID`           | `reject-v2-duplicate-node-id`                                                                                                                                     |
| `DANGLING_NODE_REFERENCE`     | `reject-v3-dangling-child`                                                                                                                                        |
| `SHARED_CHILD`                | `reject-v2-shared-child`, `reject-v3-root-listed-twice`                                                                                                           |
| `CYCLE`                       | `reject-v2-own-child`, `reject-v3-two-node-cycle`                                                                                                                 |
| `ORPHAN_NODE`                 | `reject-v2-orphan-node`                                                                                                                                           |
| `NODE_LIMIT_EXCEEDED`         | `reject-v2-too-many-nodes`                                                                                                                                        |
| `DEPTH_LIMIT_EXCEEDED`        | `reject-v3-nodes-too-deep`, `reject-v3-value-too-deep`                                                                                                            |
| `INVALID_HEX`                 | `reject-v2-contract-id-of-odd-length`, `reject-v3-query-result-in-upper-case`                                                                                     |
| `INVALID_VALUE`               | `reject-v2-seed-of-31-bytes`, `reject-v3-key-hash-of-31-bytes`, `reject-v3-value-without-kind`                                                                    |

A vector expects the first problem that the package finds, in this order:

1. the scheme, then the limits in the options;
2. the bytes, unknown fields included;
3. the transaction, its roots and `maxNodes`;
4. the node ids, then each reference depth first from the roots (its id, its node, a cycle, a second reference, `maxNodeDepth`), then nodes that no root reaches;
5. the node ids of the seeds and two seeds for one node, then the metadata, then the length of each seed, seeds of nodes that take none, and create and exercise nodes without a seed;
6. each node depth first, before its children: its version, LF version and keys, then its fields in hash order, values against `maxValueDepth`;
7. the LF version of the transaction, then the fields of the metadata, under V2 `maxRecordTime` first.

`reject-v2-own-child`, `reject-v3-two-node-cycle`, `reject-v2-party-in-unknown-value-member`, `reject-v2-key`, `reject-v2-by-key`, `reject-v2-query-by-key` and `reject-v3-empty` break a second rule too, so an implementation that checks in another order can give another code for them.

## Where the package differs

A participant hashes with Scala, and Canton ships the Python example next to it.

- For each accepted vector, Python and the package give the participant's hash.
- For what a participant writes, the three agree, except on a metadata time before 1970, which Python cannot hash.
- They can differ on input that a participant does not write. The reject vectors hold such input; the mutation vectors change only fields that both hash alike.

An empty Participant cell means this file does not cover that case. The newest LF version a scheme hashes is `2.1` for V2 and `2` for V3. The decoder of Canton 3.5 knows `2.1`, `2` and `dev`, and that of 3.6 also `3`.

| Input                                                        | Python example                                          | Participant                   | Package                       |
| ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------- | ----------------------------- |
| Create node without a seed                                   | hashes it                                               | refuses it                    | `MISSING_NODE_SEED`           |
| Exercise node without a seed                                 | raises `TypeError`                                      | refuses it                    | `MISSING_NODE_SEED`           |
| Seed or key hash that is not 32 bytes                        | hashes it                                               | refuses it                    | `INVALID_VALUE`               |
| Seed on a fetch, rollback or QueryByKey node                 | ignores it                                              | refuses it                    | `FIELD_NOT_COVERED_BY_SCHEME` |
| Key or `byKey = true` in a node of LF `2.1`, under V3        | hashes it                                               | refuses it                    | `UNSUPPORTED_LF_VERSION`      |
| LF version the decoder does not know                         | hashes it                                               | refuses it                    | `UNSUPPORTED_LF_VERSION`      |
| Node LF version newer than its scheme hashes                 | hashes it                                               | refuses it                    | `UNSUPPORTED_LF_VERSION`      |
| Transaction LF version newer than its scheme hashes          | hashes it                                               | 3.5 hashes it, 3.6 refuses it | `UNSUPPORTED_LF_VERSION`      |
| Transaction LF version older than one of its nodes           | hashes it                                               | 3.5 hashes it, 3.6 refuses it | hashes it                     |
| Node id that is not canonical, such as `01`                  | compares ids as strings                                 | reads it as a number          | `INVALID_NODE_ID`             |
| Two seeds for one node                                       | uses the first                                          | uses the last                 | `DUPLICATE_NODE_SEED`         |
| Two nodes with one id                                        | keeps the last                                          |                               | `DUPLICATE_NODE_ID`           |
| Node that no root reaches                                    | ignores it                                              |                               | `ORPHAN_NODE`                 |
| Node that two parents list                                   | hashes it twice                                         |                               | `SHARED_CHILD`                |
| Child id with no node                                        | raises `KeyError`                                       |                               | `DANGLING_NODE_REFERENCE`     |
| Cycle                                                        | raises `RecursionError`                                 |                               | `CYCLE`                       |
| Contract id that is not lower case hex of even length        | takes upper case and spaces, `ValueError` on odd length | refuses it                    | `INVALID_HEX`                 |
| Key, `byKey` or `maxRecordTime` under V2                     | ignores it                                              |                               | `FIELD_NOT_COVERED_BY_SCHEME` |
| QueryByKey node under V2                                     | raises `ValueError`                                     |                               | `FIELD_NOT_COVERED_BY_SCHEME` |
| `Timestamp` or `Date` value outside 0001-01-01 to 9999-12-31 | hashes it                                               | refuses it                    | `INVALID_VALUE`               |
| Metadata time outside that range                             | hashes it, or raises `struct.error` before 1970         | refuses it                    | `INVALID_VALUE`               |
| Metadata time before 1970, in the range                      | raises `struct.error`                                   | hashes it as a signed int64   | hashes it as the participant  |
| `globalKeyMapping` and `eventBlob` of the metadata           | does not hash them                                      | hashes neither                | accepts them, hashes neither  |

[`captures/pre-1970/`](captures/README.md) has four prepare responses with a metadata time before 1970, for which the package gave the participant's hash.

The package decodes with protobuf-ts, the Python example with upb:

- A malformed encoding, such as a field length one byte short, is a decode error in Python. protobuf-ts can decode it, and the package hashes the message it decoded.
- A known field written with another wire type is skipped as unknown by Python and by Canton's own decoder and hasher (canton-open-source 3.5.18, run offline). protobuf-ts reads it as that field.

The reject vectors use neither kind of encoding, so a strict decoder passes the corpus.

### Normal forms

The participant's hasher hashes the inputs below in a normal form. The package hashes them as written, as the Python example does, which cannot hash the bound of 0001-01-01, a time before 1970:

- a `minLedgerEffectiveTime` of 0001-01-01T00:00:00Z or a `maxLedgerEffectiveTime` of 9999-12-31T23:59:59.999999Z, which the participant reads as no bound;
- an empty record label, which it reads as no label;
- signatories, stakeholders, acting parties, choice observers, key maintainers and the `actAs` parties, hashed as sorted sets;
- input contracts, sorted by contract id, and the entries of a text map, sorted by key;
- a numeric, hashed as printed again, so `-0.0` as `0.0`;
- the transaction UUID and the synchronizer id, hashed as printed again.

The participant writes them in the normal form, or never, so for its output the hashes agree.

## What the participant writes

The accepted and held-out vectors show this:

- A node with a contract key has LF version `2`, and so has its transaction. Other nodes keep `2.1`, although the DAR targets LF 2.3.
- Under V2 the participant refuses to prepare a transaction with a key: `Cannot hash node with LF serialization version V2 using hashing scheme V2. Does the transaction use contract keys? Please using hashing scheme V3 or higher.`
- `lookupByKey` is a QueryByKey node: not exhaustive with the contract it found, or exhaustive with no result. `lookupAllByKey` is exhaustive with every contract that has the key.
- A node on a contract with a key carries the key also when the contract is used by id, with `byKey = false`.
- `metadata.maxRecordTime` is set when the prepare request sets it, under V2 too.
- `isLedgerTimeGE t` sets `minLedgerEffectiveTime` to `t`, and `isLedgerTimeLT t` sets `maxLedgerEffectiveTime` to one microsecond before `t`.
- A numeric has as many decimals as its scale, the entries of a text map are in the code point order of their keys, and the trailing None fields of a record are left out. An implementation that sorts the entries again in another order, such as by UTF-16 code units, or fills in fields gets another hash.
- Every input contract has an `eventBlob`, and `metadata.globalKeyMapping` is empty.
- With `enforceSingleRootNode` at its default, as in the wallet's local setup, a prepare request takes one command, and a `CreateAndExercise` command makes a transaction with two roots, which the participant prepares and hashes but does not execute.
- While the scenarios were built, Canton 3.5.10 refused to roll back a create or a consuming exercise (`DAML_EFFECTFUL_ROLLBACK_ERROR`), so the rollback in `rollback` holds a Fetch and a non-consuming Exercise.

## Sources

Cited from `digital-asset/canton` at [`v3.5.1`](https://github.com/digital-asset/canton/tree/v3.5.1), and at [`v3.6.4`](https://github.com/digital-asset/canton/tree/v3.6.4) where a line says so.

The `v3.5.x` tags are commits of Canton's main branch. The released 3.5.10 matches `release-line-3.5`, where the cited code does the same as at `v3.5.1`, with some lines shifted.

- The Python files are in `community/app/src/pack/examples/08-interactive-submission/`: `daml_transaction_hashing_common.py` (`common.py`), `daml_transaction_hashing_v2.py` (`v2.py`) and `daml_transaction_hashing_v3.py` (`v3.py`).
- The Scala files are under `community/`: the hasher in `base/src/main/scala/com/digitalasset/canton/protocol/hash/`, the decoder (`PreparedTransactionDecoder.scala`) and encoder (`PreparedTransactionEncoder.scala`) in `ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/platform/apiserver/services/command/interactive/codec/`, and Daml-LF in `daml-lf/`.
- Elsewhere under `community/`: `common/src/main/scala/com/digitalasset/canton/protocol/WellFormedTransaction.scala`; in `base/src/main/scala/com/digitalasset/canton/` the files `util/LfTransactionUtil.scala`, `crypto/HashBuilder.scala`, `crypto/InteractiveSubmission.scala`, `serialization/ProtoConverter.scala`, `data/LedgerTimeBoundaries.scala`, `topology/Member.scala` and `version/ProtocolVersion.scala`; in `ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/` the files `ledger/api/validation/ValueValidator.scala` and `ledger/api/util/LfEngineToApi.scala`; and `InteractiveSubmissionServiceImpl.scala` one level above `codec/`. `Hash.scala` is the Daml-LF one, in `daml-lf/transaction/`.

By topic:

- Seeds: `common.py:38-40`, `47-51`; `v3.py:94-99`, `111`, `131`, `172-181`; `NodeHashBuilderCommon.scala:166-173`, `VersionedTransactionHasher.scala:26`, `WellFormedTransaction.scala:189-217`, `LfTransactionUtil.scala:59-65`, `PreparedTransactionDecoder.scala:126-140`, `Hash.scala:107-112`.
- Keys: `v3.py:118`, `148-149`, `167-168`; `PreparedTransactionDecoder.scala:169-186`, `188-223`, `NodeHashBuilderCommon.scala:38`, `66-67`, `122-123`.
- LF versions: `SerializationVersion.scala:26-30` (`28-31` at v3.6.4), `NodeHashBuilder.scala:80-124`; at v3.6.4 `VersionedTransactionHasher.scala:23-26` and `PreparedTransactionDecoder.scala:226-239`, called at `440`.
- Node ids and the forest: `common.py:71-77`, `88-105`, `177-181`; `PreparedTransactionDecoder.scala:158-164`, `EnrichedTransactionData.scala:103-105`.
- Hex: `common.py:43-44`; `PreparedTransactionDecoder.scala:117-125`, `ValueValidator.scala:52-55`, `IdString.scala:159-167`.
- Fields a scheme does not hash: `v2.py:87`, `90-204`; `PreparedTransactionEncoder.scala:360-363`.
- Times: `common.py:24-25`; `PreparedTransactionDecoder.scala:88-96`, `142-147`, `ValueValidator.scala:70-81`, `Time.scala:52-65`, `152-167`, `PreparedTransactionEncoder.scala:119`, `324`, `v2/TransactionMetadataHasher.scala:44-61`, `v3/TransactionMetadataHasher.scala:27-30`.
- Ledger time bounds: `PreparedTransactionDecoder.scala:428-435`, `LedgerTimeBoundaries.scala:11-16`, `PreparedTransactionEncoder.scala:367-374`.
- Record labels: `common.py:169-170`; `LfValueHashBuilder.scala:105-112`, `ValueValidator.scala:36`, `PreparedTransactionEncoder.scala:84`, `LfEngineToApi.scala:147`, `ExternalTransactionProcessor.scala:234-247`.
- Sets and sorted collections: `common.py:61-64`; `HashBuilder.scala:148-153`, `NodeHashBuilderCommon.scala:49-50`, `74-77`, `131-133`, `144`, `v3/NodeHashBuilder.scala:54`, `InteractiveSubmission.scala:32`, `63`, `71`, `v2/TransactionMetadataHasher.scala:57-59`, `ValueValidator.scala:113-130`, `LfValueHashBuilder.scala:101-104`, `LfEngineToApi.scala:86-93`, `PreparedTransactionEncoder.scala:148-149`, `162-165`, `179-181`, `298`, `333`, `349-351`.
- Numerics: `common.py:115-116`; `HashBuilder.scala:124-128`, `ValueValidator.scala:236-240`, `NumericModule.scala:188-215`, `LfEngineToApi.scala:69-70`.
- UUID and synchronizer id: `v2.py:180`, `v3.py:205`; `v2/TransactionMetadataHasher.scala:41`, `43`, `ProtoConverter.scala:240-247`, `PreparedTransactionDecoder.scala:473-475`, `507-513`, `Member.scala:300-322`, `ProtocolVersion.scala:178-213`, `PreparedTransactionEncoder.scala:121`, `364`, `365`.
- The refusals for keys under V2 and for two roots: `TransactionHash.scala:26-31`, `InteractiveSubmissionServiceImpl.scala:180-185`, `ExternalTransactionProcessor.scala:272-278`.
