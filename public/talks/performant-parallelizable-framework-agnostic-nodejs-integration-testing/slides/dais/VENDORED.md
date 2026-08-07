# Vendored Dais (this talk only)

Presentation framework for this deck. Copied here on purpose rather than
installed: a deck presented on a conference stage must not change because a
dependency did.

Each talk vendors its **own** copy of Dais under its `slides/dais/`, and the
deck references it with **relative** paths (`dais/dais.css`, etc.). That way a
new talk can adopt a newer Dais without touching, or re-testing, any older deck.

- Source: https://github.com/Ethan-Arrowood/dais (`@arrowood.dev/dais`)
- Commit: b22777b488c5553fe6efca13b40ab7c3ff29d2e6
- Version: 0.1.1
- Vendored: 2026-08-04

To adopt a newer Dais for a future talk, copy `dais.css`, `dais.js`, and the
theme CSS from that version into the new talk's `slides/dais/` and record the
version here. Leave existing talks on the version they were built and tested
against.

MIT licensed; see LICENSE.
