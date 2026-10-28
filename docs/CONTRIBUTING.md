# Contributing

## Setup

See [README.md](../README.md) → "Quick start". In short: Python 3.10+, Node 20+, a venv in `backend/.venv`,
`npm install` in `frontend/`.

## Working rules

1. **Explain before coding.** Write down what you will change, why, and which files, before editing.
2. **Small steps.** One fix or feature at a time; run the checks after each.
3. **Every bug fix gets a test** in `backend/test_rekha.py` that fails on the old code.
4. **Before you finish, run:**
   ```bash
   cd backend  && python -m pytest -q
   cd frontend && npm run build && npm audit
   ```
5. **Honest numbers.** Anything shown as a metric must be measured by the code, or labelled as a
   study figure.
6. **Never commit secrets.** No keys, tokens or `.env` files. The demo signing key is generated
   in memory at start-up on purpose.
7. **Docs live in `docs/`.** Update `PROGRESS.md`, `testing.md` and `decisions.md` after each
   change; add new terms to `glossary.md`. Only `README.md` lives in the project root.
8. **Match the existing style:** Tailwind classes in JSX, small components, short comments
   that explain *why*.
