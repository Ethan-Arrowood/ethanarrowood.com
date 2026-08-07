# Vendored Dais (this talk only)

Presentation framework for this deck. Copied here on purpose rather than
installed: a deck presented on a conference stage must not change because a
dependency did.

Each talk vendors its **own** copy of Dais under its `slides/dais/`, and the
deck references it with **relative** paths (`dais/dais.css`, etc.). That way a
new talk can adopt a newer Dais without touching, or re-testing, any older deck.

- Source: https://github.com/Ethan-Arrowood/dais (`@arrowood.dev/dais`)
- Version: 0.2.0 (published npm tarball)
- Vendored: 2026-08-07

Note for 0.2.0: slide dots and edge arrows are now opt-in. The deck's
`<main class="dais dais-dots dais-arrows">` enables both; drop a class to turn
either off. `dais.js` and `themes/midnight.css` are unchanged from 0.1.1.

To adopt a newer Dais for a future talk, copy `dais.css`, `dais.js`, and the
theme CSS from that version into the new talk's `slides/dais/` and record the
version here. Leave existing talks on the version they were built and tested
against.

MIT licensed; see LICENSE.
