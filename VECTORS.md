# Hash vectors: reference

The hash vectors of `@canton-network/core-tx-hashing`, the package below, live in `core/tx-hashing/vectors/` of the wallet repository. The `README.md` there gives their file format, their folders and how to run them from another language. This file is the reference for people who implement the prepared transaction hash. It says where the package, Canton's Scala hasher and Canton's Python example differ, what a participant writes, how the vectors were made, and what each scenario, held-out, mutation and reject vector covers. Paths such as `core/tx-hashing/src/mutation.test.ts` are paths in the wallet repository.

## Where the package differs from the Scala hasher and the Python example

A participant hashes with Scala. Canton also ships an implementation in Python as an example, the Python example below. The package follows it and refuses more. For each accepted vector, Python and the package give the participant's hash. For what a participant writes the three agree, except on a time before 1970, which Python cannot hash (below). They can differ for input a participant does not write, and that is where the reject vectors are. The mutation vectors are such input too, but they change only fields that Python and the package hash alike.

The sources below are cited from `digital-asset/canton` at v3.5.1, while the vectors come from a Canton 3.5.10 participant. The three Python files are the same at v3.5.10.

- Python: `community/app/src/pack/examples/08-interactive-submission/`, files `daml_transaction_hashing_common.py` (`common.py` below), `daml_transaction_hashing_v2.py` (`v2.py`) and `daml_transaction_hashing_v3.py` (`v3.py`).
- Scala, the hasher: `community/base/src/main/scala/com/digitalasset/canton/protocol/hash/`, and in `community/base/src/main/scala/com/digitalasset/canton/crypto/` the files `HashBuilder.scala` and `InteractiveSubmission.scala`.
- Scala, the participant's decoder and encoder: `community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/platform/apiserver/services/command/interactive/codec/`, files `PreparedTransactionDecoder.scala` (`Decoder` below), `PreparedTransactionEncoder.scala` (`Encoder`), `EnrichedTransactionData.scala` and `ExternalTransactionProcessor.scala`.
- Scala, the participant's check of seeds: `community/common/src/main/scala/com/digitalasset/canton/protocol/WellFormedTransaction.scala` and `community/base/src/main/scala/com/digitalasset/canton/util/LfTransactionUtil.scala`.
- Scala, the conversion of values: `community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/ledger/api/validation/ValueValidator.scala` (which also holds `StricterValueValidator`), `community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/ledger/api/util/LfEngineToApi.scala` and `community/base/src/main/scala/com/digitalasset/canton/serialization/ProtoConverter.scala`.
- Scala, Daml-LF: `community/daml-lf/transaction/src/main/scala/com/digitalasset/daml/lf/crypto/Hash.scala`, `community/daml-lf/transaction/src/main/scala/com/digitalasset/daml/lf/transaction/SerializationVersion.scala`, `community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/IdString.scala`, `community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/NumericModule.scala` and `community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/Time.scala`.
- Scala, the ledger time bounds: `community/base/src/main/scala/com/digitalasset/canton/data/LedgerTimeBoundaries.scala`.
- Scala, synchronizer ids: `community/base/src/main/scala/com/digitalasset/canton/topology/Member.scala` and `community/base/src/main/scala/com/digitalasset/canton/version/ProtocolVersion.scala`.

### Refused by the package, hashed by Python

- Seeds. Python hashes a create node without a seed as one with an absent seed (`common.py:47-51`, `v3.py:111`) and raises a `TypeError` for an exercise node without one (`v3.py:131`, `common.py:38-40`). The Scala hasher refuses both (`NodeHashBuilderCommon.scala:166-173`; `enforceNodeSeedForCreateNodes` is true in `VersionedTransactionHasher.scala:26`). A seed is written without a length (`common.py:38-40`), so Python hashes one of any length, while the decoder takes only 32 bytes (`Decoder:126-140`; `Hash.scala:107-112`). The participant refuses a create or exercise node without a seed, and a seed on a fetch, rollback or QueryByKey node (`checkSeeds` in `WellFormedTransaction.scala:189-217`; `nodeHasSeed` in `LfTransactionUtil.scala:59-65` is true for create and exercise nodes only). Python never reads a seed for a fetch, rollback or QueryByKey node (`v3.py:94-99`, `172-181`), so it ignores one. Codes: `MISSING_NODE_SEED`, `INVALID_VALUE`, `FIELD_NOT_COVERED_BY_SCHEME`.
- Keys. Python hashes the key and `byKey` of any node (`v3.py:118`, `148-149`, `167-168`). The decoder and the hasher refuse both in a node of LF version `2.1` (`Decoder:188-223`; `NodeHashBuilderCommon.scala:38`, `66-67`, `122-123`), and the decoder refuses a key hash that is not 32 bytes (`Decoder:169-186`; `Hash.scala:107-112`). Codes: `UNSUPPORTED_LF_VERSION`, `INVALID_VALUE`.
- LF versions. Python hashes any version string. The decoder knows `2.1`, `2` and `dev` (`SerializationVersion.scala:26-30`), and the hasher refuses a node above the newest version a scheme supports, `2.1` for V2 and `2` for V3 (`NodeHashBuilder.scala:80-124`). Canton 3.5 hashes the transaction's own version unchecked, while Canton 3.6 refuses it above that version too (`VersionedTransactionHasher.scala:23-26` at v3.6.4). The package checks the transaction's version as it checks a node's. Code: `UNSUPPORTED_LF_VERSION`.
- Node ids, seeds and the shape of the forest. The decoder reads a node id with `toIntOption` (`Decoder:158-164`), which takes `01` and `+1` for 1 (`StringParsers.parseInt` in `src/library/scala/collection/StringParsers.scala:103-135` of `scala/scala` v2.13.16, the Scala version of Canton 3.5.10), while Python compares ids as strings (`common.py:71-77`). For two seeds of one node Python uses the first (`common.py:71-77`) and Scala the last (`EnrichedTransactionData.scala:103-105`). Python also keeps the last of two nodes with one id, never looks at a node no root reaches and hashes a node twice that two parents list. It fails with a `KeyError` on a missing child and a `RecursionError` on a cycle (`common.py:88-105`, `177-181`). The package takes canonical ids and a forest in which every node is reached once, with at most one seed per node. Codes: `INVALID_NODE_ID`, `DUPLICATE_NODE_SEED`, `DUPLICATE_NODE_ID`, `ORPHAN_NODE`, `SHARED_CHILD`, `DANGLING_NODE_REFERENCE`, `CYCLE`.
- Hex. Python's `bytes.fromhex` skips ASCII whitespace between bytes and takes upper case digits (`common.py:43-44`), so it hashes the contract id `00AB` as it hashes `00ab`. The decoder takes a contract id as lower case hex of even length only, in a node or a QueryByKey result (`Decoder:117-125`) as in a value (`ValueValidator.scala:52-55`). Both parse it as a `HexString`, for which `IdString.scala:159-167` asks Guava's `base16().lowerCase()` to `canDecode` the string, so `AB`, `abc` and `ab cd` are refused. The package refuses whitespace, odd length and upper case digits. Code: `INVALID_HEX`.
- Fields a scheme does not hash. V2 never reads `key`, `byKey` or `max_record_time`, and Python stops at a QueryByKey node with a `ValueError` (`v2.py:87`, `90-204`). A signature over a V2 hash would not bind them, so the package refuses them. Code: `FIELD_NOT_COVERED_BY_SCHEME`. No scheme hashes `metadata.globalKeyMapping`, which is deprecated and empty in a participant's output (`Encoder:360-363`), or `metadata.inputContracts[i].eventBlob`, so a signature does not cover them. The package accepts both, as Python does.
- Times outside Daml's range. The decoder refuses a timestamp outside 0001-01-01T00:00:00Z to 9999-12-31T23:59:59.999999Z and a date outside 0001-01-01 to 9999-12-31 (`Time.scala:52-65`, `152-167`). It reads each time of the metadata as a timestamp (`Decoder:142-147`) and converts every value with `StricterValueValidator` (`Decoder:88-96`), which refuses a `Timestamp` or `Date` value outside its range (`ValueValidator.scala:70-81`). The package refuses all of them. Python hashes such a value, and such a time of the metadata after the range, and raises `struct.error` on a time of the metadata before it, as on every time before 1970 (below). Code: `INVALID_VALUE`.

### Hashed by the package and the participant, not by Python

- Times before 1970. The times of the metadata, `preparationTime`, `minLedgerEffectiveTime`, `maxLedgerEffectiveTime`, `maxRecordTime` and the `createdAt` of an input contract, are uint64 fields. The participant writes them from signed 64-bit numbers (`Encoder:119`, `324`), so a time before 1970 arrives as 2^64 minus its magnitude, as when Daml code checks `isLedgerTimeGE t` for a `t` before 1970. The decoder reads such a field back as the signed number (`Decoder:142-147`), and the hasher hashes it as an int64 (`v2/TransactionMetadataHasher.scala:44-61`, `v3/TransactionMetadataHasher.scala:27-30`). So does the package. Python reads the field as an unsigned number, and `encode_int64` raises `struct.error` on it (`common.py:24-25`). No accepted vector holds such a time, since each must give its hash in Python as well. [`captures/pre-1970/`](captures/README.md#pre-1970) has four prepare responses with one, for which the package gave the participant's hash.

### Hashed differently by Scala

- Ledger time bounds at the ends of the timestamp range. The decoder reads a `minLedgerEffectiveTime` of 0001-01-01T00:00:00Z and a `maxLedgerEffectiveTime` of 9999-12-31T23:59:59.999999Z as no bound (`Decoder:428-435`; `LedgerTimeBoundaries.scala:11-16`), so the hasher writes `00` for them (`v2/TransactionMetadataHasher.scala:44-55`). The package hashes them as written. The participant writes a bound only where it limits the time (`Encoder:367-374`), so it never writes these two.
- Empty record labels. Python writes a label as `01` and the string, also for an empty one, because a proto3 string is never `None` (`common.py:169-170`). So does the package. Scala hashes a label as an optional name (`LfValueHashBuilder.scala:105-112`), and the decoder reads an empty label as no label (`Decoder:88-96` calls `StricterValueValidator`; `ValueValidator.scala:36`), so it writes `00`. The participant writes the labels of the enriched value: with `verbose = true` (`Encoder:84`) it copies each LF label and writes `""` for a missing one (`LfEngineToApi.scala:147`), and the transaction is enriched before it is encoded (`ExternalTransactionProcessor.scala:234-247`). So only crafted input has empty labels.
- Sets and order. Scala hashes signatories, stakeholders, acting parties, choice observers and key maintainers as sets, sorted and without duplicates (`HashBuilder.scala:148-153`; `NodeHashBuilderCommon.scala:49-50`, `74-77`, `131-133`, `144`; `v3/NodeHashBuilder.scala:54`). It does the same for the `actAs` parties (`InteractiveSubmission.scala:63`), sorts input contracts by contract id (`InteractiveSubmission.scala:32`, `71`; `v2/TransactionMetadataHasher.scala:57-59`) and orders the entries of a text map by key (the decoder builds a `SortedLookupList`, `ValueValidator.scala:113-130`, which `LfValueHashBuilder.scala:101-104` hashes in order). Python and the package hash all of these in the order and number they have in the prepared transaction (`common.py:61-64`). The participant writes them sorted (`Encoder:148-149`, `162-165`, `179-181`, `298`, `333`, `349-351`), text maps included (`LfEngineToApi.scala:86-93`), so for its output the three agree.
- Numerics and UUIDs. Scala hashes a numeric as `Numeric.toString` of the parsed value (`HashBuilder.scala:124-128`) and the transaction UUID as `UUID.toString` of the parsed UUID (`v2/TransactionMetadataHasher.scala:41`). Python and the package hash the strings as written (`common.py:115-116`; `v2.py:180`; `v3.py:205`). The decoder parses a numeric with `Numeric.fromString` (`ValueValidator.scala:236-240`). That accepts only `-?([1-9]\d*|0)\.(\d*)`, keeps the number of decimals as the scale, and `toString` prints `toPlainString` (`NumericModule.scala:188-215`). So a numeric comes back as it was, except negative zero, which `BigDecimal` does not have: `-0.0` is hashed as `0.0`. The participant writes numerics with the same `toString` (`LfEngineToApi.scala:69-70`). The UUID is parsed by `UUID.fromString` (`ProtoConverter.scala:240-247`; `Decoder:473-475`), which is lenient: `123E4567-E89B-12D3-A456-426614174000` is hashed in lower case, and `1-2-3-4-5` as `00000001-0002-0003-0004-000000000005`. The participant writes the UUID with `UUID.toString` (`ProtoConverter.scala:241`; `Encoder:365`).
- Synchronizer ids. The decoder parses the synchronizer id, reading the protocol version and the serial of a physical id as integers (`Decoder:507-513`; `Member.scala:300-322`; `ProtocolVersion.scala:178-213`), and the hasher writes the id printed again (`v2/TransactionMetadataHasher.scala:43`). So `...::035-0`, `...::+35-0` and `...::35-00` are hashed as `...::35-0`, and a protocol version of `2147483647` or `DEV` as `dev`. Python and the package hash the string as written. The participant writes the printed id (`Encoder:121`, `364`).

### Decoder leniency

- The package decodes with protobuf-ts and does not require the canonical encoding. protobuf-ts accepts some malformed encodings that Python's protobuf (upb) refuses, and they decode to the message that is hashed. For example `v2-create-plain` with the declared length of its `transaction` field shortened by one byte gives the participant's hash in the package, and a decode error in Python.
- protobuf-ts also reads a known field number written with another wire type as that field, while upb and the participant's parser skip such a field as unknown. For example, take `v2-create-plain` with the `contract_id` of its create (field 2, a string) written once more as the varint 0. The package hashes it with an empty contract id, while Python and Canton 3.5.18 skip the field and give the hash of `v2-create-plain`. Such bytes read differently in the package and at the participant: the package fails to decode them or hashes a value that the participant skips.
- Reject vectors use neither kind of encoding (a truncated input is cut at its end), so a decoder that checks the encoding strictly passes the corpus.

## What the participant writes

The accepted and held-out vectors show this:

- A node with a contract key has `lfVersion` `2`, and so has a transaction with such a node. All other nodes keep `2.1`, although the DAR targets LF 2.3. With `HASHING_SCHEME_VERSION_V2` the participant refuses to prepare a transaction with a key: `Cannot hash node with LF serialization version V2 using hashing scheme V2. Does the transaction use contract keys? Please using hashing scheme V3 or higher.` (`TransactionHash.scala:26-31` of the Scala hasher). So the scenarios with keys are V3 only.
- `lookupByKey` is a `QueryByKey` node: `exhaustive: false` with the contract id it found in `result` (`v3-lookup-by-key-found`), or `exhaustive: true` with an empty `result` (`v3-lookup-by-key-empty`). Keys need not be unique: `lookupAllByKey` of `DA.ContractKeys` is a `QueryByKey` node with `exhaustive: true` and every contract that has the key (two in `held-out-v3-query-by-key-several`). A `QueryByKey` node also finds a contract that its transaction created (`held-out-v3-by-key-in-choice`).
- A node on a contract with a key carries the key also when the contract is used by its contract id, with `byKey = false`: an exercise in `held-out-v3-exercise-record-key` and `held-out-v3-exercise-interface-keyed`, a fetch in `held-out-v3-fetch-keyed-by-id`.
- `metadata.maxRecordTime` is set when the prepare request sets `maxRecordTime`, under V2 too, although V2 does not hash it. The package refuses such a V2 transaction (`FIELD_NOT_COVERED_BY_SCHEME`), so `max-record-time` is V3 only.
- `metadata.minLedgerEffectiveTime` and `maxLedgerEffectiveTime` come from the ledger time checks of the Daml code: `isLedgerTimeGE t` sets the minimum to `t`, and `isLedgerTimeLT t` the maximum to one microsecond before `t` (`ledger-time-bounds`). The `minLedgerTime` of a prepare request sets neither.
- Canton 3.5 rolls back neither a create nor a consuming exercise: it refuses both with `DAML_EFFECTFUL_ROLLBACK_ERROR`. So the Rollback of `rollback` holds a Fetch and a non-consuming Exercise that creates nothing.
- A prepare request takes one command only (`Preparing multiple commands is currently not supported`). A `CreateAndExercise` command makes the one transaction with two roots, a Create and an Exercise on the contract it creates (`create-and-exercise`). The participant prepares and hashes it, but execute refuses a transaction with more than one root before it checks the signatures: `Transaction with multiple root nodes are not supported`. Both refusals hold while the participant's `enforceSingleRootNode` is set, which the wallet's local Canton setup leaves at its default (`InteractiveSubmissionServiceImpl.scala:180-185` and `codec/ExternalTransactionProcessor.scala:272-278` in `community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/platform/apiserver/services/command/interactive/`).
- A numeric has as many decimals as its scale: `v2-numeric-scales` and `v3-numeric-scales` hold the `Numeric 0` values 0 and -1, written `0.` and `-1.`, and the `Decimal` 1, written `1.0000000000`. The entries of a text map are in the code point order of their keys: in `create-unicode-text` the keys are z, é, U+FF5E and U+1F600, and UTF-16 code units would put U+1F600 before U+FF5E. Those of a gen map are in the order of their keys (`maps`). The trailing None fields of a record are left out (`optional-nested`). An implementation hashes values as they are: one that sorts the entries again, by UTF-16 code units say, or adds the missing fields, gets another hash.
- Every input contract has an `eventBlob`, and `metadata.globalKeyMapping` is empty. No scheme hashes either.

## How the vectors were made

[README.md](README.md#generating-the-vectors) says how to run the generators of `generator/`.

- `v2/`, `v3/` and `held-out/`: `generate-vectors.ts`, on the local Canton setup of the wallet repository (`pnpm start:canton --network=mainnet`), which runs Canton 3.5.10 with protocol version 35. The `synchronizerId` in the metadata of every accepted and held-out vector ends in `::35-0`. A prepare response became a vector only if the package computed the participant's hash for it.
- The scenarios use the templates of the `hash-vectors` DAR, built from `generator/daml/` with Daml SDK 3.5.11 and `--target=2.3`. The vectors of `v2/` and `v3/` were captured with version 0.1.0 of the DAR, package id `7ac0650ef4d386a42bcbc7fe129f41806daa04063ff0970a5a3cdd6f4f829e68`, which did not have the templates of the held-out vectors yet. They stay as they were captured, so they name that package. The held-out vectors were captured with version 0.2.0, package id `a81ca4e098df0239f15c7df191e5ad6a7751f510abb99f49dd3807faed7c35b9`, which `generator/daml/` builds.
- `mutation/` and `reject/`: `mutate-vectors.ts`, from `v2/` and `v3/`. It edits a copy of the participant's bytes field by field, and what it does not edit stays as the participant wrote it. It writes the lengths of the messages around an edit anew, and it adds a field after the fields of its message with a number up to its own, the order in which the participant writes them.

[`captures/`](captures/README.md) holds two live checks made with the same tools, which are not part of the corpus: the corpus captured again on Canton 3.6.4 with protocol version 36, and four prepare responses with a ledger time bound before 1970.

## Scenarios

[`generator/daml/daml/HashVectors.daml`](generator/daml/daml/HashVectors.daml) has the templates and choices. Each scenario ran once with V2, unless it is V3 only, and once with V3: `v2-<scenario>` and `v3-<scenario>` are two different transactions, not one transaction hashed twice. The transactions act as one external party, except that `create-multi-signatory` acts as two and `input-contracts-disclosed` as the second party. The metadata lists the contracts that an Exercise, a Fetch or a QueryByKey uses as input contracts, so the scenarios on `Driver` all have the Driver among them. In the third column, the children of a node follow it in brackets.

| Scenario                    | V2  | Transaction                                                                                                                                           |
| --------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-plain`              | yes | Create `Plain`, a record of one party                                                                                                                 |
| `create-all-values`         | yes | Create `AllKinds`, with one field of each of the 16 value types                                                                                       |
| `create-unicode-text`       | yes | Create `Texts`: two- to four-byte UTF-8, a combining accent, a zero width joiner, Hebrew, whitespace, U+FEFF, U+FFFF; map keys: z, é, U+FF5E, U+1F600 |
| `create-multi-signatory`    | yes | Create `Joint` with two signatories, who both act and both sign                                                                                       |
| `create-empty-collections`  | yes | Create `Empties`: an empty list, text map, gen map and text, None, and a list that holds an empty list                                                |
| `create-and-exercise`       | yes | Two roots: Create `Plain`, and the non-consuming Exercise `Check` on it. Not executed, see above                                                      |
| `exercise-consuming`        | yes | Consuming Exercise `Plain.Replace` [Create `Plain`]                                                                                                   |
| `exercise-nonconsuming`     | yes | Non-consuming Exercise `Plain.Check`, which returns a Bool                                                                                            |
| `exercise-archive`          | yes | Consuming Exercise `Archive` on a `Plain`                                                                                                             |
| `exercise-nested-creates`   | yes | Exercise `Driver.NestedCreates` [Create, Exercise [Create, Exercise [Create]]]                                                                        |
| `exercise-deep-nesting`     | yes | Exercise `Driver.DeepNesting` [Exercise [Exercise [Exercise `Driver.MakePlain` [Create]]]]                                                            |
| `exercise-choice-observers` | yes | Exercise `Plain.Announce` with a choice observer                                                                                                      |
| `exercise-interface`        | yes | Exercise `Poke` on a `Plain` through the interface `Asset`, so with `interfaceId`                                                                     |
| `exercise-result-record`    | yes | Exercise `Plain.Describe`, which returns a record                                                                                                     |
| `fetch-in-choice`           | yes | Exercise `Driver.FetchPlain` [Fetch `Plain`]                                                                                                          |
| `fetch-interface`           | yes | Exercise `Driver.FetchAsset` [Fetch `Plain` through `Asset`, so with `interfaceId`]                                                                   |
| `numeric-scales`            | yes | Create `Numerics`: numerics of scale 0, 10 and 37, of up to 38 digits, negative and zero                                                              |
| `time-bounds`               | yes | Create `Times`: the first and the last timestamp and date, the epoch and the microsecond and the day before it                                        |
| `optional-nested`           | yes | Create `Optionals`: None, Some, Some None, Some (Some x), three levels of optional, Some of a record, and a trailing None left out                    |
| `maps`                      | yes | Create `Maps`: a text map, a text map of text maps with an empty one, gen maps with Int keys and with record keys                                     |
| `variant-enum`              | yes | Create `Variants`: variants of a value and of fields, which make a record of type `Animal.Dog`, enums, `Either`                                       |
| `input-contracts-disclosed` | yes | Exercise `Shared.Use` by a party that does not see the contract, which the prepare request gives as a disclosed contract                              |
| `ledger-time-bounds`        | yes | Exercise `Driver.CheckTime`, with the minimum and maximum ledger effective time in the metadata                                                       |
| `rollback`                  | yes | Exercise `Driver.TryCatch` [Rollback [Fetch `Driver`, Exercise `Driver.Noop`]]                                                                        |
| `create-with-key`           | no  | Create `Keyed` with a key                                                                                                                             |
| `exercise-by-key`           | no  | Exercise `Driver.ArchiveByKey` [consuming Exercise `Archive` on `Keyed`, with `byKey` and the key]                                                    |
| `fetch-by-key`              | no  | Exercise `Driver.FetchKeyed` [Fetch `Keyed`, with `byKey` and the key]                                                                                |
| `lookup-by-key-found`       | no  | Exercise `Driver.LookupKeyed` [QueryByKey, not exhaustive, with the contract it found]                                                                |
| `lookup-by-key-empty`       | no  | Exercise `Driver.LookupKeyed` [QueryByKey, exhaustive, without a contract]                                                                            |
| `max-record-time`           | no  | Create `Plain`, with `maxRecordTime` in the metadata                                                                                                  |
| `int64-big`                 | no  | Create `Ints`: 2^53 + 1, -(2^53 + 1), and the largest and the smallest int64                                                                          |

`int64-big` is V3 only because `@canton-network/core-tx-visualizer` 1.9.1 and 1.14.0 read an `Int64` value with `parseInt` (`src/hashing_scheme_v2.ts:282` in 1.14.0), which rounds a value above 2^53 or below -2^53, and this repository runs the V2 vectors against 1.9.1. `core/tx-hashing/src/__tests__/fixtures/big-int64-v2.json` is a V2 transaction with such a value, for the package's own test. Timestamps beyond 2^53 are fine under V2, as in `v2-time-bounds`: both versions read them with `BigInt` (`src/hashing_scheme_v2.ts:292` in 1.14.0).

## Held-out vectors

The held-out vectors check the package against participant output that did not exist while it was written. They were captured in one later run, from templates and values that no other vector has: `Escrow`, `Ticket`, `Tag`, `Registry` and the interface `Badge`, at the end of `HashVectors.daml`. The code of the package did not change for them: in that run the package hashed these transactions for the first time, and each gave the participant's hash. A held-out transaction that the package hashes differently is a bug to report, not a vector to make pass. The run ended with `held-out: 12 written, mismatches: 0, executed: 12 ok, refused as expected: 0`.

Each scenario has a contract key, which V2 does not hash, and ran with V3 only. Between them they hold each part of the hash that V3 changes:

- the encoding without the version prefixes of V2: all twelve;
- a key on a create node: `create-record-key`, `create-variant-key`, `create-unicode-key`, and below an exercise in `by-key-in-choice`, `exercise-by-key-command` and `max-record-time-by-key`;
- a key on an exercise node: with `byKey = false` in `exercise-record-key` and `exercise-interface-keyed`, with `byKey = true` in `by-key-in-choice`, `by-key-in-rollback`, `exercise-by-key-command` and `max-record-time-by-key`;
- a key on a fetch node: with `byKey = false` in `fetch-keyed-by-id`, with `byKey = true` in `exercise-record-key`, `by-key-in-choice` and `by-key-in-rollback`;
- `QueryByKey` nodes that find contracts, in `exercise-record-key`, `query-by-key-several`, `by-key-in-choice` and `by-key-in-rollback`, and that find none, in `exercise-record-key` and `query-by-key-variant-key-empty`;
- `metadata.maxRecordTime`: `max-record-time-by-key`.

The input contracts of the metadata, which V3 hashes as create nodes with their keys, include a contract with a key in all scenarios but the three creates and `query-by-key-variant-key-empty`. The transactions act as the owner, except that `create-record-key` acts as both parties. Every node on an `Escrow`, a `Ticket` or a `Tag` carries its key: a node by key has `byKey = true`, one by contract id `byKey = false`. In the second column, the children of a node follow it in brackets.

| Scenario                         | Transaction                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-record-key`              | Create `Escrow`, signed by both parties: its key is a record of type `EscrowKey`, with both parties as maintainers                                  |
| `create-variant-key`             | Create `Ticket`: its key is a tuple of a party, a text, the variant `Seat.Numbered`, which holds a record, and `Some (Some "Balcon")`               |
| `create-unicode-key`             | Create `Tag`, with the text `ключ · 鍵 · 🔑` in its key                                                                                             |
| `exercise-record-key`            | Exercise `Escrow.Audit` by contract id [QueryByKey that finds the `Escrow`, QueryByKey of another key that finds none, Fetch `Escrow` by key]       |
| `exercise-interface-keyed`       | Exercise `Present` on a `Tag` by contract id through the interface `Badge`, so with `interfaceId`                                                   |
| `fetch-keyed-by-id`              | Exercise `Registry.Inspect` [Fetch `Tag` by contract id]                                                                                            |
| `query-by-key-several`           | Exercise `Registry.FindAll` [QueryByKey, exhaustive, with the two `Tag` contracts that have the key]                                                |
| `query-by-key-variant-key-empty` | Exercise `Registry.FindTicket` [QueryByKey that finds none: its key holds `Seat.Standing`, a constructor without fields, and `Some None`]           |
| `by-key-in-choice`               | Exercise `Registry.Sweep` [Fetch `Tag` by key, consuming Exercise `Tag.Rename` by key [Create `Tag`], QueryByKey that finds the `Tag` just created] |
| `by-key-in-rollback`             | Exercise `Registry.Rehearse` [Rollback [Fetch `Tag` by key, Exercise `Tag.Ping` by key, QueryByKey, exhaustive, with one contract]]                 |
| `exercise-by-key-command`        | An `ExerciseByKey` command: consuming Exercise `Ticket.Reseat` by key [Create `Ticket`]                                                             |
| `max-record-time-by-key`         | An `ExerciseByKey` command: consuming Exercise `Tag.Rename` by key [Create `Tag`], with `maxRecordTime` in the metadata                             |

## Mutation vectors

A mutation vector is an accepted vector with one byte changed in a field that its scheme hashes, and the hash that results. The change keeps the field valid and of the same length, so the bytes decode to the message of the accepted vector with that one value changed:

- In a string, the last ASCII letter or digit becomes the next one of its run, `0` to `9`, `a` to `f`, `g` to `z`, `A` to `F` or `G` to `Z`, the last of a run the first. A contract id stays hex and a numeric a numeric.
- In a seed, the lowest bit of the first byte flips.
- In a time, the lowest bit flips. The time moves by a microsecond, and of its varint only the first byte changes.

`source.mutation` gives the path of the field and the change. For a string or bytes that is the byte, counted from 0 within the field, with its old and new value, such as `transaction.nodes[0].v1.exercise.choiceId: byte 4, k to l`. For a time it is the old and the new time, such as `metadata.preparationTime: 1792889557664955 to 1792889557664954`. Under V2 and V3 the vectors change a contract id, a party, a numeric, a choice, a seed, a command id and the preparation time, and under V3 also the maximum record time and the text in a contract key.

No participant saw these bytes, so the expected hash is the one the package computes. Each changed field is one that the Python example hashes as it is written, and `python/check_vectors.py` checks every mutation vector against it. `core/tx-hashing/src/mutation.test.ts` makes such a change, one at a time, in every value of every accepted vector but `globalKeyMapping` and `eventBlob`, and checks that the hash changes. It also negates a bool and flips the lowest bit of a number, and it skips a string without an ASCII letter or digit. The test also takes a refusal where one changed byte can make the input invalid: in a node id, wherever it occurs, in `byKey`, and in an int64, a timestamp or a date, which can leave its range. A changed LF version, of a node or of the transaction, is no version that a scheme hashes, so there the test expects `UNSUPPORTED_LF_VERSION`, and the corpus has such reject vectors (`reject-v2-lf-2-2`, `reject-v3-lf-3`, `reject-v3-transaction-lf-3`).

## Reject vectors

Each reject vector is an accepted vector with an edit, another scheme or limits, which `source.mutation` describes. Bytes that the edit does not touch are the participant's. The error codes are those of the package, which the Error codes section of `core/tx-hashing/README.md` describes, and each has at least one vector:

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

### Check order

A vector expects the first problem that the package finds, checking in this order:

1. the scheme;
2. the limits in the options;
3. the bytes, unknown fields included;
4. the transaction and its roots;
5. `maxNodes`;
6. the node ids, in the order of `transaction.nodes`;
7. each reference, depth first from the roots, for its id, its node, a cycle, a second reference and `maxNodeDepth`;
8. nodes that no root reaches;
9. the node ids of `nodeSeeds`, and two seeds for one node;
10. the metadata;
11. the length of each seed and seeds of nodes that take none, then create and exercise nodes without a seed;
12. each node, depth first from the roots and before its children, for its version, LF version and keys and then its fields in the order they are hashed, values against `maxValueDepth`;
13. the LF version of the transaction;
14. the fields of the metadata, under V2 `maxRecordTime` first.

### Vectors that break a second rule

Most reject vectors break one rule. Those below break a second rule along with it, so an implementation that checks in another order may refuse them with another code.

- `reject-v2-own-child`, `reject-v3-two-node-cycle`: the node in the cycle has a second reference as well, as in every cycle that a root reaches. `CYCLE` comes first.
- `reject-v2-party-in-unknown-value-member`: the `Value` has none of the members that it defines. `UNKNOWN_FIELD` comes first, from decoding.
- `reject-v2-key`, `reject-v2-by-key`: the key or `byKey = true` is in a node of LF version `2.1`, which the decoder refuses under any scheme (`Decoder:188-223`), and V2 hashes no other version. Under V2 the package refuses them as fields that V2 does not hash, `FIELD_NOT_COVERED_BY_SCHEME`.
- `reject-v2-query-by-key`: the node has LF version `2`, which V2 does not hash, and in `2.1` it could not hold its key. `FIELD_NOT_COVERED_BY_SCHEME` comes first: V2 refuses a QueryByKey node before it reads its LF version.
- `reject-v2-key`, `reject-v2-query-by-key`: the transaction has LF version `2`, which V2 does not hash. The nodes come first.
- `reject-v3-empty`: no bytes are also the encoding of an empty message, which has no transaction. `DECODE_FAILED` comes first: the package refuses empty input before it decodes.
