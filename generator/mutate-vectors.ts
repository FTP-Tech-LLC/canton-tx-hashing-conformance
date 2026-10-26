/**
 * Makes the mutation and reject vectors, vectors/mutation/ and
 * vectors/reject/, from the accepted vectors in vectors/v2/ and vectors/v3/.
 * It edits a copy of the participant's bytes, so that each vector differs
 * from its accepted vector by the edit only: a mutation vector by one byte of
 * a field that every implementation hashes as it is, a reject vector by what
 * makes it invalid. core-tx-hashing computes the expected hash or error of
 * each.
 *
 * The same accepted vectors always give the same files. A run writes nothing
 * if any vector fails, and otherwise replaces vectors/mutation/ and
 * vectors/reject/ as a whole. The vectors are those of
 * ../wallet/core/tx-hashing/vectors/, whose README.md lists them.
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
    DamlTransaction_NodeSeed,
    PreparedTransaction,
} from '@canton-network/core-ledger-proto'
import {
    concat,
    fromBase64,
    toHex,
} from '../../wallet/core/tx-hashing/src/bytes.js'
import {
    computePreparedTransactionHash,
    DEFAULT_LIMITS,
    TxHashingError,
    type HashingScheme,
    type TraversalLimits,
    type TxHashingErrorCode,
} from '../../wallet/core/tx-hashing/src/index.js'
import type { Vector } from '../../wallet/core/tx-hashing/src/__tests__/load-vectors.js'
import {
    changedBytes,
    changedText,
    changedTime,
} from '../../wallet/core/tx-hashing/src/__tests__/one-byte.js'

const VECTORS = path.join(
    import.meta.dirname,
    '../../wallet/core/tx-hashing/vectors'
)
const V2 = 'HASHING_SCHEME_VERSION_V2'

type AcceptedVector = Extract<Vector, { kind: 'accepted' | 'held-out' }>
type MutationVector = Extract<Vector, { kind: 'mutation' }>
type RejectVector = Extract<Vector, { kind: 'reject' }>

// Protobuf wire types, and the protobuf-ts ScalarType values used here
const VARINT = 0
const I64 = 1
const LEN = 2
const I32 = 5
const UINT64 = 4
const STRING = 9
const BYTES = 12

type Field = (typeof PreparedTransaction.fields)[number]
interface MessageType {
    readonly typeName: string
    readonly fields: readonly Field[]
}

function readVarint(
    bytes: Uint8Array,
    at: number
): { value: bigint; end: number } {
    let value = 0n
    for (let i = at, shift = 0n; i < bytes.length; i++, shift += 7n) {
        value |= BigInt(bytes[i] & 0x7f) << shift
        if (bytes[i] < 0x80) return { value, end: i + 1 }
    }
    throw new Error(`the varint at byte ${at} runs past the end`)
}

function varint(value: bigint | number): Uint8Array {
    let rest = BigInt(value)
    const out: number[] = []
    for (; rest >= 0x80n; rest >>= 7n) out.push(Number(rest & 0x7fn) | 0x80)
    out.push(Number(rest))
    return Uint8Array.from(out)
}

/** A field as protobuf writes it: tag, length if it has one, payload */
function encodeField(
    no: number,
    wireType: number,
    payload: Uint8Array
): Uint8Array {
    const length = wireType === LEN ? varint(payload.length) : new Uint8Array()
    return concat(varint((no << 3) | wireType), length, payload)
}

/** Where a field is in the bytes */
interface Span {
    no: number
    wireType: number
    /** The first byte of its tag */
    start: number
    /** The first byte of its length, if it has one */
    lengthAt?: number
    /** The first byte of its payload */
    payloadStart: number
    /** The byte after it */
    end: number
}

/** The fields of the message in bytes[start, end), in their order */
function fieldsOf(bytes: Uint8Array, start: number, end: number): Span[] {
    const spans: Span[] = []
    for (let at = start; at < end;) {
        const tag = readVarint(bytes, at)
        const span: Span = {
            no: Number(tag.value >> 3n),
            wireType: Number(tag.value & 7n),
            start: at,
            payloadStart: tag.end,
            end: tag.end,
        }
        switch (span.wireType) {
            case VARINT:
                span.end = readVarint(bytes, tag.end).end
                break
            case I64:
                span.end += 8
                break
            case LEN: {
                const length = readVarint(bytes, tag.end)
                span.lengthAt = tag.end
                span.payloadStart = length.end
                span.end = length.end + Number(length.value)
                break
            }
            case I32:
                span.end += 4
                break
            default:
                throw new Error(`wire type ${span.wireType} at byte ${at}`)
        }
        if (span.end > end) {
            throw new Error(`the field at byte ${at} runs past its message`)
        }
        spans.push(span)
        at = span.end
    }
    return spans
}

/** A message in the bytes: its type, its payload and the messages around it, outermost first */
interface Message {
    type: MessageType
    start: number
    end: number
    around: Span[]
}

/** The prepared transaction itself, as a message */
const whole = (bytes: Uint8Array): Message => ({
    type: PreparedTransaction,
    start: 0,
    end: bytes.length,
    around: [],
})

/** The field at `fieldPath`, a proto JSON path such as `transaction.nodes[1].v1.create.contractId` */
function locate(
    bytes: Uint8Array,
    fieldPath: string
): { field: Field; span: Span; parent: Message } {
    let parent = whole(bytes)
    const segments = fieldPath.split('.')
    for (let i = 0; ; i++) {
        const [, name, index] = /^(\w+)(?:\[(\d+)\])?$/.exec(segments[i]) ?? []
        const field = parent.type.fields.find((f) => f.jsonName === name)
        if (field === undefined) {
            throw new Error(
                `${fieldPath}: ${parent.type.typeName} has no ${segments[i]}`
            )
        }
        const repeated = field.repeat !== 0
        if (repeated !== (index !== undefined)) {
            throw new Error(`${fieldPath}: ${name} takes an index if repeated`)
        }
        const found = fieldsOf(bytes, parent.start, parent.end).filter(
            (span) => span.no === field.no
        )
        if (!repeated && found.length > 1) {
            throw new Error(`${fieldPath}: ${name} is there more than once`)
        }
        const span = found[repeated ? Number(index) : 0]
        if (span === undefined)
            throw new Error(`${fieldPath}: no ${segments[i]}`)
        if (i === segments.length - 1) return { field, span, parent }
        if (field.kind !== 'message' || span.wireType !== LEN) {
            throw new Error(`${fieldPath}: ${name} is not a message`)
        }
        parent = {
            type: field.T(),
            start: span.payloadStart,
            end: span.end,
            around: [...parent.around, span],
        }
    }
}

/** The message at `messagePath`, '' for the prepared transaction itself */
function messageAt(bytes: Uint8Array, messagePath: string): Message {
    if (messagePath === '') return whole(bytes)
    const { field, span, parent } = locate(bytes, messagePath)
    if (field.kind !== 'message') {
        throw new Error(`${messagePath} is not a message`)
    }
    return {
        type: field.T(),
        start: span.payloadStart,
        end: span.end,
        around: [...parent.around, span],
    }
}

/**
 * `bytes` with bytes[start, end) replaced by `insert`, and the lengths of
 * the messages `around` it rewritten to match
 */
function splice(
    bytes: Uint8Array,
    around: readonly Span[],
    start: number,
    end: number,
    insert: Uint8Array
): Uint8Array {
    let out = concat(bytes.subarray(0, start), insert, bytes.subarray(end))
    let growth = insert.length - (end - start)
    // Innermost first: an inner length comes after the outer ones, so
    // rewriting it moves none of them
    for (const span of [...around].reverse()) {
        const lengthAt = span.lengthAt!
        const length = varint(span.end - span.payloadStart + growth)
        out = concat(
            out.subarray(0, lengthAt),
            length,
            out.subarray(span.payloadStart)
        )
        growth += length.length - (span.payloadStart - lengthAt)
    }
    return out
}

function payloadOf(bytes: Uint8Array, fieldPath: string): Uint8Array {
    const { span } = locate(bytes, fieldPath)
    return bytes.slice(span.payloadStart, span.end)
}

function setPayload(
    bytes: Uint8Array,
    fieldPath: string,
    payload: Uint8Array
): Uint8Array {
    const { span, parent } = locate(bytes, fieldPath)
    const around =
        span.lengthAt === undefined ? parent.around : [...parent.around, span]
    return splice(bytes, around, span.payloadStart, span.end, payload)
}

const utf8 = (text: string) => new TextEncoder().encode(text)

const setText = (bytes: Uint8Array, fieldPath: string, text: string) =>
    setPayload(bytes, fieldPath, utf8(text))

function remove(bytes: Uint8Array, fieldPath: string): Uint8Array {
    const { span, parent } = locate(bytes, fieldPath)
    return splice(bytes, parent.around, span.start, span.end, new Uint8Array())
}

/**
 * Adds a field to the message at `messagePath` ('' for the prepared
 * transaction) where a participant would write it: after the fields with a
 * number up to its own. `no` is the number of a field the message does not
 * define; `name` names one it does.
 */
function add(
    bytes: Uint8Array,
    messagePath: string,
    field: { name: string } | { no: number; wireType: number },
    payload: Uint8Array
): Uint8Array {
    const message = messageAt(bytes, messagePath)
    let no: number
    let wireType: number
    if ('name' in field) {
        const known = message.type.fields.find((f) => f.jsonName === field.name)
        if (known === undefined) {
            throw new Error(`${message.type.typeName} has no ${field.name}`)
        }
        no = known.no
        const lengthDelimited =
            known.kind === 'message' ||
            (known.kind === 'scalar' &&
                (known.T === STRING || known.T === BYTES))
        wireType = lengthDelimited ? LEN : VARINT
    } else {
        no = field.no
        wireType = field.wireType
        if (message.type.fields.some((f) => f.no === no)) {
            throw new Error(`${message.type.typeName} defines field ${no}`)
        }
    }
    const before = fieldsOf(bytes, message.start, message.end).filter(
        (span) => span.no <= no
    )
    const at = before.at(-1)?.end ?? message.start
    return splice(
        bytes,
        message.around,
        at,
        at,
        encodeField(no, wireType, payload)
    )
}

/** `transaction.nodes[i]`, the path of the node with id `id` */
function nodePath(bytes: Uint8Array, id: string): string {
    const nodes = PreparedTransaction.fromBinary(bytes).transaction!.nodes
    const i = nodes.findIndex((n) => n.nodeId === id)
    if (i < 0) throw new Error(`no node has the id ${id}`)
    return `transaction.nodes[${i}]`
}

/** `transaction.nodeSeeds[j]`, the path of the seed of the node with id `id` */
function seedPath(bytes: Uint8Array, id: string): string {
    const seeds = PreparedTransaction.fromBinary(bytes).transaction!.nodeSeeds
    const j = seeds.findIndex((s) => String(s.nodeId) === id)
    if (j < 0) throw new Error(`node ${id} has no seed`)
    return `transaction.nodeSeeds[${j}]`
}

/** A seed entry for node `id` with the bytes of the seed of node `copied` */
const seedEntry = (bytes: Uint8Array, id: number, copied: string) =>
    DamlTransaction_NodeSeed.toBinary({
        nodeId: id,
        seed: payloadOf(bytes, `${seedPath(bytes, copied)}.seed`),
    })

/**
 * Changes one byte of the field at `fieldPath` the way the mutation tests
 * change a decoded message: the last letter or digit of a string to the next
 * of its kind, the lowest bit of the first byte of bytes, a microsecond of a
 * time.
 */
function changeOneByte(
    bytes: Uint8Array,
    fieldPath: string
): { bytes: Uint8Array; change: string } {
    const { field, span } = locate(bytes, fieldPath)
    const before = bytes.subarray(span.payloadStart, span.end)
    let after: Uint8Array
    let change: (at: number) => string
    if (field.kind === 'scalar' && field.T === STRING) {
        after = utf8(changedText(new TextDecoder().decode(before)))
        change = (at) =>
            `byte ${at}, ${String.fromCharCode(before[at])} to ${String.fromCharCode(after[at])}`
    } else if (field.kind === 'scalar' && field.T === BYTES) {
        after = changedBytes(before)
        const hex = (byte: number) => `0x${byte.toString(16).padStart(2, '0')}`
        change = (at) => `byte ${at}, ${hex(before[at])} to ${hex(after[at])}`
    } else if (field.kind === 'scalar' && field.T === UINT64) {
        const time = readVarint(before, 0).value
        after = varint(changedTime(time))
        change = () => `${time} to ${changedTime(time)}`
    } else {
        throw new Error(`${fieldPath}: no one-byte change for this field`)
    }
    const at = before.findIndex((byte, i) => byte !== after[i])
    if (
        after.length !== before.length ||
        before.filter((byte, i) => byte !== after[i]).length !== 1
    ) {
        throw new Error(`${fieldPath}: the change is not of one byte`)
    }
    return {
        bytes: setPayload(bytes, fieldPath, after),
        change: `${fieldPath}: ${change(at)}`,
    }
}

interface Mutation {
    id: string
    from: string
    /** The field to change, given the accepted vector's bytes */
    field: (bytes: Uint8Array) => string
}

const MUTATIONS: Mutation[] = [
    {
        id: 'mutation-v2-contract-id',
        from: 'v2-create-plain',
        field: (b) => `${nodePath(b, '0')}.v1.create.contractId`,
    },
    {
        id: 'mutation-v2-party',
        from: 'v2-create-plain',
        field: (b) =>
            `${nodePath(b, '0')}.v1.create.argument.record.fields[0].value.party`,
    },
    {
        id: 'mutation-v2-numeric',
        from: 'v2-numeric-scales',
        field: (b) =>
            `${nodePath(b, '0')}.v1.create.argument.record.fields[3].value.list.elements[0].numeric`,
    },
    {
        id: 'mutation-v2-choice',
        from: 'v2-exercise-nonconsuming',
        field: (b) => `${nodePath(b, '0')}.v1.exercise.choiceId`,
    },
    {
        id: 'mutation-v2-seed',
        from: 'v2-create-plain',
        field: (b) => `${seedPath(b, '0')}.seed`,
    },
    {
        id: 'mutation-v2-command-id',
        from: 'v2-create-plain',
        field: () => 'metadata.submitterInfo.commandId',
    },
    {
        id: 'mutation-v2-preparation-time',
        from: 'v2-create-plain',
        field: () => 'metadata.preparationTime',
    },
    {
        id: 'mutation-v3-contract-id',
        from: 'v3-fetch-in-choice',
        field: (b) => `${nodePath(b, '1')}.v1.fetch.contractId`,
    },
    {
        id: 'mutation-v3-party',
        from: 'v3-exercise-choice-observers',
        field: (b) => `${nodePath(b, '0')}.v1.exercise.choiceObservers[0]`,
    },
    {
        id: 'mutation-v3-numeric',
        from: 'v3-numeric-scales',
        field: (b) =>
            `${nodePath(b, '0')}.v1.create.argument.record.fields[2].value.list.elements[2].numeric`,
    },
    {
        id: 'mutation-v3-choice',
        from: 'v3-exercise-nested-creates',
        field: (b) => `${nodePath(b, '2')}.v1.exercise.choiceId`,
    },
    {
        id: 'mutation-v3-seed',
        from: 'v3-exercise-consuming',
        field: (b) => `${seedPath(b, '0')}.seed`,
    },
    {
        id: 'mutation-v3-command-id',
        from: 'v3-create-plain',
        field: () => 'metadata.submitterInfo.commandId',
    },
    {
        id: 'mutation-v3-preparation-time',
        from: 'v3-create-plain',
        field: () => 'metadata.preparationTime',
    },
    {
        id: 'mutation-v3-max-record-time',
        from: 'v3-max-record-time',
        field: () => 'metadata.maxRecordTime',
    },
    {
        id: 'mutation-v3-key',
        from: 'v3-create-with-key',
        field: (b) =>
            `${nodePath(b, '0')}.v1.create.key.key.key.record.fields[1].value.text`,
    },
]

interface Reject {
    id: string
    from: string
    code: TxHashingErrorCode
    /** What is changed, for source.mutation; a limit says it itself */
    change?: string
    /** Bytes made from the accepted vector's, which are kept if absent */
    edit?: (bytes: Uint8Array) => Uint8Array
    /** For a one-byte change, the field it is in, instead of `change` and `edit` */
    oneByte?: (bytes: Uint8Array) => string
    /** A scheme other than the accepted vector's */
    scheme?: string
    /** A limit set one below what the transaction needs */
    limit?: keyof TraversalLimits
}

const REJECTS: Reject[] = [
    {
        id: 'reject-v2-duplicate-node-id',
        from: 'v2-exercise-consuming',
        code: 'DUPLICATE_NODE_ID',
        change: 'node 1 listed a second time, last, with one byte of its contract id changed',
        edit: (b) => {
            const copied = add(
                b,
                'transaction',
                { name: 'nodes' },
                payloadOf(b, nodePath(b, '1'))
            )
            const last =
                PreparedTransaction.fromBinary(copied).transaction!.nodes
                    .length - 1
            return changeOneByte(
                copied,
                `transaction.nodes[${last}].v1.create.contractId`
            ).bytes
        },
    },
    {
        id: 'reject-v3-dangling-child',
        from: 'v3-exercise-consuming',
        code: 'DANGLING_NODE_REFERENCE',
        change: 'a child 2, which no node has, added to node 0',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '0')}.v1.exercise`,
                { name: 'children' },
                utf8('2')
            ),
    },
    {
        id: 'reject-v2-shared-child',
        from: 'v2-exercise-nested-creates',
        code: 'SHARED_CHILD',
        change: 'node 3, a child of node 2, added to the children of node 4 as well',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '4')}.v1.exercise`,
                { name: 'children' },
                utf8('3')
            ),
    },
    {
        id: 'reject-v3-root-listed-twice',
        from: 'v3-create-plain',
        code: 'SHARED_CHILD',
        change: 'root 0 listed a second time',
        edit: (b) => add(b, 'transaction', { name: 'roots' }, utf8('0')),
    },
    {
        id: 'reject-v2-own-child',
        from: 'v2-exercise-nonconsuming',
        code: 'CYCLE',
        change: 'node 0 added to its own children',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '0')}.v1.exercise`,
                { name: 'children' },
                utf8('0')
            ),
    },
    {
        id: 'reject-v3-two-node-cycle',
        from: 'v3-exercise-deep-nesting',
        code: 'CYCLE',
        change: 'node 1 added to the children of node 2, its child',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '2')}.v1.exercise`,
                { name: 'children' },
                utf8('1')
            ),
    },
    {
        id: 'reject-v2-orphan-node',
        from: 'v2-exercise-consuming',
        code: 'ORPHAN_NODE',
        change: 'node 1 removed from the children of node 0, so that no root reaches it',
        edit: (b) => remove(b, `${nodePath(b, '0')}.v1.exercise.children[0]`),
    },
    {
        id: 'reject-v3-node-id-leading-zero',
        from: 'v3-fetch-in-choice',
        code: 'INVALID_NODE_ID',
        change: 'the fetch, node 1, renamed 01, in its node id and in the children of node 0',
        edit: (b) => {
            const renamed = setText(b, `${nodePath(b, '1')}.nodeId`, '01')
            return setText(
                renamed,
                `${nodePath(renamed, '0')}.v1.exercise.children[0]`,
                '01'
            )
        },
    },
    {
        id: 'reject-v2-too-many-nodes',
        from: 'v2-exercise-deep-nesting',
        code: 'NODE_LIMIT_EXCEEDED',
        limit: 'maxNodes',
    },
    {
        id: 'reject-v3-nodes-too-deep',
        from: 'v3-exercise-deep-nesting',
        code: 'DEPTH_LIMIT_EXCEEDED',
        limit: 'maxNodeDepth',
    },
    {
        id: 'reject-v3-value-too-deep',
        from: 'v3-optional-nested',
        code: 'DEPTH_LIMIT_EXCEEDED',
        limit: 'maxValueDepth',
    },
    {
        id: 'reject-v2-unknown-field-in-node',
        from: 'v2-create-plain',
        code: 'UNKNOWN_FIELD',
        change: 'field 9, a string that Create does not define, added to node 0',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '0')}.v1.create`,
                { no: 9, wireType: LEN },
                utf8('unknown')
            ),
    },
    {
        id: 'reject-v3-unknown-field-in-metadata',
        from: 'v3-create-plain',
        code: 'UNKNOWN_FIELD',
        change: 'field 12, a varint of 1 that Metadata does not define, added to the metadata',
        edit: (b) =>
            add(b, 'metadata', { no: 12, wireType: VARINT }, varint(1)),
    },
    {
        id: 'reject-v2-party-in-unknown-value-member',
        from: 'v2-exercise-consuming',
        code: 'UNKNOWN_FIELD',
        change: 'the party in the argument of node 1 wrapped in field 99 of its Value, which Value does not define',
        edit: (b) => {
            const value = `${nodePath(b, '1')}.v1.create.argument.record.fields[0].value`
            return setPayload(
                b,
                value,
                encodeField(99, LEN, payloadOf(b, value))
            )
        },
    },
    {
        id: 'reject-v2-query-by-key',
        from: 'v3-lookup-by-key-empty',
        code: 'FIELD_NOT_COVERED_BY_SCHEME',
        scheme: V2,
        change: `scheme ${V2}`,
    },
    {
        id: 'reject-v2-key',
        from: 'v3-create-with-key',
        code: 'FIELD_NOT_COVERED_BY_SCHEME',
        scheme: V2,
        change: `scheme ${V2}, and the LF version of node 0, which has a key, changed from 2 to 2.1`,
        edit: (b) =>
            setText(b, `${nodePath(b, '0')}.v1.create.lfVersion`, '2.1'),
    },
    {
        id: 'reject-v2-by-key',
        from: 'v2-fetch-in-choice',
        code: 'FIELD_NOT_COVERED_BY_SCHEME',
        change: 'byKey = true added to the fetch, node 1',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '1')}.v1.fetch`,
                { name: 'byKey' },
                varint(1)
            ),
    },
    {
        id: 'reject-v2-max-record-time',
        from: 'v3-max-record-time',
        code: 'FIELD_NOT_COVERED_BY_SCHEME',
        scheme: V2,
        change: `scheme ${V2}`,
    },
    {
        id: 'reject-v2-lf-2',
        from: 'v2-create-plain',
        code: 'UNSUPPORTED_LF_VERSION',
        change: 'the LF version of node 0 changed from 2.1 to 2',
        edit: (b) => setText(b, `${nodePath(b, '0')}.v1.create.lfVersion`, '2'),
    },
    {
        id: 'reject-v2-lf-2-2',
        from: 'v2-exercise-nonconsuming',
        code: 'UNSUPPORTED_LF_VERSION',
        oneByte: (b) => `${nodePath(b, '0')}.v1.exercise.lfVersion`,
    },
    {
        id: 'reject-v3-lf-dev',
        from: 'v3-create-plain',
        code: 'UNSUPPORTED_LF_VERSION',
        change: 'the LF version of node 0 changed from 2.1 to dev',
        edit: (b) =>
            setText(b, `${nodePath(b, '0')}.v1.create.lfVersion`, 'dev'),
    },
    {
        id: 'reject-v3-lf-3',
        from: 'v3-create-with-key',
        code: 'UNSUPPORTED_LF_VERSION',
        oneByte: (b) => `${nodePath(b, '0')}.v1.create.lfVersion`,
    },
    {
        id: 'reject-v3-key-in-lf-2-1',
        from: 'v3-create-with-key',
        code: 'UNSUPPORTED_LF_VERSION',
        change: 'the LF version of node 0, which has a key, changed from 2 to 2.1',
        edit: (b) =>
            setText(b, `${nodePath(b, '0')}.v1.create.lfVersion`, '2.1'),
    },
    {
        id: 'reject-v3-by-key-in-lf-2-1',
        from: 'v3-fetch-in-choice',
        code: 'UNSUPPORTED_LF_VERSION',
        change: 'byKey = true added to the fetch, node 1, of LF version 2.1',
        edit: (b) =>
            add(
                b,
                `${nodePath(b, '1')}.v1.fetch`,
                { name: 'byKey' },
                varint(1)
            ),
    },
    {
        id: 'reject-scheme-v4',
        from: 'v3-create-plain',
        code: 'UNSUPPORTED_SCHEME',
        scheme: 'HASHING_SCHEME_VERSION_V4',
        change: 'scheme HASHING_SCHEME_VERSION_V4',
    },
    {
        id: 'reject-scheme-unspecified',
        from: 'v3-create-plain',
        code: 'UNSUPPORTED_SCHEME',
        scheme: 'HASHING_SCHEME_VERSION_UNSPECIFIED',
        change: 'scheme HASHING_SCHEME_VERSION_UNSPECIFIED',
    },
    {
        id: 'reject-scheme-lower-case',
        from: 'v3-create-plain',
        code: 'UNSUPPORTED_SCHEME',
        scheme: 'hashing_scheme_version_v3',
        change: 'scheme hashing_scheme_version_v3, in lower case',
    },
    {
        id: 'reject-v2-exercise-without-seed',
        from: 'v2-exercise-nonconsuming',
        code: 'MISSING_NODE_SEED',
        change: 'the seed of node 0 removed',
        edit: (b) => remove(b, seedPath(b, '0')),
    },
    {
        id: 'reject-v3-create-without-seed',
        from: 'v3-create-plain',
        code: 'MISSING_NODE_SEED',
        change: 'the seed of node 0 removed',
        edit: (b) => remove(b, seedPath(b, '0')),
    },
    {
        id: 'reject-v3-seed-on-fetch',
        from: 'v3-fetch-in-choice',
        code: 'FIELD_NOT_COVERED_BY_SCHEME',
        change: 'a seed for the fetch, node 1, added: a copy of the seed of node 0',
        edit: (b) =>
            add(b, 'transaction', { name: 'nodeSeeds' }, seedEntry(b, 1, '0')),
    },
    {
        id: 'reject-v2-seed-on-rollback',
        from: 'v2-rollback',
        code: 'FIELD_NOT_COVERED_BY_SCHEME',
        change: 'a seed for the rollback, node 1, added: a copy of the seed of node 0',
        edit: (b) =>
            add(b, 'transaction', { name: 'nodeSeeds' }, seedEntry(b, 1, '0')),
    },
    {
        id: 'reject-v2-seed-of-31-bytes',
        from: 'v2-create-plain',
        code: 'INVALID_VALUE',
        change: 'the last byte of the seed of node 0 removed',
        edit: (b) => {
            const field = `${seedPath(b, '0')}.seed`
            return setPayload(b, field, payloadOf(b, field).subarray(0, -1))
        },
    },
    {
        id: 'reject-v3-two-seeds-for-one-node',
        from: 'v3-exercise-nonconsuming',
        code: 'DUPLICATE_NODE_SEED',
        change: 'a second seed for node 0 added, its seed with one byte changed',
        edit: (b) => {
            const twice = add(
                b,
                'transaction',
                { name: 'nodeSeeds' },
                seedEntry(b, 0, '0')
            )
            return changeOneByte(twice, 'transaction.nodeSeeds[1].seed').bytes
        },
    },
    {
        id: 'reject-v3-key-hash-of-31-bytes',
        from: 'v3-create-with-key',
        code: 'INVALID_VALUE',
        change: 'the last byte of the key hash of node 0 removed',
        edit: (b) => {
            const field = `${nodePath(b, '0')}.v1.create.key.key.hash`
            return setPayload(b, field, payloadOf(b, field).subarray(0, -1))
        },
    },
    {
        id: 'reject-v2-contract-id-of-odd-length',
        from: 'v2-create-plain',
        code: 'INVALID_HEX',
        change: 'the last digit of the contract id of node 0 removed',
        edit: (b) => {
            const field = `${nodePath(b, '0')}.v1.create.contractId`
            return setPayload(b, field, payloadOf(b, field).subarray(0, -1))
        },
    },
    {
        id: 'reject-v3-query-result-in-upper-case',
        from: 'v3-lookup-by-key-found',
        code: 'INVALID_HEX',
        change: 'the contract id in the result of the QueryByKey, node 1, written in upper case',
        edit: (b) => {
            const field = `${nodePath(b, '1')}.v1.queryByKey.result[0]`
            const id = new TextDecoder().decode(payloadOf(b, field))
            return setText(b, field, id.toUpperCase())
        },
    },
    {
        id: 'reject-v3-no-roots',
        from: 'v3-create-plain',
        code: 'MISSING_FIELD',
        change: 'the only root, 0, removed, and node 0 and its seed as well, which leaves the transaction without nodes',
        edit: (b) => {
            let out = remove(b, 'transaction.roots[0]')
            out = remove(out, seedPath(out, '0'))
            return remove(out, nodePath(out, '0'))
        },
    },
    {
        id: 'reject-v2-no-metadata',
        from: 'v2-create-plain',
        code: 'MISSING_FIELD',
        change: 'the metadata removed',
        edit: (b) => remove(b, 'metadata'),
    },
    {
        id: 'reject-v3-rollback-without-children',
        from: 'v3-rollback',
        code: 'MISSING_FIELD',
        change: 'the children of the rollback, node 1, removed, and with them nodes 2 and 3 and the seed of node 3',
        edit: (b) => {
            let out = remove(b, `${nodePath(b, '1')}.v1.rollback.children[1]`)
            out = remove(out, `${nodePath(out, '1')}.v1.rollback.children[0]`)
            out = remove(out, seedPath(out, '3'))
            out = remove(out, nodePath(out, '3'))
            return remove(out, nodePath(out, '2'))
        },
    },
    {
        id: 'reject-v3-exercise-without-chosen-value',
        from: 'v3-exercise-nested-creates',
        code: 'MISSING_FIELD',
        change: 'the chosen value of node 2, an exercise below the root, removed',
        edit: (b) => remove(b, `${nodePath(b, '2')}.v1.exercise.chosenValue`),
    },
    {
        id: 'reject-v2-node-without-version',
        from: 'v2-create-plain',
        code: 'UNSUPPORTED_NODE_VERSION',
        change: 'the v1 node of node 0 removed, which leaves only its node id, and its seed removed as well',
        edit: (b) => {
            const versionless = remove(b, `${nodePath(b, '0')}.v1`)
            return remove(versionless, seedPath(versionless, '0'))
        },
    },
    {
        id: 'reject-v3-value-without-kind',
        from: 'v3-create-plain',
        code: 'INVALID_VALUE',
        change: 'the party in the argument of node 0 removed, which leaves its Value empty',
        edit: (b) =>
            setPayload(
                b,
                `${nodePath(b, '0')}.v1.create.argument.record.fields[0].value`,
                new Uint8Array()
            ),
    },
    {
        id: 'reject-v2-truncated',
        from: 'v2-create-plain',
        code: 'DECODE_FAILED',
        change: 'the last byte cut off',
        edit: (b) => b.slice(0, -1),
    },
    {
        id: 'reject-v3-empty',
        from: 'v3-create-plain',
        code: 'DECODE_FAILED',
        change: 'every byte cut off',
        edit: () => new Uint8Array(),
    },
]

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

/** What the package makes of a vector: its hash in hex, or the code it refuses it with */
async function outcomeOf(
    preparedTransaction: string,
    scheme: string,
    limits?: Partial<TraversalLimits>
): Promise<{ hash: string } | { error: TxHashingErrorCode }> {
    try {
        const hash = await computePreparedTransactionHash(
            preparedTransaction,
            // A reject vector may name a scheme the package does not know
            scheme as HashingScheme,
            { limits }
        )
        return { hash: toHex(hash) }
    } catch (error) {
        if (error instanceof TxHashingError) return { error: error.code }
        throw error
    }
}

async function mutationVector(
    mutation: Mutation,
    from: AcceptedVector
): Promise<MutationVector> {
    const original = fromBase64(from.preparedTransaction)
    const { bytes, change } = changeOneByte(original, mutation.field(original))
    const preparedTransaction = base64(bytes)
    const outcome = await outcomeOf(preparedTransaction, from.scheme)
    if (!('hash' in outcome)) throw new Error(`refused: ${outcome.error}`)
    if (outcome.hash === from.expected.hash) {
        throw new Error('the change leaves the hash as it was')
    }
    return {
        id: mutation.id,
        kind: 'mutation',
        scheme: from.scheme,
        preparedTransaction,
        expected: { hash: outcome.hash },
        source: { from: from.id, mutation: change },
    }
}

/** The least value of `limit` with which the package hashes the transaction */
async function neededLimit(
    preparedTransaction: string,
    scheme: string,
    limit: keyof TraversalLimits
): Promise<number> {
    for (let value = 1; value <= DEFAULT_LIMITS[limit]; value++) {
        const outcome = await outcomeOf(preparedTransaction, scheme, {
            [limit]: value,
        })
        if ('hash' in outcome) return value
    }
    throw new Error(`the transaction needs more than the default ${limit}`)
}

async function rejectVector(
    reject: Reject,
    from: AcceptedVector
): Promise<RejectVector> {
    let bytes = fromBase64(from.preparedTransaction)
    let change = reject.change
    if (reject.oneByte !== undefined) {
        const changed = changeOneByte(bytes, reject.oneByte(bytes))
        bytes = changed.bytes
        change = changed.change
    } else if (reject.edit !== undefined) {
        bytes = reject.edit(bytes)
    }
    const preparedTransaction = base64(bytes)
    const scheme = reject.scheme ?? from.scheme
    let limits: Partial<TraversalLimits> | undefined
    if (reject.limit !== undefined) {
        const value =
            (await neededLimit(preparedTransaction, scheme, reject.limit)) - 1
        limits = { [reject.limit]: value }
        change = `limits.${reject.limit} ${value}, one below what the transaction needs`
    }
    if (change === undefined) throw new Error('the change is not described')
    const outcome = await outcomeOf(preparedTransaction, scheme, limits)
    if (!('error' in outcome)) throw new Error(`hashed to ${outcome.hash}`)
    if (outcome.error !== reject.code) {
        throw new Error(`refused with ${outcome.error}, not ${reject.code}`)
    }
    return {
        id: reject.id,
        kind: 'reject',
        scheme,
        preparedTransaction,
        expected: { error: outcome.error },
        ...(limits !== undefined && { limits }),
        source: { from: from.id, mutation: change },
    }
}

async function readAccepted(): Promise<Map<string, AcceptedVector>> {
    const accepted = new Map<string, AcceptedVector>()
    for (const folder of ['v2', 'v3']) {
        const directory = path.join(VECTORS, folder)
        for (const file of (await readdir(directory)).sort()) {
            if (!file.endsWith('.json')) continue
            const vector = JSON.parse(
                await readFile(path.join(directory, file), 'utf8')
            ) as Vector
            if (vector.kind !== 'accepted') {
                throw new Error(`${folder}/${file} is not an accepted vector`)
            }
            accepted.set(vector.id, vector)
        }
    }
    return accepted
}

/** Replaces the files of vectors/mutation/ and vectors/reject/ */
async function write(vectors: (MutationVector | RejectVector)[]) {
    for (const folder of ['mutation', 'reject']) {
        const directory = path.join(VECTORS, folder)
        await mkdir(directory, { recursive: true })
        for (const file of await readdir(directory)) {
            if (file.endsWith('.json')) await rm(path.join(directory, file))
        }
    }
    for (const vector of vectors) {
        await writeFile(
            path.join(VECTORS, vector.kind, `${vector.id}.json`),
            `${JSON.stringify(vector, null, 4)}\n`
        )
    }
}

const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

async function main() {
    const accepted = await readAccepted()
    const jobs = [
        ...MUTATIONS.map((mutation) => ({
            id: mutation.id,
            from: mutation.from,
            make: (source: AcceptedVector) => mutationVector(mutation, source),
        })),
        ...REJECTS.map((reject) => ({
            id: reject.id,
            from: reject.from,
            make: (source: AcceptedVector) => rejectVector(reject, source),
        })),
    ]
    const vectors: (MutationVector | RejectVector)[] = []
    const failures: string[] = []
    for (const { id, from, make } of jobs) {
        try {
            const source = accepted.get(from)
            if (source === undefined) {
                throw new Error(`there is no accepted vector ${from}`)
            }
            const vector = await make(source)
            vectors.push(vector)
            const expected =
                'hash' in vector.expected
                    ? vector.expected.hash
                    : vector.expected.error
            console.log(`${id}: ${expected}`)
        } catch (error) {
            failures.push(`${id}: ${message(error)}`)
            console.log(`${id}: FAILED: ${message(error)}`)
        }
    }
    const count = (kind: Vector['kind']) =>
        vectors.filter((vector) => vector.kind === kind).length
    const verb = failures.length === 0 ? 'written' : 'made'
    console.log(
        `mutation: ${count('mutation')} ${verb}, reject: ${count('reject')} ${verb}`
    )
    if (failures.length > 0) {
        console.log(`\n${failures.length} failed, nothing written:`)
        for (const failure of failures) console.log(failure)
        process.exitCode = 1
        return
    }
    await write(vectors)
}

await main()
