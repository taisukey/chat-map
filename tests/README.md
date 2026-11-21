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
For v2.1, the suite checks that exactly one `cmxToneBtn` button exists
and that the controller defines the standard → dark → mono cycle.

Static presence assertions cover the v2.1 `vaultIOS` helpers and their use
in both note-URL builders, plus the `browserUrl` elements and controller wiring.
They also cover the controller's `seenDay` and `lastNew` reads and writes,
the NEW chip and count elements, the previous-batch panel and 前回 label,
and the graph's SVG arrival marker.
The suite also checks the four search controls, the card and tree jump functions,
and the cards' `data-nid` attributes.
Browser rendering and visual layout remain out of scope.
