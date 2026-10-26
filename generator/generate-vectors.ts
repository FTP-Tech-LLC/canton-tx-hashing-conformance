/**
 * Captures the accepted vectors, vectors/v2/ and vectors/v3/, from the local
 * Canton setup. Each scenario below prepares a transaction of the
 * hash-vectors DAR with HASHING_SCHEME_VERSION_V3 and, unless it needs V3,
 * with V2. A prepare response becomes a vector only if core-tx-hashing
 * computes the participant's hash for it, and a run writes nothing unless all
 * do. Without --only it replaces vectors/v2/ and vectors/v3/ as a whole.
 *
 * With --held-out it captures the held-out vectors, vectors/held-out/, from
 * scenarios of their own instead, all of them in one run, and replaces that
 * folder as a whole.
 *
 * With --execute it also executes each transaction, signed over
 * core-tx-hashing's hash rather than the participant's: the participant
 * checks the signature against the hash it computes itself.
 *
 * With --synchronizer <id> it uses that synchronizer, which it needs when the
 * participant is connected to more than one.
 *
 * The vectors are those of ../wallet/core/tx-hashing/vectors/. VECTORS.md of
 * this repository describes the scenarios, and its README.md says how to run
 * this.
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { PreparedTransaction } from '@canton-network/core-ledger-proto'
import { fromBase64 } from '../../wallet/core/tx-hashing/src/bytes.js'
import {
    computePreparedTransactionHash,
    TxHashingError,
} from '../../wallet/core/tx-hashing/src/index.js'
import { toHex } from '../../wallet/core/tx-hashing/src/__tests__/hex.js'
import { int64sBeyond2To53 } from '../../wallet/core/tx-hashing/src/__tests__/int64.js'
import type { Vector } from '../../wallet/core/tx-hashing/src/__tests__/load-vectors.js'
import {
    cantonVersion,
    connect,
    createAndExerciseCommand,
    createCommand,
    createdContracts,
    disclose,
    execute,
    exerciseByKeyCommand,
    exerciseCommand,
    LedgerError,
    onboardExternalParty,
    prepare,
    uploadDar,
    V2,
    V3,
    type Command,
    type CreatedEvent,
    type ExternalParty,
    type HashingScheme,
    type Ledger,
    type PrepareRequest,
    type PrepareResponse,
    type Transaction,
} from './ledger.js'

const DAR = path.join(
    import.meta.dirname,
    'daml/.daml/dist/hash-vectors-0.2.0.dar'
)
const VECTORS = path.join(
    import.meta.dirname,
    '../../wallet/core/tx-hashing/vectors'
)
const HOUR = 3_600_000

const templateId = (name: string) => `#hash-vectors:HashVectors:${name}`

type AcceptedVector = Extract<Vector, { kind: 'accepted' | 'held-out' }>

interface Context {
    readonly ledger: Ledger
    /** The party most transactions act as */
    readonly owner: ExternalParty
    /** A second signatory, a choice observer and the user of a disclosed contract */
    readonly other: ExternalParty
    /** Executes a transaction that a scenario needs before its own */
    submit(
        commands: Command[],
        actAs?: readonly ExternalParty[]
    ): Promise<Transaction>
    /** The contract id of a Driver of the owner, created once */
    driver(): Promise<string>
}

/** What a scenario prepares. It acts as the owner unless it says otherwise. */
type Request = Omit<PrepareRequest, 'scheme' | 'actAs'> & {
    actAs?: readonly ExternalParty[]
}

interface Scenario {
    readonly name: string
    /** A part of the error with which the participant refuses to execute the transaction */
    readonly executeRefused?: string
    /** Executes what the transaction needs, such as the contract it exercises, and says what to prepare */
    readonly setup: (ctx: Context) => Promise<Request>
}

interface AcceptedScenario extends Scenario {
    /** False for a transaction that V2 vectors cannot hold: VECTORS.md says why */
    readonly v2: boolean
}

function created(transaction: Transaction, template: string): CreatedEvent {
    const [contract] = createdContracts(transaction, `:HashVectors:${template}`)
    if (contract === undefined) throw new Error(`No ${template} was created`)
    return contract
}

const create =
    (
        template: string,
        fields: (ctx: Context) => object | Promise<object> = () => ({})
    ) =>
    async (ctx: Context): Promise<Request> => ({
        commands: [
            createCommand(templateId(template), {
                owner: ctx.owner.partyId,
                ...(await fields(ctx)),
            }),
        ],
    })

async function plain(ctx: Context): Promise<string> {
    const transaction = await ctx.submit([
        createCommand(templateId('Plain'), { owner: ctx.owner.partyId }),
    ])
    return created(transaction, 'Plain').contractId
}

/** Exercises `choice` on a new Plain of the owner */
const onPlain =
    (choice: string, argument: (ctx: Context) => unknown = () => ({})) =>
    async (ctx: Context): Promise<Request> => ({
        commands: [
            exerciseCommand(
                templateId('Plain'),
                await plain(ctx),
                choice,
                argument(ctx)
            ),
        ],
    })

const onDriver =
    (choice: string, argument: (ctx: Context) => unknown = () => ({})) =>
    async (ctx: Context): Promise<Request> => ({
        commands: [
            exerciseCommand(
                templateId('Driver'),
                await ctx.driver(),
                choice,
                await argument(ctx)
            ),
        ],
    })

/** Creates a Keyed of the owner, which a choice then finds by its key */
async function keyed(ctx: Context, label: string) {
    await ctx.submit([
        createCommand(templateId('Keyed'), { owner: ctx.owner.partyId, label }),
    ])
    return { label }
}

function allValues(party: string, contractId: string) {
    return {
        unitValue: {},
        boolValue: true,
        int64Value: '-42',
        numericValue: '3.1415926535',
        textValue: 'héllo, мир',
        timestampValue: '2026-10-24T12:34:56.789012Z',
        dateValue: '2026-10-24',
        partyValue: party,
        contractIdValue: contractId,
        optionalValue: '7',
        listValue: ['first', 'second'],
        textMapValue: { zeta: '1', alpha: '2' },
        genMapValue: [
            ['3', 'three'],
            ['1', 'one'],
        ],
        recordValue: { name: 'pair', count: '2' },
        variantValue: { tag: 'Circle', value: '1.5' },
        enumValue: 'Green',
    }
}

const SCENARIOS: readonly AcceptedScenario[] = [
    { name: 'create-plain', v2: true, setup: create('Plain') },
    {
        name: 'create-all-values',
        v2: true,
        setup: create('AllKinds', async (ctx) => ({
            values: allValues(ctx.other.partyId, await ctx.driver()),
        })),
    },
    {
        name: 'create-unicode-text',
        v2: true,
        setup: create('Texts', () => ({
            // UTF-8 of two, three and four bytes, a combining accent, a joined
            // emoji and right-to-left script
            text: 'héllo, мир, 中文, 😀, e\u0301, 👩\u200d💻, שלום',
            parts: ['', ' ', '\t\n', '\u00a0', '\ufeff', '\uffff', '𝄞'],
            // The participant orders keys by code point. In UTF-16, as
            // JavaScript compares strings, the last two are the other way round.
            labels: {
                z: 'last',
                é: 'e acute',
                '\uff5e': 'fullwidth tilde',
                '😀': 'astral',
            },
        })),
    },
    {
        name: 'create-multi-signatory',
        v2: true,
        setup: async (ctx) => ({
            actAs: [ctx.owner, ctx.other],
            commands: [
                createCommand(templateId('Joint'), {
                    first: ctx.owner.partyId,
                    second: ctx.other.partyId,
                }),
            ],
        }),
    },
    {
        name: 'create-empty-collections',
        v2: true,
        setup: create('Empties', () => ({
            emptyList: [],
            emptyTextMap: {},
            emptyGenMap: [],
            none: null,
            emptyText: '',
            emptyInner: [[]],
        })),
    },
    {
        name: 'create-and-exercise',
        v2: true,
        executeRefused:
            'Transaction with multiple root nodes are not supported',
        setup: async (ctx) => ({
            commands: [
                createAndExerciseCommand(
                    templateId('Plain'),
                    { owner: ctx.owner.partyId },
                    'Check',
                    {}
                ),
            ],
        }),
    },
    { name: 'exercise-consuming', v2: true, setup: onPlain('Replace') },
    { name: 'exercise-nonconsuming', v2: true, setup: onPlain('Check') },
    { name: 'exercise-archive', v2: true, setup: onPlain('Archive') },
    {
        name: 'exercise-nested-creates',
        v2: true,
        setup: onDriver('NestedCreates', () => ({ depth: '3' })),
    },
    {
        name: 'exercise-deep-nesting',
        v2: true,
        setup: onDriver('DeepNesting', () => ({ depth: '3' })),
    },
    {
        name: 'exercise-choice-observers',
        v2: true,
        setup: onPlain('Announce', (ctx) => ({ watcher: ctx.other.partyId })),
    },
    {
        name: 'exercise-interface',
        v2: true,
        setup: async (ctx) => ({
            commands: [
                exerciseCommand(
                    templateId('Asset'),
                    await plain(ctx),
                    'Poke',
                    {}
                ),
            ],
        }),
    },
    { name: 'exercise-result-record', v2: true, setup: onPlain('Describe') },
    {
        name: 'fetch-in-choice',
        v2: true,
        setup: onDriver('FetchPlain', async (ctx) => ({
            target: await plain(ctx),
        })),
    },
    {
        name: 'fetch-interface',
        v2: true,
        setup: onDriver('FetchAsset', async (ctx) => ({
            target: await plain(ctx),
        })),
    },
    {
        name: 'numeric-scales',
        v2: true,
        setup: create('Numerics', () => ({
            // 38 digits, the most a numeric has
            integral: [
                '0',
                '-1',
                '99999999999999999999999999999999999999',
                '-99999999999999999999999999999999999999',
            ],
            decimal: [
                '0.0',
                '-0.0000000001',
                '1234567890123456789012345678.0123456789',
                '1',
            ],
            fine: [
                '0.0000000000000000000000000000000000001',
                '-9.9999999999999999999999999999999999999',
                '0',
            ],
        })),
    },
    {
        name: 'time-bounds',
        v2: true,
        setup: create('Times', () => ({
            times: [
                '0001-01-01T00:00:00Z',
                '9999-12-31T23:59:59.999999Z',
                '1970-01-01T00:00:00Z',
                '1969-12-31T23:59:59.999999Z',
            ],
            dates: ['0001-01-01', '9999-12-31', '1970-01-01', '1969-12-31'],
        })),
    },
    {
        name: 'optional-nested',
        v2: true,
        // The JSON API takes an optional inside an optional as a list on
        // every level: [] is None, [x] is Some x
        setup: create('Optionals', () => ({
            flat: [null, '1'],
            nested: [[], [[]], [['2']]],
            deep: [[[]]],
            pair: { name: 'pair', count: '3' },
            absent: null,
        })),
    },
    {
        name: 'maps',
        v2: true,
        setup: create('Maps', () => ({
            textMap: { zeta: '1', alpha: '2', é: '3' },
            nestedMap: { outer: { inner: 'x' }, empty: {} },
            genMap: [
                ['3', 'three'],
                ['-1', 'minus one'],
                ['1', 'one'],
            ],
            recordKeys: [
                [{ name: 'b', count: '1' }, true],
                [{ name: 'a', count: '2' }, false],
            ],
        })),
    },
    {
        name: 'variant-enum',
        v2: true,
        setup: create('Variants', () => ({
            shapes: [
                { tag: 'Circle', value: '1.5' },
                { tag: 'Labelled', value: 'box' },
            ],
            animals: [
                { tag: 'Dog', value: { name: 'Rex', age: '3' } },
                { tag: 'Cat', value: { lives: '9' } },
            ],
            colors: ['Red', 'Blue'],
            eithers: [
                { tag: 'Left', value: '1' },
                { tag: 'Right', value: 'two' },
            ],
        })),
    },
    {
        name: 'input-contracts-disclosed',
        v2: true,
        setup: async (ctx) => {
            const shared = created(
                await ctx.submit([
                    createCommand(templateId('Shared'), {
                        owner: ctx.owner.partyId,
                    }),
                ]),
                'Shared'
            )
            return {
                actAs: [ctx.other],
                commands: [
                    exerciseCommand(
                        templateId('Shared'),
                        shared.contractId,
                        'Use',
                        { user: ctx.other.partyId }
                    ),
                ],
                disclosedContracts: [disclose(ctx.ledger, shared)],
            }
        },
    },
    {
        name: 'ledger-time-bounds',
        v2: true,
        setup: onDriver('CheckTime', () => ({
            after: new Date(Date.now() - HOUR).toISOString(),
            before: new Date(Date.now() + HOUR).toISOString(),
        })),
    },
    { name: 'rollback', v2: true, setup: onDriver('TryCatch') },
    {
        name: 'create-with-key',
        v2: false,
        setup: create('Keyed', () => ({ label: 'create-with-key' })),
    },
    {
        name: 'exercise-by-key',
        v2: false,
        setup: onDriver('ArchiveByKey', (ctx) => keyed(ctx, 'exercise-by-key')),
    },
    {
        name: 'fetch-by-key',
        v2: false,
        setup: onDriver('FetchKeyed', (ctx) => keyed(ctx, 'fetch-by-key')),
    },
    {
        name: 'lookup-by-key-found',
        v2: false,
        setup: onDriver('LookupKeyed', (ctx) =>
            keyed(ctx, 'lookup-by-key-found')
        ),
    },
    {
        name: 'lookup-by-key-empty',
        v2: false,
        setup: onDriver('LookupKeyed', () => ({ label: 'no contract has it' })),
    },
    {
        name: 'max-record-time',
        v2: false,
        setup: async (ctx) => ({
            ...(await create('Plain')(ctx)),
            maxRecordTime: new Date(Date.now() + HOUR),
        }),
    },
    {
        name: 'int64-big',
        v2: false,
        setup: create('Ints', () => ({
            // 2^53 + 1 and its negation, then the largest and the smallest int64
            ints: [
                '9007199254740993',
                '-9007199254740993',
                '9223372036854775807',
                '-9223372036854775808',
            ],
        })),
    },
]

/** Creates a Tag of the owner, which has a key, and returns its contract id */
async function tag(ctx: Context, name: string, serial: number) {
    const transaction = await ctx.submit([
        createCommand(templateId('Tag'), {
            owner: ctx.owner.partyId,
            name,
            serial: String(serial),
        }),
    ])
    return created(transaction, 'Tag').contractId
}

/** Exercises `choice` on a new Registry of the owner */
const onRegistry =
    (choice: string, argument: (ctx: Context) => unknown) =>
    async (ctx: Context): Promise<Request> => {
        const registry = created(
            await ctx.submit([
                createCommand(templateId('Registry'), {
                    owner: ctx.owner.partyId,
                }),
            ]),
            'Registry'
        )
        return {
            commands: [
                exerciseCommand(
                    templateId('Registry'),
                    registry.contractId,
                    choice,
                    await argument(ctx)
                ),
            ],
        }
    }

/** An Escrow, which the owner buys from the other party: both sign it */
const escrow = (ctx: Context) =>
    createCommand(templateId('Escrow'), {
        buyer: ctx.owner.partyId,
        seller: ctx.other.partyId,
        reference: 'ESC-2026-0001',
        amount: '1250.5',
    })

const NUMBERED = { tag: 'Numbered', value: { row: 'K', number: '7' } }
const STANDING = { tag: 'Standing', value: {} }
// The section is Some (Some "Balcon"), a list on each level as in optional-nested
const TICKET = { event: 'Première', seat: NUMBERED, section: [['Balcon']] }

const ticket = (ctx: Context) =>
    createCommand(templateId('Ticket'), {
        holder: ctx.owner.partyId,
        ...TICKET,
    })

const ticketKey = (ctx: Context) => ({
    _1: ctx.owner.partyId,
    _2: TICKET.event,
    _3: TICKET.seat,
    _4: TICKET.section,
})

/**
 * The scenarios of the held-out vectors, with templates and values that no
 * accepted vector has. Each has a contract key, and each runs with V3 only.
 */
const HELD_OUT_SCENARIOS: readonly Scenario[] = [
    {
        name: 'create-record-key',
        setup: async (ctx) => ({
            actAs: [ctx.owner, ctx.other],
            commands: [escrow(ctx)],
        }),
    },
    {
        name: 'create-variant-key',
        setup: async (ctx) => ({ commands: [ticket(ctx)] }),
    },
    {
        name: 'create-unicode-key',
        setup: create('Tag', () => ({ name: 'ключ · 鍵 · 🔑', serial: '1' })),
    },
    {
        name: 'exercise-record-key',
        setup: async (ctx) => {
            const contract = created(
                await ctx.submit([escrow(ctx)], [ctx.owner, ctx.other]),
                'Escrow'
            )
            return {
                commands: [
                    exerciseCommand(
                        templateId('Escrow'),
                        contract.contractId,
                        'Audit',
                        { otherReference: 'ESC-2026-9999' }
                    ),
                ],
            }
        },
    },
    {
        name: 'exercise-interface-keyed',
        setup: async (ctx) => ({
            commands: [
                exerciseCommand(
                    templateId('Badge'),
                    await tag(ctx, 'étiquette', 2),
                    'Present',
                    {}
                ),
            ],
        }),
    },
    {
        name: 'fetch-keyed-by-id',
        setup: onRegistry('Inspect', async (ctx) => ({
            target: await tag(ctx, '標籤', 3),
        })),
    },
    {
        name: 'query-by-key-several',
        setup: onRegistry('FindAll', async (ctx) => {
            await tag(ctx, 'дубль', 4)
            await tag(ctx, 'дубль', 5)
            return { name: 'дубль' }
        }),
    },
    {
        name: 'query-by-key-variant-key-empty',
        setup: onRegistry('FindTicket', () => ({
            event: 'Première',
            seat: STANDING,
            section: [[]],
        })),
    },
    {
        name: 'by-key-in-choice',
        setup: onRegistry('Sweep', async (ctx) => {
            await tag(ctx, 'черновик', 6)
            return { name: 'черновик', newName: 'чистовик' }
        }),
    },
    {
        name: 'by-key-in-rollback',
        setup: onRegistry('Rehearse', async (ctx) => {
            await tag(ctx, 'репетиция', 7)
            return { name: 'репетиция' }
        }),
    },
    {
        name: 'exercise-by-key-command',
        setup: async (ctx) => {
            await ctx.submit([ticket(ctx)])
            return {
                commands: [
                    exerciseByKeyCommand(
                        templateId('Ticket'),
                        ticketKey(ctx),
                        'Reseat',
                        { newSeat: STANDING }
                    ),
                ],
            }
        },
    },
    {
        name: 'max-record-time-by-key',
        setup: async (ctx) => {
            await tag(ctx, 'срок', 8)
            return {
                commands: [
                    exerciseByKeyCommand(
                        templateId('Tag'),
                        { _1: ctx.owner.partyId, _2: 'срок' },
                        'Rename',
                        { newName: 'срок ✓' }
                    ),
                ],
                maxRecordTime: new Date(Date.now() + HOUR),
            }
        },
    },
]

/** A vector that a run makes */
interface Planned {
    readonly id: string
    readonly folder: string
    readonly scenario: Scenario
    readonly scheme: HashingScheme
}

/** The vectors of one kind, and the folders they go to */
interface Corpus {
    readonly kind: AcceptedVector['kind']
    /** A run without --only replaces these as a whole */
    readonly folders: readonly string[]
    readonly planned: readonly Planned[]
}

const short = (scheme: HashingScheme) => (scheme === V2 ? 'v2' : 'v3')

/** One vector per scenario and per scheme that `schemes` gives it */
function plan<S extends Scenario>(
    scenarios: readonly S[],
    schemes: (scenario: S) => readonly HashingScheme[],
    place: (
        scheme: HashingScheme,
        name: string
    ) => Omit<Planned, 'scenario' | 'scheme'>
): Planned[] {
    return scenarios.flatMap((scenario) =>
        schemes(scenario).map((scheme) => ({
            ...place(scheme, scenario.name),
            scenario,
            scheme,
        }))
    )
}

const ACCEPTED: Corpus = {
    kind: 'accepted',
    folders: ['v2', 'v3'],
    planned: plan(
        SCENARIOS,
        ({ v2 }) => (v2 ? [V2, V3] : [V3]),
        (scheme, name) => ({
            id: `${short(scheme)}-${name}`,
            folder: short(scheme),
        })
    ),
}

const HELD_OUT: Corpus = {
    kind: 'held-out',
    folders: ['held-out'],
    planned: plan(
        HELD_OUT_SCENARIOS,
        () => [V3],
        (scheme, name) => ({
            id: `held-out-${short(scheme)}-${name}`,
            folder: 'held-out',
        })
    ),
}

class Mismatch extends Error {
    constructor(transaction: string, participant: string, ours: string) {
        super(
            `${transaction} does not hash as the participant hashed it\n` +
                `    participant:     ${participant}\n` +
                `    core-tx-hashing: ${ours}`
        )
        this.name = 'Mismatch'
    }
}

const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

const refusal = (error: unknown) =>
    error instanceof TxHashingError
        ? `${error.code}${error.path === undefined ? '' : ` at ${error.path}`}: ${error.message}`
        : message(error)

/** core-tx-hashing's hash of the prepared transaction; throws unless it is the participant's */
async function matchingHash(
    prepared: PrepareResponse,
    transaction: string
): Promise<Uint8Array> {
    const participant = toHex(fromBase64(prepared.preparedTransactionHash))
    let hash: Uint8Array
    try {
        hash = await computePreparedTransactionHash(
            prepared.preparedTransaction,
            prepared.hashingSchemeVersion
        )
    } catch (error) {
        throw new Mismatch(
            transaction,
            participant,
            `refused: ${refusal(error)}`
        )
    }
    if (toHex(hash) !== participant) {
        throw new Mismatch(transaction, participant, toHex(hash))
    }
    return hash
}

/** The protocol version, which ends a physical synchronizer id: `<id>::<protocol version>-<serial>` */
function protocolVersion(synchronizerId: string | undefined): number {
    const found = /::(\d+)-\d+$/.exec(synchronizerId ?? '')
    if (found === null) {
        throw new Error(
            `No protocol version in synchronizer id ${synchronizerId}`
        )
    }
    return Number(found[1])
}

type Executed = 'executed' | 'refused as expected' | 'not executed'

async function run(
    ctx: Context,
    canton: string,
    kind: AcceptedVector['kind'],
    { id, scenario, scheme }: Planned,
    executes: boolean
): Promise<{ vector: AcceptedVector; executed: Executed }> {
    const { actAs = [ctx.owner], ...request } = await scenario.setup(ctx)
    const prepared = await prepare(ctx.ledger, { ...request, actAs, scheme })
    const hash = await matchingHash(prepared, 'the transaction')
    const decoded = PreparedTransaction.fromBinary(
        fromBase64(prepared.preparedTransaction)
    )
    if (scheme === V2) {
        const beyond = int64sBeyond2To53(decoded)
        if (beyond.length > 0) {
            throw new Error(
                `A V2 vector may not hold an int64 beyond 2^53, this one holds ${beyond.join(', ')}`
            )
        }
    }
    const vector: AcceptedVector = {
        id,
        kind,
        scheme,
        preparedTransaction: prepared.preparedTransaction,
        expected: { hash: toHex(hash) },
        source: {
            canton,
            protocolVersion: protocolVersion(decoded.metadata?.synchronizerId),
            scenario: scenario.name,
        },
    }
    if (!executes) return { vector, executed: 'not executed' }
    const submission = { prepared, signers: actAs, hash }
    if (scenario.executeRefused === undefined) {
        await execute(ctx.ledger, submission)
        return { vector, executed: 'executed' }
    }
    try {
        await execute(ctx.ledger, submission)
    } catch (error) {
        if (
            error instanceof LedgerError &&
            error.body.includes(scenario.executeRefused)
        ) {
            return { vector, executed: 'refused as expected' }
        }
        throw error
    }
    throw new Error(
        `The participant executed the transaction, which it was expected to refuse with: ${scenario.executeRefused}`
    )
}

// The participant takes no other DAR under the name and version of one it has,
// and no later version of this package as an upgrade: an upgrade must
// implement the interfaces of the version it upgrades, and the templates of
// each version implement the interfaces it defines itself.
const REFUSED_UPLOAD = ['KNOWN_PACKAGE_VERSION', 'NOT_VALID_UPGRADE_PACKAGE']

async function setUp(ledger: Ledger): Promise<Context> {
    try {
        await uploadDar(ledger, DAR)
    } catch (error) {
        if (
            error instanceof LedgerError &&
            REFUSED_UPLOAD.some((code) => error.body.includes(code))
        ) {
            throw new Error(
                `The participant has another hash-vectors DAR, which this one can neither replace nor upgrade. Its ledger is in memory: restart Canton to begin with an empty one.\n${error.message}`
            )
        }
        throw error
    }
    const owner = await onboardExternalParty(ledger, 'hash-vectors-owner')
    const other = await onboardExternalParty(ledger, 'hash-vectors-other')
    const submit = async (
        commands: Command[],
        actAs: readonly ExternalParty[] = [owner]
    ) => {
        const prepared = await prepare(ledger, { actAs, commands, scheme: V3 })
        const hash = await matchingHash(prepared, 'a transaction it needs')
        return execute(ledger, { prepared, signers: actAs, hash })
    }
    let driver: Promise<string> | undefined
    return {
        ledger,
        owner,
        other,
        submit,
        driver: () =>
            (driver ??= submit([
                createCommand(templateId('Driver'), { owner: owner.partyId }),
            ]).then(
                (transaction) => created(transaction, 'Driver').contractId
            )),
    }
}

interface Written {
    readonly folder: string
    readonly vector: AcceptedVector
}

/** Writes the vectors; `replace` removes the other files of the folders of `corpus` */
async function write(corpus: Corpus, written: Written[], replace: boolean) {
    const kept = new Set(written.map(({ vector }) => `${vector.id}.json`))
    for (const folder of corpus.folders) {
        const directory = path.join(VECTORS, folder)
        await mkdir(directory, { recursive: true })
        if (!replace) continue
        for (const file of await readdir(directory)) {
            if (file.endsWith('.json') && !kept.has(file)) {
                await rm(path.join(directory, file))
                console.log(`removed ${folder}/${file}`)
            }
        }
    }
    for (const { folder, vector } of written) {
        await writeFile(
            path.join(VECTORS, folder, `${vector.id}.json`),
            `${JSON.stringify(vector, null, 4)}\n`
        )
    }
}

async function main() {
    const { values: options } = parseArgs({
        options: {
            execute: { type: 'boolean', default: false },
            'held-out': { type: 'boolean', default: false },
            only: { type: 'string' },
            synchronizer: { type: 'string' },
        },
    })
    if (options['held-out'] && options.only !== undefined) {
        throw new Error(
            'The held-out vectors are captured in one run: --only does not apply to --held-out'
        )
    }
    const corpus = options['held-out'] ? HELD_OUT : ACCEPTED
    const planned =
        options.only === undefined
            ? corpus.planned
            : corpus.planned.filter(
                  ({ scenario }) => scenario.name === options.only
              )
    if (planned.length === 0) {
        throw new Error(
            `No scenario ${options.only}, only: ${SCENARIOS.map(({ name }) => name).join(', ')}`
        )
    }
    if (!existsSync(DAR)) {
        throw new Error(`${DAR} is missing: run dpm build in generator/daml`)
    }

    const ledger = await connect(
        options.synchronizer === undefined
            ? {}
            : { synchronizerId: options.synchronizer }
    )
    const canton = await cantonVersion(ledger)
    const ctx = await setUp(ledger)

    const written: Written[] = []
    const failures: string[] = []
    const counts = { mismatches: 0, executed: 0, refused: 0 }
    for (const target of planned) {
        try {
            const { vector, executed } = await run(
                ctx,
                canton,
                corpus.kind,
                target,
                options.execute
            )
            written.push({ folder: target.folder, vector })
            if (executed === 'executed') counts.executed++
            if (executed === 'refused as expected') counts.refused++
            console.log(`${target.id}: hash matches, ${executed}`)
        } catch (error) {
            if (error instanceof Mismatch) counts.mismatches++
            failures.push(`${target.id}: ${message(error)}`)
            console.log(`${target.id}: FAILED: ${message(error)}`)
        }
    }

    const ok = failures.length === 0
    const verb = ok ? 'written' : 'matched'
    const inFolder = (folder: string) =>
        written.filter((entry) => entry.folder === folder).length
    console.log(
        [
            ...corpus.folders.map(
                (folder) => `${folder}: ${inFolder(folder)} ${verb}`
            ),
            `mismatches: ${counts.mismatches}`,
            options.execute
                ? `executed: ${counts.executed} ok, refused as expected: ${counts.refused}`
                : 'executed: none, run with --execute to execute',
        ].join(', ')
    )
    if (!ok) {
        console.log(`\n${failures.length} failed, nothing written:`)
        for (const failure of failures) console.log(failure)
        process.exitCode = 1
        return
    }
    await write(corpus, written, options.only === undefined)
}

await main()
