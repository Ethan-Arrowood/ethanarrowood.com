# Vendored Dais (this talk only)

Presentation framework for this deck. Copied here on purpose rather than
installed: a deck presented on a conference stage must not change because a
dependency did.

Each talk vendors its **own** copy of Dais under its `slides/dais/`, and the
deck references it with **relative** paths (`dais/dais.css`, etc.). That way a
new talk can adopt a newer Dais without touching, or re-testing, any older deck.

- Source: https://github.com/Ethan-Arrowood/dais (`@arrowood.dev/dais`)
- Version: 0.3.0 plus the overview thumbnail fix (`b4f5876`), the same files
  as the Render ATL integration testing deck
- Vendored: 2026-10-26

No bundled theme is vendored. The deck's look lives in `../theme.css`, a
custom Node.js × JSConf México theme written for this deck, linked after
`dais.css`.

To adopt a newer Dais for a future talk, copy `dais.css` and `dais.js` from
that version into the new talk's `slides/dais/` and record the version here.
Leave existing talks on the version they were built and tested against.

MIT licensed; see LICENSE.
