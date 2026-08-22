.PHONY: install test lint format build clean

install:
	pip install -e ".[dev]"

test:
	pytest

test-cov:
	pytest --cov=polymorpha --cov-report=term-missing

lint:
	ruff check polymorpha/
	mypy polymorpha/

format:
	ruff format polymorpha/

build:
	python -m build

clean:
	rm -rf build/ dist/ *.egg-info/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
