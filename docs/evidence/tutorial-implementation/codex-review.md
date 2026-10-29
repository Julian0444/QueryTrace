# Codex browser verification

Candidate: `736e0d100062a83440ae67a0051521d096067570`. The static test server’s three frontend files match this checkout byte-for-byte ([reviewed-commit hashes](reviewed-assets.json)).

Chrome/CUA, a separate agent-created tab at `http://localhost:8041/app/`, using the existing temporary-corpus test server. T3 Preview could navigate and measure the viewport, but two snapshots failed with `Preview automation snapshot timed out after 15000ms`; its tab was closed and inspection continued with CUA.

I used the guide at 375×667 light, 390×844 dark and 1440×900 dark, including actual retrieval/comparison, opening the source, entering a different question and finishing, exiting and reopening. The question, returned policy contrast and source were visible in the guide. I repeated retrieval → comparison → source after reloading the committed candidate at 1440×900. The full-policy trace had 397px content width in a 397px scroll region, and its keyboard scroll received visible focus without widening the page. Saved CUA source and trace captures are in `captures/`.

The six automated viewport/theme runs additionally cover both light and dark at all three requested sizes, with actual requests and focus hit testing; their 24 final screenshots were inspected individually and as contact sheets. These screenshots were produced in a pristine disposable corpus before upload tests, so their counts reflect the bundled demo. The full 72-test suite also exercises later results after temporary-corpus uploads; those may have different counts, and the UI reflects them.

No new blocking problem was observed in these checks. This is an expert interaction review, not a study of new users. No physical phone, virtual keyboard, Safari/Firefox or screen reader was tested. Error/retry, restricted-account, no-scenario and empty-corpus coverage is supplied by the interactive browser regressions and the independent review’s separately stated coverage; it is not claimed as additional manual Codex coverage.

After the independent review, Codex verified Julia’s corrected variation text manually in Chrome at 1440×900 dark. It names the original Full Policy evidence, without claiming a comparison ran. The latest six viewport/theme runs regenerated final captures after the text correction.
