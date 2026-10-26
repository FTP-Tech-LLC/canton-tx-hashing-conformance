"""Hashes the vectors with the unmodified Python hashing example of Canton v3.5.1.

Run python/fetch_reference.sh first, then:
    python -I python/check_vectors.py <vectors dir>
Prints one line of counts. Exits non-zero if a folder lacks the vectors it must
hold, or if a vector does not give its expected hash, after printing its id with
both hashes.
"""

import base64
import importlib
import json
import sys
from pathlib import Path

BUILD = Path(__file__).resolve().parent / "build"
V2 = "HASHING_SCHEME_VERSION_V2"
V3 = "HASHING_SCHEME_VERSION_V3"

# folder, kind of its vectors, scheme each of them must have (None: any). Each
# folder must hold vectors.
FOLDERS = (
    ("v2", "accepted", V2),
    ("v3", "accepted", V3),
    ("mutation", "mutation", None),
    ("held-out", "held-out", V3),
)


def load_reference():
    if not BUILD.is_dir():
        sys.exit(f"{BUILD} does not exist: run python/fetch_reference.sh first")
    sys.path += [str(BUILD / "gen"), str(BUILD / "reference")]
    service = importlib.import_module(
        "com.daml.ledger.api.v2.interactive.interactive_submission_service_pb2"
    )
    common = importlib.import_module("daml_transaction_hashing_common")
    modules = {
        V2: importlib.import_module("daml_transaction_hashing_v2"),
        V3: importlib.import_module("daml_transaction_hashing_v3"),
    }

    # As interactive_submission.py of the example hashes a prepared transaction.
    def hash_prepared_transaction(encoded, scheme):
        if scheme not in modules:
            raise ValueError(f"the reference has no module for {scheme}")
        prepared_transaction = service.PreparedTransaction()
        prepared_transaction.ParseFromString(base64.b64decode(encoded, validate=True))
        digest = modules[scheme].encode_prepared_transaction(
            prepared_transaction, common.create_nodes_dict(prepared_transaction)
        )
        return digest.hex()

    return hash_prepared_transaction


def main(argv):
    if len(argv) != 2:
        sys.exit("usage: python -I python/check_vectors.py <vectors dir>")
    vectors = Path(argv[1])
    hash_prepared_transaction = load_reference()
    counts = []
    mismatches = 0
    for folder, kind, folder_scheme in FOLDERS:
        files = sorted((vectors / folder).glob("*.json"))
        if not files:
            sys.exit(f"no vectors in {vectors / folder}")
        loaded = [
            (file, json.loads(file.read_text(encoding="utf-8"))) for file in files
        ]
        matched = 0
        for file, vector in loaded:
            expected = vector.get("expected", {}).get("hash")
            try:
                if vector.get("kind") != kind:
                    raise ValueError(f"kind {vector.get('kind')} in {folder}/")
                if folder_scheme and vector.get("scheme") != folder_scheme:
                    raise ValueError(f"scheme {vector.get('scheme')} in {folder}/")
                actual = hash_prepared_transaction(
                    vector["preparedTransaction"], vector["scheme"]
                )
            except Exception as error:
                actual = f"{type(error).__name__}: {error}"
            if actual == expected:
                matched += 1
            else:
                mismatches += 1
                vector_id = vector.get("id", file.stem)
                print(f"mismatch {vector_id}: expected {expected}, python {actual}")
        counts.append(f"{folder}: {matched}/{len(files)}")
    print(f"python {', '.join(counts)}, mismatches: {mismatches}")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
