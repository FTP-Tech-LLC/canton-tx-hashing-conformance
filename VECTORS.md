# Hash vectors: reference

This file is the reference for people who implement the prepared transaction hash. It says:

- [where `@canton-network/core-tx-hashing` (the package below), Canton's Scala hasher and Canton's Python example differ](#where-the-package-differs-from-the-scala-hasher-and-the-python-example);
- [what a participant writes](#what-the-participant-writes);
- [how the vectors were made](#how-the-vectors-were-made);
- what each [scenario](#scenarios), [held-out](#held-out-vectors), [mutation](#mutation-vectors) and [reject](#reject-vectors) vector covers.

The vectors live in `core/tx-hashing/vectors/` of the wallet repository. The `README.md` there gives their file format, folders and how to run them from another language.

Paths such as `core/tx-hashing/src/mutation.test.ts` are paths in the wallet repository.

## Where the package differs from the Scala hasher and the Python example

A participant hashes with Scala. Canton also ships an implementation in Python as an example, the Python example below. The package hashes input as written, as the Python example does, and refuses some input that Python hashes.

- For each accepted vector, Python and the package give the participant's hash.
- For what a participant writes, the three agree, except on a time before 1970, which Python cannot hash ([below](#hashed-by-the-package-and-the-participant-not-by-python)).
- They can differ for input a participant does not write, and that is where the reject vectors are.
- The mutation vectors are such input too, but they change only fields that Python and the package hash alike.

Each table below says what the Python example and the participant do with an input, and how the package treats it. Each cell cites its sources in small type. An empty cell means this file does not cover that case.

About the sources:

- They are cited from `digital-asset/canton` at the tag `v3.5.1`, unless a cell names another version. The three Python files are the same in every version named here.
- The vectors come from a Canton 3.5.10 participant. The tags of the 3.5 releases mark commits of Canton's main branch, which later changed some of the cited code.
- The released 3.5.10 and 3.5.18 match the branch `release-line-3.5` instead. There the cited Scala code does the same as at `v3.5.1`, with some lines shifted.
- Canton 3.6 is cited at `v3.6.4`. Its cited files are the same on the branch `release-line-3.6`.

The cited files:

- Python: [`community/app/src/pack/examples/08-interactive-submission/`](https://github.com/digital-asset/canton/tree/v3.5.1/community/app/src/pack/examples/08-interactive-submission), files `daml_transaction_hashing_common.py` (`common.py` below), `daml_transaction_hashing_v2.py` (`v2.py`) and `daml_transaction_hashing_v3.py` (`v3.py`).
- Scala, the hasher: [`community/base/src/main/scala/com/digitalasset/canton/protocol/hash/`](https://github.com/digital-asset/canton/tree/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/protocol/hash), and in [`community/base/src/main/scala/com/digitalasset/canton/crypto/`](https://github.com/digital-asset/canton/tree/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/crypto) the files `HashBuilder.scala` and `InteractiveSubmission.scala`.
- Scala, the participant's decoder and encoder: [`community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/platform/apiserver/services/command/interactive/codec/`](https://github.com/digital-asset/canton/tree/v3.5.1/community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/platform/apiserver/services/command/interactive/codec), files `PreparedTransactionDecoder.scala` (`Decoder` below), `PreparedTransactionEncoder.scala` (`Encoder`), `EnrichedTransactionData.scala` and `ExternalTransactionProcessor.scala`.
- Scala, the participant's check of seeds: [`community/common/src/main/scala/com/digitalasset/canton/protocol/WellFormedTransaction.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/common/src/main/scala/com/digitalasset/canton/protocol/WellFormedTransaction.scala) and [`community/base/src/main/scala/com/digitalasset/canton/util/LfTransactionUtil.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/util/LfTransactionUtil.scala).
- Scala, the conversion of values: [`community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/ledger/api/validation/ValueValidator.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/ledger/api/validation/ValueValidator.scala) (which also holds `StricterValueValidator`), [`community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/ledger/api/util/LfEngineToApi.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/ledger/api/util/LfEngineToApi.scala) and [`community/base/src/main/scala/com/digitalasset/canton/serialization/ProtoConverter.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/serialization/ProtoConverter.scala).
- Scala, Daml-LF: [`community/daml-lf/transaction/src/main/scala/com/digitalasset/daml/lf/crypto/Hash.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/daml-lf/transaction/src/main/scala/com/digitalasset/daml/lf/crypto/Hash.scala), [`community/daml-lf/transaction/src/main/scala/com/digitalasset/daml/lf/transaction/SerializationVersion.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/daml-lf/transaction/src/main/scala/com/digitalasset/daml/lf/transaction/SerializationVersion.scala), [`community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/IdString.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/IdString.scala), [`community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/NumericModule.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/NumericModule.scala) and [`community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/Time.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/daml-lf/data/src/main/scala/com/digitalasset/daml/lf/data/Time.scala).
- Scala, the ledger time bounds: [`community/base/src/main/scala/com/digitalasset/canton/data/LedgerTimeBoundaries.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/data/LedgerTimeBoundaries.scala).
- Scala, synchronizer ids: [`community/base/src/main/scala/com/digitalasset/canton/topology/Member.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/topology/Member.scala) and [`community/base/src/main/scala/com/digitalasset/canton/version/ProtocolVersion.scala`](https://github.com/digital-asset/canton/blob/v3.5.1/community/base/src/main/scala/com/digitalasset/canton/version/ProtocolVersion.scala).

### Refused by the package, hashed by Python

#### Seeds

| Input                                        | Python example                                                                           | Participant                                                                                                                                                                                                                   | Package                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Create node without a seed                   | Hashes it as one with an absent seed<br><sub>`common.py:47-51`, `v3.py:111`</sub>        | The hasher refuses it, as `enforceNodeSeedForCreateNodes` is true, and so does `checkSeeds`<br><sub>`NodeHashBuilderCommon.scala:166-173`, `VersionedTransactionHasher.scala:26`, `WellFormedTransaction.scala:189-217`</sub> | `MISSING_NODE_SEED`           |
| Exercise node without a seed                 | Raises a `TypeError`<br><sub>`v3.py:131`, `common.py:38-40`</sub>                        | The hasher and `checkSeeds` refuse it<br><sub>`NodeHashBuilderCommon.scala:166-173`, `WellFormedTransaction.scala:189-217`</sub>                                                                                              | `MISSING_NODE_SEED`           |
| Seed that is not 32 bytes                    | Hashes it: a seed is written without a length<br><sub>`common.py:38-40`</sub>            | The decoder takes only 32 bytes<br><sub>`Decoder:126-140`, `Hash.scala:107-112`</sub>                                                                                                                                         | `INVALID_VALUE`               |
| Seed on a fetch, rollback or QueryByKey node | Ignores it: it never reads a seed for these nodes<br><sub>`v3.py:94-99`, `172-181`</sub> | `checkSeeds` refuses it: `nodeHasSeed` is true for create and exercise nodes only<br><sub>`WellFormedTransaction.scala:189-217`, `LfTransactionUtil.scala:59-65`</sub>                                                        | `FIELD_NOT_COVERED_BY_SCHEME` |

#### Keys

| Input                                                         | Python example                                                                         | Participant                                                                                                                  | Package                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Key or `byKey = true` in a node of LF version `2.1`, under V3 | Hashes the key and `byKey` of any node<br><sub>`v3.py:118`, `148-149`, `167-168`</sub> | The decoder and the hasher refuse both<br><sub>`Decoder:188-223`, `NodeHashBuilderCommon.scala:38`, `66-67`, `122-123`</sub> | `UNSUPPORTED_LF_VERSION` |
| Key hash that is not 32 bytes                                 | Hashes it with the key<br><sub>`v3.py:118`, `148-149`, `167-168`</sub>                 | The decoder refuses it<br><sub>`Decoder:169-186`, `Hash.scala:107-112`</sub>                                                 | `INVALID_VALUE`          |

Under V2 the package refuses a key or `byKey` as a field that V2 does not hash ([below](#fields-a-scheme-does-not-hash)).

#### LF versions

The Python example hashes any version string.

| Input                                                                        | Participant                                                                                                                                                                                                                    | Package                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| An LF version that the decoder does not know                                 | Canton 3.5 knows `2.1`, `2` and `dev`. Canton 3.6 also knows `3`.<br><sub>`SerializationVersion.scala:26-30`; `28-31` at v3.6.4</sub>                                                                                          | `UNSUPPORTED_LF_VERSION`                                                                  |
| A node's LF version above the newest of its scheme: `2.1` for V2, `2` for V3 | The hasher refuses it<br><sub>`NodeHashBuilder.scala:80-124`</sub>                                                                                                                                                             | `UNSUPPORTED_LF_VERSION`                                                                  |
| The transaction's LF version above the newest of its scheme                  | Canton 3.5 hashes it, as its hasher does not check this version. Canton 3.6 refuses it.<br><sub>`VersionedTransactionHasher.scala:23-26` at v3.6.4; no such check at v3.5.1 or on `release-line-3.5`</sub>                     | `UNSUPPORTED_LF_VERSION`: the package checks it as it checks a node's                     |
| The transaction's LF version older than one of its nodes                     | Canton 3.5 hashes it. Canton 3.6 refuses it. No captured vector has such a transaction.<br><sub>`PreparedTransactionDecoder.scala:226-239`, called at `440`, at v3.6.4; no such check at v3.5.1 or on `release-line-3.5`</sub> | Hashes it. As Canton 3.6 refuses the transaction, a signature over this hash fails there. |

#### Node ids and the shape of the forest

The package takes canonical ids and a forest in which every node is reached once, with at most one seed per node.

| Input                                               | Python example                                             | Participant                                                                                                                                                                                                                                           | Package                   |
| --------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Node id that is not canonical, such as `01` or `+1` | Compares ids as strings<br><sub>`common.py:71-77`</sub>    | The decoder reads `01` and `+1` as 1, with `toIntOption`<br><sub>`Decoder:158-164`; `StringParsers.parseInt` in `StringParsers.scala:103-135`, in `src/library/scala/collection/` of `scala/scala` v2.13.16, the Scala version of Canton 3.5.10</sub> | `INVALID_NODE_ID`         |
| Two seeds for one node                              | Uses the first<br><sub>`common.py:71-77`</sub>             | Uses the last<br><sub>`EnrichedTransactionData.scala:103-105`</sub>                                                                                                                                                                                   | `DUPLICATE_NODE_SEED`     |
| Two nodes with one id                               | Keeps the last<br><sub>`common.py:177-181`</sub>           |                                                                                                                                                                                                                                                       | `DUPLICATE_NODE_ID`       |
| A node that no root reaches                         | Never looks at it<br><sub>`common.py:88-105`</sub>         |                                                                                                                                                                                                                                                       | `ORPHAN_NODE`             |
| A node that two parents list                        | Hashes it twice<br><sub>`common.py:88-105`</sub>           |                                                                                                                                                                                                                                                       | `SHARED_CHILD`            |
| A child id with no node                             | Raises a `KeyError`<br><sub>`common.py:88-105`</sub>       |                                                                                                                                                                                                                                                       | `DANGLING_NODE_REFERENCE` |
| A cycle                                             | Raises a `RecursionError`<br><sub>`common.py:88-105`</sub> |                                                                                                                                                                                                                                                       | `CYCLE`                   |

#### Hex

| Input                                                                                 | Python example                                                                                                                                                                        | Participant                                                                                                                                                                                                                                                              | Package       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Contract id that is not lower case hex of even length, such as `AB`, `abc` or `ab cd` | `bytes.fromhex` skips ASCII whitespace between bytes and takes upper case digits, so `00AB` hashes as `00ab`. It raises a `ValueError` on odd length.<br><sub>`common.py:43-44`</sub> | Refuses it in a node or a QueryByKey result (`Decoder`) as in a value (`ValueValidator`). Both parse it as a `HexString`, which Guava's `base16().lowerCase()` must `canDecode`.<br><sub>`Decoder:117-125`, `ValueValidator.scala:52-55`, `IdString.scala:159-167`</sub> | `INVALID_HEX` |

#### Fields a scheme does not hash

| Input                                                                                               | Python example                                                 | Participant                                                                                           | Package                                                                       |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `key`, `byKey` or `max_record_time` under V2                                                        | Ignores them: V2 never reads them<br><sub>`v2.py:90-204`</sub> |                                                                                                       | `FIELD_NOT_COVERED_BY_SCHEME`: a signature over a V2 hash would not bind them |
| A QueryByKey node under V2                                                                          | Raises a `ValueError`<br><sub>`v2.py:87`</sub>                 |                                                                                                       | `FIELD_NOT_COVERED_BY_SCHEME`                                                 |
| `metadata.globalKeyMapping`, and the `eventBlob` of each input contract (`metadata.inputContracts`) | Does not hash them                                             | Writes `globalKeyMapping` empty, as it is deprecated. Hashes neither.<br><sub>`Encoder:360-363`</sub> | Accepts them. No scheme hashes them, so a signature does not cover them.      |

#### Times outside Daml's range

Daml's range is 0001-01-01T00:00:00Z to 9999-12-31T23:59:59.999999Z for a timestamp, and 0001-01-01 to 9999-12-31 for a date.

| Input                                           | Python example                                                                                                          | Participant                                                                                                                                                                 | Package         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| A `Timestamp` or `Date` value outside the range | Hashes it                                                                                                               | The decoder converts every value with `StricterValueValidator`, which refuses it<br><sub>`Decoder:88-96`, `ValueValidator.scala:70-81`, `Time.scala:52-65`, `152-167`</sub> | `INVALID_VALUE` |
| A time of the metadata after the range          | Hashes it                                                                                                               | The decoder reads it as a timestamp and refuses it<br><sub>`Decoder:142-147`, `Time.scala:52-65`, `152-167`</sub>                                                           | `INVALID_VALUE` |
| A time of the metadata before the range         | Raises `struct.error`, as on every time before 1970 ([below](#hashed-by-the-package-and-the-participant-not-by-python)) | The decoder reads it as a timestamp and refuses it<br><sub>`Decoder:142-147`, `Time.scala:52-65`, `152-167`</sub>                                                           | `INVALID_VALUE` |

### Hashed by the package and the participant, not by Python

The times of the metadata are uint64 fields: `preparationTime`, `minLedgerEffectiveTime`, `maxLedgerEffectiveTime`, `maxRecordTime` and the `createdAt` of an input contract. A time before 1970 arrives as 2^64 minus its magnitude, as when Daml code checks `isLedgerTimeGE t` for a `t` before 1970.

| Input                              | Python example                                                                                                        | Participant                                                                                                                                                                                                                                                          | Package                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| A time of the metadata before 1970 | Reads the field as an unsigned number, and `encode_int64` raises `struct.error` on it<br><sub>`common.py:24-25`</sub> | Writes it from a signed 64-bit number. The decoder reads it back as that number, and the hasher hashes it as an int64.<br><sub>`Encoder:119`, `324`; `Decoder:142-147`, `v2/TransactionMetadataHasher.scala:44-61`, `v3/TransactionMetadataHasher.scala:27-30`</sub> | Hashes it as the participant does |

No accepted vector holds such a time, since each must give its hash in Python as well. [`captures/pre-1970/`](captures/README.md#pre-1970) has four prepare responses with one, for which the package gave the participant's hash.

### Hashed differently by Scala

Scala hashes the inputs below in a normal form. The package hashes them as written, as the Python example does, which cannot hash the bound of 0001-01-01, a time before 1970.

For an empty record label both write `01` and the empty string, as a proto3 string is never `None`. The participant writes the inputs below in the normal form, or never, so for its output the hashes agree.

| Input                                                                                                           | Scala                                                                                                                                                                                                                                     | Participant's output                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `minLedgerEffectiveTime` of 0001-01-01T00:00:00Z or a `maxLedgerEffectiveTime` of 9999-12-31T23:59:59.999999Z | The decoder reads it as no bound, so the hasher writes `00`<br><sub>`Decoder:428-435`, `LedgerTimeBoundaries.scala:11-16`, `v2/TransactionMetadataHasher.scala:44-55`</sub>                                                               | Has a bound only where it limits the time, so never these two<br><sub>`Encoder:367-374`</sub>                                                                                                                                                                                                              |
| An empty record label                                                                                           | Hashes a label as an optional name. The decoder reads an empty label as no label, so the hasher writes `00`.<br><sub>`LfValueHashBuilder.scala:105-112`, `Decoder:88-96`, `ValueValidator.scala:36`</sub>                                 | The labels of the enriched value: with `verbose = true` it copies each LF label, and `""` for a missing one. The transaction is enriched before it is encoded, so only crafted input has empty labels.<br><sub>`Encoder:84`, `LfEngineToApi.scala:147`, `ExternalTransactionProcessor.scala:234-247`</sub> |
| Signatories, stakeholders, acting parties, choice observers, key maintainers and the `actAs` parties            | Hashes them as sets, sorted and without duplicates<br><sub>`HashBuilder.scala:148-153`, `NodeHashBuilderCommon.scala:49-50`, `74-77`, `131-133`, `144`, `v3/NodeHashBuilder.scala:54`, `InteractiveSubmission.scala:63`</sub>             | Sorted<br><sub>`Encoder:148-149`, `162-165`, `179-181`, `298`, `333`</sub>                                                                                                                                                                                                                                 |
| Input contracts                                                                                                 | Sorts them by contract id<br><sub>`InteractiveSubmission.scala:32`, `71`, `v2/TransactionMetadataHasher.scala:57-59`</sub>                                                                                                                | Sorted by contract id<br><sub>`Encoder:349-351`</sub>                                                                                                                                                                                                                                                      |
| The entries of a text map                                                                                       | Orders them by key: the decoder builds a `SortedLookupList`, which the hasher hashes in order<br><sub>`ValueValidator.scala:113-130`, `LfValueHashBuilder.scala:101-104`</sub>                                                            | Sorted<br><sub>`LfEngineToApi.scala:86-93`</sub>                                                                                                                                                                                                                                                           |
| A numeric                                                                                                       | Hashes `Numeric.toString` of the parsed value. That gives the numeric as written, except `-0.0`, which is hashed as `0.0`.<br><sub>`HashBuilder.scala:124-128`, `ValueValidator.scala:236-240`, `NumericModule.scala:188-215`</sub>       | Written with the same `toString`<br><sub>`LfEngineToApi.scala:69-70`</sub>                                                                                                                                                                                                                                 |
| The transaction UUID                                                                                            | Hashes `UUID.toString` of the UUID that the lenient `UUID.fromString` parsed<br><sub>`v2/TransactionMetadataHasher.scala:41`, `ProtoConverter.scala:240-247`, `Decoder:473-475`</sub>                                                     | Written with `UUID.toString`<br><sub>`ProtoConverter.scala:241`, `Encoder:365`</sub>                                                                                                                                                                                                                       |
| The synchronizer id                                                                                             | Reads the protocol version and the serial of a physical id as integers, and hashes the id printed again<br><sub>`Decoder:507-513`, `Member.scala:300-322`, `ProtocolVersion.scala:178-213`, `v2/TransactionMetadataHasher.scala:43`</sub> | The id printed<br><sub>`Encoder:121`, `364`</sub>                                                                                                                                                                                                                                                          |

Details of the normal form:

- Numerics: the decoder parses a numeric with `Numeric.fromString`, which accepts only `-?([1-9]\d*|0)\.(\d*)` and keeps the number of decimals as the scale. `toString` prints `toPlainString`, and `BigDecimal` has no negative zero.
- UUIDs: `UUID.fromString` is lenient: `123E4567-E89B-12D3-A456-426614174000` is hashed in lower case, and `1-2-3-4-5` as `00000001-0002-0003-0004-000000000005`.
- Synchronizer ids: `...::035-0`, `...::+35-0` and `...::35-00` are hashed as `...::35-0`, and a protocol version of `2147483647` or `DEV` as `dev`.

Python sources: `common.py:169-170` for record labels, `common.py:61-64` for lists and maps, `common.py:115-116` for numerics, `v2.py:180` and `v3.py:205` for the UUID.

### Decoder leniency

The package decodes with protobuf-ts and does not require the canonical encoding.

| Input                                                                                                                                                                       | Python example (upb)                                               | Participant                                                                                                                                                                        | Package (protobuf-ts)                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A malformed encoding. Example: `v2-create-plain` with the declared length of its `transaction` field shortened by one byte.                                                 | A decode error                                                     |                                                                                                                                                                                    | Decodes it to the message that is hashed, and gives the participant's hash |
| A known field number written with another wire type. Example: `v2-create-plain` with the `contract_id` of its create (field 2, a string) written once more as the varint 0. | Skips the field as unknown and gives the hash of `v2-create-plain` | Its parser skips the field as unknown. Canton's own decoder and hasher from the canton-open-source 3.5.18 library, run offline on these bytes, give the hash of `v2-create-plain`. | Reads it as that field, and hashes an empty contract id                    |

Reject vectors use neither kind of encoding (a truncated input is cut at its end). So a decoder that checks the encoding strictly passes the corpus.

## What the participant writes

The accepted and held-out vectors show this.

### Contract keys

- A node with a contract key has `lfVersion` `2`, and so has a transaction with such a node. All other nodes keep `2.1`, although the DAR targets LF 2.3.
- With `HASHING_SCHEME_VERSION_V2` the participant refuses to prepare a transaction with a key, so the scenarios with keys are V3 only. The error, from `TransactionHash.scala:26-31` of the Scala hasher: `Cannot hash node with LF serialization version V2 using hashing scheme V2. Does the transaction use contract keys? Please using hashing scheme V3 or higher.`
- `lookupByKey` is a `QueryByKey` node. It has `exhaustive: false` with the contract id it found in `result` (`v3-lookup-by-key-found`), or `exhaustive: true` with an empty `result` (`v3-lookup-by-key-empty`).
- Keys need not be unique: `lookupAllByKey` of `DA.ContractKeys` is a `QueryByKey` node with `exhaustive: true` and every contract that has the key. `held-out-v3-query-by-key-several` has two.
- A `QueryByKey` node also finds a contract that its transaction created (`held-out-v3-by-key-in-choice`).
- A node on a contract with a key carries the key also when the contract is used by its contract id, with `byKey = false`. An exercise does in `held-out-v3-exercise-record-key` and `held-out-v3-exercise-interface-keyed`, a fetch in `held-out-v3-fetch-keyed-by-id`.

### Ledger times

- `metadata.maxRecordTime` is set when the prepare request sets `maxRecordTime`, under V2 too, although V2 does not hash it. The package refuses such a V2 transaction (`FIELD_NOT_COVERED_BY_SCHEME`), so `max-record-time` is V3 only.
- `metadata.minLedgerEffectiveTime` and `maxLedgerEffectiveTime` come from the ledger time checks of the Daml code (`ledger-time-bounds`). `isLedgerTimeGE t` sets the minimum to `t`, and `isLedgerTimeLT t` the maximum to one microsecond before `t`.

### Values

- A numeric has as many decimals as its scale. `v2-numeric-scales` and `v3-numeric-scales` hold the `Numeric 0` values 0 and -1, written `0.` and `-1.`, and the `Decimal` 1, written `1.0000000000`.
- The entries of a text map are in the code point order of their keys. In `create-unicode-text` the keys are z, é, U+FF5E and U+1F600, and UTF-16 code units would put U+1F600 before U+FF5E.
- The entries of a gen map are in the order of their keys (`maps`).
- The trailing None fields of a record are left out (`optional-nested`).
- An implementation hashes values as they are. One that sorts the entries again, by UTF-16 code units say, or adds the missing fields, gets another hash.
- Every input contract has an `eventBlob`, and `metadata.globalKeyMapping` is empty. No scheme hashes either.

### Rollbacks, commands and roots

- While the scenarios were built, Canton 3.5.10 refused to roll back a create or a consuming exercise, with `DAML_EFFECTFUL_ROLLBACK_ERROR`. So the Rollback of `rollback` holds a Fetch and a non-consuming Exercise that creates nothing.
- A prepare request takes one command only: `Preparing multiple commands is currently not supported`.
- A `CreateAndExercise` command makes the one transaction with two roots: a Create and an Exercise on the contract it creates (`create-and-exercise`). The participant prepares and hashes it.
- Execute refuses a transaction with more than one root before it checks the signatures: `Transaction with multiple root nodes are not supported`.
- Both refusals hold while the participant's `enforceSingleRootNode` is set, which the wallet's local Canton setup leaves at its default.

Sources for the two refusals: `InteractiveSubmissionServiceImpl.scala:180-185` and `codec/ExternalTransactionProcessor.scala:272-278` in `community/ledger/ledger-api-core/src/main/scala/com/digitalasset/canton/platform/apiserver/services/command/interactive/`.

## How the vectors were made

[README.md](README.md#generating-the-vectors) says how to run the generators of `generator/`.

| Folders                      | Made by               | From                                                                                                                                       |
| ---------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `v2/`, `v3/` and `held-out/` | `generate-vectors.ts` | The local Canton setup of the wallet repository (`pnpm start:canton --network=mainnet`), which runs Canton 3.5.10 with protocol version 35 |
| `mutation/` and `reject/`    | `mutate-vectors.ts`   | `v2/` and `v3/`                                                                                                                            |

For `v2/`, `v3/` and `held-out/`:

- The `synchronizerId` in the metadata of every accepted and held-out vector ends in `::35-0`.
- A prepare response became a vector only if the package computed the participant's hash for it.
- The scenarios use the templates of the `hash-vectors` DAR, built from `generator/daml/` with Daml SDK 3.5.11 and `--target=2.3`.

| DAR version | Package id                                                         | Vectors      |
| ----------- | ------------------------------------------------------------------ | ------------ |
| 0.1.0       | `7ac0650ef4d386a42bcbc7fe129f41806daa04063ff0970a5a3cdd6f4f829e68` | `v2/`, `v3/` |
| 0.2.0       | `a81ca4e098df0239f15c7df191e5ad6a7751f510abb99f49dd3807faed7c35b9` | `held-out/`  |

Version 0.1.0 did not have the templates of the held-out vectors yet. The `v2/` and `v3/` vectors stay as they were captured, so they name it. `generator/daml/` builds 0.2.0.

For `mutation/` and `reject/`, `mutate-vectors.ts` edits a copy of the participant's bytes field by field:

- What it does not edit stays as the participant wrote it.
- It writes the lengths of the messages around an edit anew.
- It inserts a new field in field-number order, after every field of its message with a lower or equal number, as the participant orders fields.

[`captures/`](captures/README.md) holds two live checks made with the same tools, which are not part of the corpus:

- the corpus captured again on Canton 3.6.4 with protocol version 36;
- four prepare responses with a ledger time bound before 1970.

## Scenarios

[`generator/daml/daml/HashVectors.daml`](generator/daml/daml/HashVectors.daml) has the templates and choices.

- Each scenario ran once with V2, unless it is V3 only, and once with V3. `v2-<scenario>` and `v3-<scenario>` are two different transactions, not one transaction hashed twice.
- The transactions act as one external party, except that `create-multi-signatory` acts as two and `input-contracts-disclosed` as the second party.
- The metadata lists the contracts that an Exercise, a Fetch or a QueryByKey uses as input contracts. So the scenarios on `Driver` all have the Driver among them.
- In the third column, the children of a node follow it in brackets.

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

`int64-big` is V3 only:

- `@canton-network/core-tx-visualizer` 1.9.1 and 1.14.0 read an `Int64` value with `parseInt` (`src/hashing_scheme_v2.ts:282` in 1.14.0). That rounds only a value that a double cannot hold exactly: 2^53 + 1 is rounded, while 2^53 + 2 and -2^63 are not.
- This repository runs the V2 vectors against 1.9.1.
- `core/tx-hashing/src/__tests__/fixtures/big-int64-v2.json` is a V2 transaction with such a value, for the package's own test.
- Timestamps beyond 2^53 are fine under V2, as in `v2-time-bounds`: both versions read them with `BigInt` (`src/hashing_scheme_v2.ts:292` in 1.14.0).

## Held-out vectors

The held-out vectors check the package against participant output that did not exist while it was written.

- They were captured in one later run, from templates and values that no other vector has: `Escrow`, `Ticket`, `Tag`, `Registry` and the interface `Badge`, at the end of `HashVectors.daml`.
- The code of the package did not change for them. In that run the package hashed these transactions for the first time, and each gave the participant's hash.
- The run ended with `held-out: 12 written, mismatches: 0, executed: 12 ok, refused as expected: 0`.

A held-out transaction that the package hashes differently is a bug to report, not a vector to make pass.

Each scenario has a contract key, which V2 does not hash, and ran with V3 only. Between them they hold each part of the hash that V3 changes:

| Part of the hash                                | Scenarios                                                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The encoding without the version prefixes of V2 | All twelve                                                                                                                                                           |
| A key on a create node                          | `create-record-key`, `create-variant-key`, `create-unicode-key`, and below an exercise in `by-key-in-choice`, `exercise-by-key-command` and `max-record-time-by-key` |
| A key on an exercise node, `byKey = false`      | `exercise-record-key`, `exercise-interface-keyed`                                                                                                                    |
| A key on an exercise node, `byKey = true`       | `by-key-in-choice`, `by-key-in-rollback`, `exercise-by-key-command`, `max-record-time-by-key`                                                                        |
| A key on a fetch node, `byKey = false`          | `fetch-keyed-by-id`                                                                                                                                                  |
| A key on a fetch node, `byKey = true`           | `exercise-record-key`, `by-key-in-choice`, `by-key-in-rollback`                                                                                                      |
| `QueryByKey` nodes that find contracts          | `exercise-record-key`, `query-by-key-several`, `by-key-in-choice`, `by-key-in-rollback`                                                                              |
| `QueryByKey` nodes that find none               | `exercise-record-key`, `query-by-key-variant-key-empty`                                                                                                              |
| `metadata.maxRecordTime`                        | `max-record-time-by-key`                                                                                                                                             |

- V3 hashes the input contracts of the metadata as create nodes with their keys. They include a contract with a key in all scenarios but the three creates and `query-by-key-variant-key-empty`.
- The transactions act as the owner, except that `create-record-key` acts as both parties.
- Every node on an `Escrow`, a `Ticket` or a `Tag` carries its key: a node by key has `byKey = true`, one by contract id `byKey = false`.
- In the second column, the children of a node follow it in brackets.

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

A mutation vector is an accepted vector with one byte changed in a field that its scheme hashes, and the hash that results.

The change keeps the field valid and of the same length. So the bytes decode to the message of the accepted vector with that one value changed.

| Field  | Change                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| String | The last ASCII letter or digit becomes the next one of its run: `0` to `9`, `a` to `f`, `g` to `z`, `A` to `F` or `G` to `Z`. The last of a run becomes the first. A contract id stays hex and a numeric a numeric. |
| Seed   | The lowest bit of the first byte flips.                                                                                                                                                                             |
| Time   | The lowest bit flips. The time moves by a microsecond, and of its varint only the first byte changes.                                                                                                               |

`source.mutation` gives the path of the field and the change:

- For a string or bytes, the byte, counted from 0 within the field, with its old and new value. For example `transaction.nodes[0].v1.exercise.choiceId: byte 4, k to l`.
- For a time, the old and the new time. For example `metadata.preparationTime: 1792889557664955 to 1792889557664954`.

The vectors change:

- under V2 and V3, a contract id, a party, a numeric, a choice, a seed, a command id and the preparation time;
- under V3 also the maximum record time and the text in a contract key.

No participant saw these bytes, so the expected hash is the one the package computes. Each changed field is one that the Python example hashes as it is written. `python/check_vectors.py` checks every mutation vector against it.

The package's test `core/tx-hashing/src/mutation.test.ts` makes such changes too:

- It makes them one at a time, in every value of every accepted vector but `globalKeyMapping` and `eventBlob`, and checks that the hash changes.
- It also negates a bool and flips the lowest bit of a number. It skips a string without an ASCII letter or digit.
- It takes a refusal where one changed byte can make the input invalid. That is in a node id, wherever it occurs, in `byKey`, and in an int64, a timestamp or a date, which can leave its range.
- A changed LF version, of a node or of the transaction, is no version that a scheme hashes. There the test expects `UNSUPPORTED_LF_VERSION`, and the corpus has such reject vectors: `reject-v2-lf-2-2`, `reject-v3-lf-3`, `reject-v3-transaction-lf-3`.

## Reject vectors

Each reject vector is an accepted vector with an edit, another scheme or limits, which `source.mutation` describes. Bytes that the edit does not touch are the participant's.

The error codes are those of the package, which the Error codes section of `core/tx-hashing/README.md` describes. Each has at least one vector:

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
12. each node, depth first from the roots and before its children:
    - its version, LF version and keys;
    - then its fields in the order they are hashed, values against `maxValueDepth`;
13. the LF version of the transaction;
14. the fields of the metadata, under V2 `maxRecordTime` first.

### Vectors that break a second rule

Most reject vectors break one rule. Those below break a second rule along with it, so an implementation that checks in another order may refuse them with another code.

| Vectors                                           | Second rule                                                                                                                                             | Code                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `reject-v2-own-child`, `reject-v3-two-node-cycle` | The node in the cycle has a second reference as well, as in every cycle that a root reaches.                                                            | `CYCLE` comes first.                                                                                    |
| `reject-v2-party-in-unknown-value-member`         | The `Value` has none of the members that it defines.                                                                                                    | `UNKNOWN_FIELD` comes first, from decoding.                                                             |
| `reject-v2-key`, `reject-v2-by-key`               | The key or `byKey = true` is in a node of LF version `2.1`, which the decoder refuses under any scheme (`Decoder:188-223`). V2 hashes no other version. | Under V2 the package refuses them as fields that V2 does not hash, `FIELD_NOT_COVERED_BY_SCHEME`.       |
| `reject-v2-query-by-key`                          | The node has LF version `2`, which V2 does not hash, and in `2.1` it could not hold its key.                                                            | `FIELD_NOT_COVERED_BY_SCHEME` comes first: V2 refuses a QueryByKey node before it reads its LF version. |
| `reject-v2-key`, `reject-v2-query-by-key`         | The transaction has LF version `2`, which V2 does not hash.                                                                                             | The nodes come first.                                                                                   |
| `reject-v3-empty`                                 | No bytes are also the encoding of an empty message, which has no transaction.                                                                           | `DECODE_FAILED` comes first: the package refuses empty input before it decodes.                         |
