#!/usr/bin/env bash
# Downloads the Python hashing example of Canton v3.5.1 and the .proto files of the bindings
# it imports, checks each file against its pinned sha256 and generates the bindings.
# Result: python/build/{reference,proto,gen}. On any failure python/build/ does not exist.
set -euo pipefail

canton=https://raw.githubusercontent.com/digital-asset/canton/8d252e6592354ac244eb65c850c4ef2a9a9b63c2
examples=$canton/community/app/src/pack/examples/08-interactive-submission
ledger_api=$canton/community/ledger-api-proto/src/main/protobuf
value_api=$canton/community/daml-lf/ledger-api-value-proto/src/main/protobuf
# The commit that the example's setup.sh downloads google/rpc/status.proto from.
googleapis=https://raw.githubusercontent.com/googleapis/googleapis/3597f7db2191c00b100400991ef96e52d62f5841

python=${PYTHON:-python3}
build=$(cd "$(dirname "$0")" && pwd)/build
rm -rf "$build"
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT

sha256() {
    if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d ' ' -f 1
}

# fetch <sha256> <url> <path under build/>
fetch() {
    mkdir -p "$(dirname "$staging/$3")"
    curl --fail --silent --show-error --location --proto '=https' --retry 3 --output "$staging/$3" "$2"
    local actual
    actual=$(sha256 "$staging/$3")
    if [ "$actual" != "$1" ]; then
        printf 'sha256 mismatch for %s\n  pinned: %s\n  actual: %s\n' "$2" "$1" "$actual" >&2
        exit 1
    fi
}

protos=()
# fetch_proto <sha256> <proto root url> <import path>
fetch_proto() {
    fetch "$1" "$2/$3" "proto/$3"
    protos+=("$staging/proto/$3")
}

fetch d935e407519ffc451db821ef590c417e13f4f79af926c2142574d980b609ddf8 "$examples/daml_transaction_hashing_common.py" reference/daml_transaction_hashing_common.py
fetch a219993dce1572d33aa1f8623dc17a4da8dff48d161c83bae8ce8756be804d09 "$examples/daml_transaction_hashing_v2.py" reference/daml_transaction_hashing_v2.py
fetch a5ab9316b2221eef7a589ca01b7150312db9d1fa08073a485e051dce5830731e "$examples/daml_transaction_hashing_v3.py" reference/daml_transaction_hashing_v3.py

fetch_proto fd7b85a6f2e684e30bc579c307e87b29dc8eefd8669e392a6a11947c257d05bf "$ledger_api" com/daml/ledger/api/v2/interactive/interactive_submission_service.proto
fetch_proto 72dc504747cb7545b51f3b19ee3567b0835194e599fc8ca194128e7242ebb577 "$ledger_api" com/daml/ledger/api/v2/interactive/interactive_submission_common_data.proto
fetch_proto c1883a9434d6e1ff9d17c977072b6c401ba463e54bff1883a23a4876205e527f "$ledger_api" com/daml/ledger/api/v2/interactive/transaction/v1/interactive_submission_data.proto
fetch_proto aff5a1373e4abc919bde0f10de474eb371339741c010c1d33f3addc32c33c8f8 "$ledger_api" com/daml/ledger/api/v2/commands.proto
fetch_proto dbf1e5227b917ee66a7e3ebbe062bbfcf36a5a9a47c35ed334ff8f8e3da7dd54 "$ledger_api" com/daml/ledger/api/v2/crypto.proto
fetch_proto 39cc6325a82b9de17ee42f015a5913c2a975c857208fecd9726ccc16c2994c08 "$ledger_api" com/daml/ledger/api/v2/event.proto
fetch_proto 1b263f7c2239c2ab1cee7ee3d57f85e6e29ef359238c2474d80020f130d3c74a "$ledger_api" com/daml/ledger/api/v2/package_reference.proto
fetch_proto 5d160ddcb6582c3f0379270e588802cac49d9c5c9925e81681f541b58849f0b7 "$ledger_api" com/daml/ledger/api/v2/trace_context.proto
fetch_proto 441615c68c022b20850d653e903a3b96082460c77f253ad4ce55c980799f7684 "$ledger_api" com/daml/ledger/api/v2/transaction.proto
fetch_proto 82d06e3fabfb7bf3388261f3b36bfe32ce3f1ee015b661a1e690b2bcf5958c0e "$ledger_api" com/daml/ledger/api/v2/transaction_filter.proto
fetch_proto 5474ef65abe5402ed1720d17031c0339176b3bdf83506b243e0663e2efb9b3f5 "$value_api" com/daml/ledger/api/v2/value.proto
fetch_proto b35706fa0e4b2354f67f8d7b8e6b55584d0c4dae920d5f6d2bc2e7ba22f9d6c1 "$googleapis" google/rpc/status.proto

# grpc_tools.protoc adds the well-known types (google/protobuf/*.proto) it bundles to the import path.
mkdir "$staging/gen"
"$python" -I -m grpc_tools.protoc --proto_path="$staging/proto" --python_out="$staging/gen" "${protos[@]}"

mv "$staging" "$build"
echo "reference and bindings in $build"
