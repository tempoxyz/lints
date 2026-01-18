#!/usr/bin/env bash
set -euo pipefail

# Vendor Tempo lints into a project
#
# Usage:
#   ./scripts/vendor.sh --lang rust --dest /path/to/project
#   ./scripts/vendor.sh --lang typescript --dest /path/to/project
#   ./scripts/vendor.sh --lang all --dest /path/to/project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

usage() {
    echo "Usage: $0 --lang <rust|typescript|all> --dest <path>"
    echo ""
    echo "Options:"
    echo "  --lang      Language rules to vendor (rust, typescript, or all)"
    echo "  --dest      Destination project path"
    echo "  --help      Show this help message"
    exit 1
}

LANG=""
DEST=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --lang)
            LANG="$2"
            shift 2
            ;;
        --dest)
            DEST="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

if [[ -z "$LANG" ]] || [[ -z "$DEST" ]]; then
    echo "Error: --lang and --dest are required"
    usage
fi

AST_GREP_DIR="$DEST/.ast-grep"

echo "Vendoring Tempo lints..."
echo "  Language: $LANG"
echo "  Destination: $AST_GREP_DIR"

mkdir -p "$AST_GREP_DIR"

# Always copy shared rules
echo "  Copying shared rules..."
cp -r "$REPO_ROOT/shared" "$AST_GREP_DIR/"

case $LANG in
    rust)
        echo "  Copying Rust rules..."
        cp -r "$REPO_ROOT/rust" "$AST_GREP_DIR/"
        # Use Rust config as main config
        cp "$REPO_ROOT/rust/sgconfig.yml" "$DEST/sgconfig.yml"
        ;;
    typescript)
        echo "  Copying TypeScript rules..."
        cp -r "$REPO_ROOT/typescript" "$AST_GREP_DIR/"
        # Use TypeScript config as main config
        cp "$REPO_ROOT/typescript/sgconfig.yml" "$DEST/sgconfig.yml"
        ;;
    all)
        echo "  Copying all rules..."
        cp -r "$REPO_ROOT/rust" "$AST_GREP_DIR/"
        cp -r "$REPO_ROOT/typescript" "$AST_GREP_DIR/"
        # Create combined config
        cat > "$DEST/sgconfig.yml" << EOF
ruleDirs:
  - .ast-grep/shared/rules
  - .ast-grep/rust/rules
  - .ast-grep/typescript/rules

testConfigs:
  - testDir: .ast-grep/rust/tests
  - testDir: .ast-grep/typescript/tests
EOF
        ;;
    *)
        echo "Error: Unknown language '$LANG'"
        usage
        ;;
esac

echo ""
echo "Done! Add to your Makefile:"
echo ""
echo "  lint-ast:"
echo "      ast-grep scan --config sgconfig.yml"
echo ""
echo "  fix-ast:"
echo "      ast-grep scan --config sgconfig.yml --update-all"
