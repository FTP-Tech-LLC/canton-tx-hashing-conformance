// Hashes every V2 vector with an expected hash in v2/, mutation/ and held-out/
// with hashPreparedTransaction of @canton-network/core-tx-visualizer 1.9.1.
// Usage: node check-visualizer.ts <vectors dir> (Node 24 strips the types).
// Prints one line of counts per folder. Exits non-zero if a vector does not give
// its expected hash, after printing its id with both hashes.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { hashPreparedTransaction } from '@canton-network/core-tx-visualizer'

interface Vector {
    id?: string
    scheme?: string
    preparedTransaction: string
    expected?: { hash?: string }
}

interface Entry {
    name: string
    vector: Vector
}

const VISUALIZER_VERSION = '1.9.1'
const V2 = 'HASHING_SCHEME_VERSION_V2'
const FOLDERS = [
    ['accepted', 'v2'],
    ['mutation', 'mutation'],
    ['held-out', 'held-out'],
] as const

const args = process.argv.slice(2)
if (args.length !== 1) {
    console.error('usage: node check-visualizer.ts <vectors dir>')
    process.exit(1)
}
const vectorsDir = args[0]

const packageJson = new URL(
    '../package.json',
    import.meta.resolve('@canton-network/core-tx-visualizer')
)
const { version } = JSON.parse(readFileSync(packageJson, 'utf8')) as {
    version: string
}
if (version !== VISUALIZER_VERSION) {
    console.error(
        `core-tx-visualizer ${version} is installed, expected ${VISUALIZER_VERSION}`
    )
    process.exit(1)
}

function v2VectorsWithHash(dir: string): Entry[] {
    if (!existsSync(dir)) return []
    const names = readdirSync(dir).filter((name) => name.endsWith('.json'))
    return names
        .sort()
        .map((name) => ({ name, vector: readVector(join(dir, name)) }))
        .filter(
            ({ vector }) =>
                vector.scheme === V2 &&
                typeof vector.expected?.hash === 'string'
        )
}

function readVector(path: string): Vector {
    return JSON.parse(readFileSync(path, 'utf8')) as Vector
}

const counts: string[] = []
let mismatches = 0
for (const [label, folder] of FOLDERS) {
    const dir = join(vectorsDir, folder)
    const entries = v2VectorsWithHash(dir)
    if (folder === 'v2' && entries.length === 0) {
        console.error(`no V2 vectors with a hash in ${dir}`)
        process.exit(1)
    }
    let matched = 0
    for (const { name, vector } of entries) {
        let actual: string
        try {
            actual = await hashPreparedTransaction(
                vector.preparedTransaction,
                'hex'
            )
        } catch (error) {
            actual = String(error)
        }
        if (actual === vector.expected?.hash) {
            matched++
        } else {
            mismatches++
            const id = vector.id ?? basename(name, '.json')
            console.log(
                `mismatch ${id}: expected ${vector.expected?.hash}, visualizer ${actual}`
            )
        }
    }
    counts.push(`${label} ${matched}/${entries.length}`)
}
console.log(`visualizer ${version}: ${counts.join(', ')}`)
if (mismatches > 0) process.exitCode = 1
