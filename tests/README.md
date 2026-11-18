# Static tests

Run `python3 tests/run_tests.py` from the repository root. The runner uses
the Python standard library and exits with a nonzero status if any check fails.

- `python3 tests/run_tests.py --data /path/to/map.json` validates a standalone
  CM_DATA file using the current template's cluster and edge type keys.
- `python3 tests/run_tests.py --denylist /path/to/terms.txt` runs the suite
  with additional case-sensitive literal scrub terms, one per nonblank line.
  Keep the word list outside the repository because the scan includes repository
  files. Combine both options to validate standalone data and run the scrub check.

The suite checks template presence, UTF-8 headers, data assignment counts,
view and tone buttons, sample data, seven invalid fixtures, README relative
targets, SKILL.md frontmatter, and repository scrub terms.

Static presence assertions cover the v2.1 `vaultIOS` helpers and their use
in both note-URL builders, plus the `browserUrl` elements and controller wiring.
Browser rendering and visual layout remain out of scope.
