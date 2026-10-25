# Backlog

Ideas and research notes that are **not scheduled** yet. Nothing here is a commitment: an item becomes work only when
it is promoted to a phase in [specs/roadmap.md](../specs/roadmap.md) during replanning, and then gets a feature spec.

One file per topic, named `YYYY-MM-DD-<topic>.md`: the question, options considered, findings, and a recommendation.

## Ideas

From mission §2.3 ("design for, don't build"). The data model already keeps `id` UUIDs, `updatedAt` and `deletedAt`
tombstones on every record so these stay possible:

- Optional end-to-end-encrypted sync between the user's own devices
- Encryption at rest (the app lock is a UI lock only; see decisions D-063)
- Custom record templates
- Connecting people to non-person records (companies, homes, vehicles)
- Voice dictation in the composer: needs an on-device speech API. Today's browser speech recognition sends audio to a server
  (conflicts with mission §1.2); see decisions D-070
