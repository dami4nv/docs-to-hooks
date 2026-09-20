# Report and gate inputs

The evaluator accepts one JSON object. `context` and `dispositions` must come from
trusted orchestration, not the model, PR files, author-supplied JSON, or an
unverified Actions artifact. `report` is untrusted reviewer output. Missing or
invalid input blocks; a successful model process alone is not a successful review.

```json
{
  "context": {
    "target": {
      "repository": "example/product",
      "pullRequest": 12,
      "baseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "headSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    },
    "sources": {
      "example/product": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    },
    "reviewCompleted": true,
    "approvers": ["maintainer"]
  },
  "report": {
    "schemaVersion": 1,
    "target": {
      "repository": "example/product",
      "pullRequest": 12,
      "baseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "headSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    },
    "sources": {
      "example/product": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    },
    "findings": []
  },
  "dispositions": []
}
```

Each finding has `id`, `severity` (`blocking` or `advisory`), `title`, `rationale`,
`recommendation`, `proposed` and `existing`. Each location contains `repository`,
`path` (relative to that repository) and `line` (positive integer). Both referenced
repositories must appear in the pinned `sources` map. The trusted runner must
check that cited files/lines exist in those snapshots; the evaluator does not
read source or decide whether the model's reasoning is correct.

The evaluator outputs `reportDigest`, a SHA-256 of the canonical validated report.
An accepted exception contains:

```json
{
  "findingId": "duplicate-parser",
  "reportDigest": "64 lowercase hexadecimal characters from the gate",
  "action": "accept",
  "reason": "Separate parsing is needed during this bounded format migration.",
  "actor": { "login": "maintainer", "type": "User" }
}
```

The digest binds acceptance to repository, PR, base/head, reference revisions and
finding contents. A changed report requires fresh acceptance. The evaluator
rejects unknown or repeated finding IDs, bot/unauthorized actors, empty reasons,
and stale digests. Fixes are established by a fresh review, never a `fixed: true`
claim supplied by the implementation agent. Advisory findings do not block.

Run with Node.js 22+:

```sh
node path/to/skills/review-duplication/scripts/evaluate-review.mjs < gate-input.json
```

Exit 0 means the supplied evidence satisfies this gate; exit 1 means blocked.
The output includes unresolved finding IDs, accepted/advisory IDs, and the report
digest. It is not a claim that GitHub protection or reviewer authentication was
configured. Inputs are bounded to 1 MB; oversized evidence fails explicitly.
