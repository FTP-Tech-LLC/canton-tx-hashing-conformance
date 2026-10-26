// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Minimal JSON Ledger API client for the local Canton setup of the wallet
 * (`pnpm start:canton --network=mainnet` with the mock OAuth2 server).
 * Talks to the participant with plain `fetch` and signs with WebCrypto Ed25519.
 */

import { readFile } from 'node:fs/promises'

export const V2 = 'HASHING_SCHEME_VERSION_V2'
export const V3 = 'HASHING_SCHEME_VERSION_V3'
export type HashingScheme = typeof V2 | typeof V3

export interface Ledger {
    readonly url: string
    readonly token: string
    readonly userId: string
    readonly synchronizerId: string
}

export interface ExternalParty {
    readonly partyId: string
    readonly fingerprint: string
    readonly privateKey: CryptoKey
}

export interface PrepareResponse {
    readonly preparedTransaction: string
    readonly preparedTransactionHash: string
    readonly hashingSchemeVersion: HashingScheme
}

export type Command =
    | { CreateCommand: { templateId: string; createArguments: unknown } }
    | {
          ExerciseCommand: {
              templateId: string
              contractId: string
              choice: string
              choiceArgument: unknown
          }
      }
    | {
          ExerciseByKeyCommand: {
              templateId: string
              contractKey: unknown
              choice: string
              choiceArgument: unknown
          }
      }
    | {
          CreateAndExerciseCommand: {
              templateId: string
              createArguments: unknown
              choice: string
              choiceArgument: unknown
          }
      }

/** A contract given to prepare, so that a party that does not see it can use it */
export interface DisclosedContract {
    readonly templateId: string
    readonly contractId: string
    readonly createdEventBlob: string
    readonly synchronizerId: string
}

export interface CreatedEvent {
    contractId: string
    templateId: string
    createdEventBlob: string
}

export type TransactionEvent =
    | { CreatedEvent: CreatedEvent }
    | { ArchivedEvent: unknown }

export interface Transaction {
    updateId: string
    events: TransactionEvent[]
}

export class LedgerError extends Error {
    readonly status: number
    readonly body: string

    constructor(path: string, status: number, body: string) {
        super(`${path} failed with HTTP ${status}: ${body}`)
        this.name = 'LedgerError'
        this.status = status
        this.body = body
    }
}

export interface ConnectOptions {
    ledgerUrl?: string
    oauthUrl?: string
    userId?: string
    /** Needed when the participant is connected to more than one synchronizer */
    synchronizerId?: string
}

/**
 * Fetches a token for `userId` (default `participant_admin`) from the mock
 * OAuth2 server and checks the synchronizer that transactions go to.
 */
export async function connect(options: ConnectOptions = {}): Promise<Ledger> {
    const url = options.ledgerUrl ?? 'http://127.0.0.1:5003'
    const userId = options.userId ?? 'participant_admin'
    const token = await fetchToken(
        options.oauthUrl ?? 'http://127.0.0.1:8889',
        userId
    )
    const { connectedSynchronizers = [] } = await send<{
        connectedSynchronizers?: { synchronizerId: string }[]
    }>({ url, token }, '/v2/state/connected-synchronizers')
    const connected = connectedSynchronizers.map(
        ({ synchronizerId }) => synchronizerId
    )
    return {
        url,
        token,
        userId,
        synchronizerId: chooseSynchronizer(connected, options.synchronizerId),
    }
}

function chooseSynchronizer(
    connected: string[],
    wanted: string | undefined
): string {
    const list = connected.join(', ') || 'none'
    if (wanted !== undefined) {
        if (!connected.includes(wanted)) {
            throw new Error(
                `The participant is not connected to ${wanted}, only to: ${list}`
            )
        }
        return wanted
    }
    const [only, ...others] = connected
    if (only === undefined) {
        throw new Error('The participant is not connected to a synchronizer')
    }
    if (others.length > 0) {
        throw new Error(
            `The participant is connected to several synchronizers (${list}): choose one with --synchronizer`
        )
    }
    return only
}

async function fetchToken(oauthUrl: string, clientId: string) {
    const path = '/token'
    const response = await fetch(`${oauthUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // The mock server takes the subject from the client id and ignores the secret.
            Authorization: `Basic ${btoa(`${clientId}:unused`)}`,
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'daml_ledger_api',
        }),
    })
    if (!response.ok) {
        throw new LedgerError(path, response.status, await response.text())
    }
    const { access_token } = (await response.json()) as {
        access_token: string
    }
    return access_token
}

async function send<T>(
    ledger: Pick<Ledger, 'url' | 'token'>,
    path: string,
    body?: { contentType: string; data: BodyInit }
): Promise<T> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${ledger.token}`,
    }
    if (body !== undefined) headers['Content-Type'] = body.contentType
    const response = await fetch(`${ledger.url}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body?.data ?? null,
    })
    const text = await response.text()
    if (!response.ok) throw new LedgerError(path, response.status, text)
    return JSON.parse(text) as T
}

function post<T>(ledger: Ledger, path: string, payload: unknown): Promise<T> {
    return send<T>(ledger, path, {
        contentType: 'application/json',
        data: JSON.stringify(payload),
    })
}

/** The Canton version of the participant, such as `3.5.10` */
export async function cantonVersion(ledger: Ledger): Promise<string> {
    const { version } = await send<{ version: string }>(ledger, '/v2/version')
    return version
}

/** Uploads a DAR and vets its packages on the connected synchronizer. */
export async function uploadDar(ledger: Ledger, darPath: string) {
    await send(ledger, '/v2/dars?vetAllPackages=true', {
        contentType: 'application/octet-stream',
        data: new Uint8Array(await readFile(darPath)),
    })
}

/**
 * Onboards a new external party hosted on this participant with a fresh
 * Ed25519 key, then lets the token's user act as it.
 */
export async function onboardExternalParty(
    ledger: Ledger,
    partyHint: string
): Promise<ExternalParty> {
    const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
        'sign',
        'verify',
    ])
    const publicKey = await crypto.subtle.exportKey('raw', keys.publicKey)
    const topology = await post<{
        partyId: string
        publicKeyFingerprint: string
        topologyTransactions: string[]
        multiHash: string
    }>(ledger, '/v2/parties/external/generate-topology', {
        synchronizer: ledger.synchronizerId,
        partyHint,
        publicKey: {
            format: 'CRYPTO_KEY_FORMAT_RAW',
            keyData: toBase64(new Uint8Array(publicKey)),
            keySpec: 'SIGNING_KEY_SPEC_EC_CURVE25519',
        },
    })
    const party: ExternalParty = {
        partyId: topology.partyId,
        fingerprint: topology.publicKeyFingerprint,
        privateKey: keys.privateKey,
    }
    await post(ledger, '/v2/parties/external/allocate', {
        synchronizer: ledger.synchronizerId,
        onboardingTransactions: topology.topologyTransactions.map(
            (transaction) => ({ transaction })
        ),
        multiHashSignatures: [
            await signature(party, fromBase64(topology.multiHash)),
        ],
    })
    await waitForParty(ledger, party.partyId)
    await grantActAs(ledger, party.partyId)
    return party
}

async function waitForParty(ledger: Ledger, partyId: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
        const { partyDetails } = await send<{
            partyDetails: { party: string }[]
        }>(ledger, `/v2/parties/${encodeURIComponent(partyId)}`)
        if (partyDetails.some(({ party }) => party === partyId)) return
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error(`Party ${partyId} did not appear on the participant`)
}

async function grantActAs(ledger: Ledger, partyId: string) {
    await post(
        ledger,
        `/v2/users/${encodeURIComponent(ledger.userId)}/rights`,
        {
            userId: ledger.userId,
            identityProviderId: '',
            rights: [{ kind: { CanActAs: { value: { party: partyId } } } }],
        }
    )
}

export function createCommand(
    templateId: string,
    createArguments: unknown
): Command {
    return { CreateCommand: { templateId, createArguments } }
}

export function exerciseCommand(
    templateId: string,
    contractId: string,
    choice: string,
    choiceArgument: unknown
): Command {
    return {
        ExerciseCommand: { templateId, contractId, choice, choiceArgument },
    }
}

export function exerciseByKeyCommand(
    templateId: string,
    contractKey: unknown,
    choice: string,
    choiceArgument: unknown
): Command {
    return {
        ExerciseByKeyCommand: {
            templateId,
            contractKey,
            choice,
            choiceArgument,
        },
    }
}

export function createAndExerciseCommand(
    templateId: string,
    createArguments: unknown,
    choice: string,
    choiceArgument: unknown
): Command {
    return {
        CreateAndExerciseCommand: {
            templateId,
            createArguments,
            choice,
            choiceArgument,
        },
    }
}

export interface PrepareRequest {
    /** The parties the transaction acts as. Each signs it to execute it. */
    actAs: readonly ExternalParty[]
    commands: readonly Command[]
    scheme: HashingScheme
    disclosedContracts?: readonly DisclosedContract[]
    /** The latest record time at which the synchronizer takes the transaction */
    maxRecordTime?: Date
}

/** Prepares a transaction; throws unless the participant hashed it with the scheme asked for. */
export async function prepare(
    ledger: Ledger,
    request: PrepareRequest
): Promise<PrepareResponse> {
    const response = await post<PrepareResponse>(
        ledger,
        '/v2/interactive-submission/prepare',
        {
            commandId: crypto.randomUUID(),
            actAs: request.actAs.map(({ partyId }) => partyId),
            commands: request.commands,
            synchronizerId: ledger.synchronizerId,
            // Optional in the OpenAPI spec, but the 3.5 JSON API rejects a body without it.
            packageIdSelectionPreference: [],
            hashingSchemeVersion: request.scheme,
            disclosedContracts: request.disclosedContracts ?? [],
            ...(request.maxRecordTime === undefined
                ? {}
                : { maxRecordTime: request.maxRecordTime.toISOString() }),
        }
    )
    if (response.hashingSchemeVersion !== request.scheme) {
        throw new Error(
            `Requested ${request.scheme}, the participant hashed with ${response.hashingSchemeVersion}`
        )
    }
    return response
}

export interface ExecuteRequest {
    prepared: PrepareResponse
    /** The parties the transaction acts as, as given to prepare */
    signers: readonly ExternalParty[]
    /** What each signer signs: the hash of the prepared transaction, as the caller computed it */
    hash: Uint8Array
}

/**
 * Executes a prepared transaction with one signature over `hash` per signer.
 * The transaction it returns has the created event blobs, which another
 * party needs to use a contract as a disclosed contract.
 */
export async function execute(
    ledger: Ledger,
    { prepared, signers, hash }: ExecuteRequest
): Promise<Transaction> {
    const allTemplates = {
        cumulative: [
            {
                identifierFilter: {
                    WildcardFilter: {
                        value: { includeCreatedEventBlob: true },
                    },
                },
            },
        ],
    }
    const { transaction } = await post<{ transaction: Transaction }>(
        ledger,
        '/v2/interactive-submission/executeAndWaitForTransaction',
        {
            preparedTransaction: prepared.preparedTransaction,
            hashingSchemeVersion: prepared.hashingSchemeVersion,
            submissionId: crypto.randomUUID(),
            deduplicationPeriod: { Empty: {} },
            partySignatures: {
                signatures: await Promise.all(
                    signers.map(async (party) => ({
                        party: party.partyId,
                        signatures: [await signature(party, hash)],
                    }))
                ),
            },
            transactionFormat: {
                transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA',
                eventFormat: {
                    filtersByParty: Object.fromEntries(
                        signers.map(({ partyId }) => [partyId, allTemplates])
                    ),
                    verbose: false,
                },
            },
        }
    )
    return transaction
}

/** The contracts created in `transaction` from templates whose id ends with `templateSuffix` */
export function createdContracts(
    transaction: Transaction,
    templateSuffix: string
): CreatedEvent[] {
    return transaction.events.flatMap((event) =>
        'CreatedEvent' in event &&
        event.CreatedEvent.templateId.endsWith(templateSuffix)
            ? [event.CreatedEvent]
            : []
    )
}

/** `contract` as another party gives it to prepare */
export function disclose(
    ledger: Ledger,
    contract: CreatedEvent
): DisclosedContract {
    return {
        templateId: contract.templateId,
        contractId: contract.contractId,
        createdEventBlob: contract.createdEventBlob,
        synchronizerId: ledger.synchronizerId,
    }
}

async function signature(party: ExternalParty, bytes: Uint8Array) {
    const signed = await crypto.subtle.sign(
        'Ed25519',
        party.privateKey,
        // sign() takes only ArrayBuffer-backed arrays
        new Uint8Array(bytes)
    )
    return {
        format: 'SIGNATURE_FORMAT_CONCAT',
        signature: toBase64(new Uint8Array(signed)),
        signedBy: party.fingerprint,
        signingAlgorithmSpec: 'SIGNING_ALGORITHM_SPEC_ED25519',
    }
}

export function toBase64(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

export function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}
