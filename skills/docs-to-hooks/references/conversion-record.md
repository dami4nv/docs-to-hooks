# Conversion record

Keep this outside automatically loaded agent instructions. Prefer a short table:

| Source rule | Disposition | Trigger and scope | Tests | Native activation | Doc action |
| --- | --- | --- | --- | --- | --- |
| Source path + heading or line | Check / context / retain / existing | Event, tool, predicate, expected outcome and gaps | Allowed, denied, unrelated, malformed | Verified version + evidence, or pending | Trim exact covered text, or retain + reason |

For example, “Never edit generated files” must remain when a guard only covers
native file-edit tools. Conversely, an instruction specifically about the native
editor can become an implementation pointer after the matching guard is tested
and active. A reminder can relocate detail but does not enforce compliance.

Include:

- Files added or modified and how they connect to each rule.
- Existing mechanisms reused and conflicts resolved.
- Standing-document lines before/after using the same counting method. Do not
  imply fewer lines necessarily means lower billed tokens or better results.
- Pending activation, partial coverage, failed checks, and retained rationale.
- Rollback: restore removed instructions, remove only these hook entries, then
  remove unreferenced scripts. Preserve user edits and other hooks throughout.

Do not store secrets, full transcripts, or copies of unrelated private documents
in this record. A second conversion should update it only for material changes.
