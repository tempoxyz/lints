.PHONY: test test-rust test-typescript lint update-snapshots

# Run all tests
test: test-rust test-typescript

# Test Rust rules
test-rust:
	@echo "Testing Rust rules..."
	@cd rust && ast-grep test --config sgconfig.yml

# Test TypeScript rules
test-typescript:
	@echo "Testing TypeScript rules..."
	@cd typescript && ast-grep test --config sgconfig.yml

# Update all snapshots
update-snapshots:
	@cd shared && ast-grep test --config sgconfig.yml --update-all
	@cd rust && ast-grep test --config sgconfig.yml --update-all
	@cd typescript && ast-grep test --config sgconfig.yml --update-all

# Lint this repo (dogfooding)
lint:
	@echo "No code to lint in this repo"
