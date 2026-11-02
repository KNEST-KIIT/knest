# Restore drill

A backup that has never been restored is a hope. This is the procedure, and the place to record each run.

**Why it matters.** The database has automated backups with 7 days of point-in-time recovery, and the deploy takes a
snapshot before every migration. Neither has been proven to restore. If the day comes, the question will be "how long
until the site is back", and the only honest answer is a number measured in advance.

## Run it

1. Check the plan without changing anything:

   ```
   bash scripts/ops/restore-drill.sh --dry-run
   ```

   It prints the source database, the snapshot it chose (the newest `pre-migrate-*`), and the name of the drill instance.

2. Run it:

   ```
   bash scripts/ops/restore-drill.sh
   ```

   It restores the snapshot into a new private instance `knest-drill-<time>` in the production subnet group and database
   security group, waits until it is available, and prints the time taken. It never touches the live database. It uses
   only the actions in the operator policy's `SnapshotsAndRestoreDrills` statement.

3. From the app host (the database is private), check the data is really there: row counts for `app.users`,
   `app.applications`, `app.audit_logs` against production, and the newest `created_at` in each, which tells you how
   much would be lost (the age of the snapshot).

4. Remove the drill instance. The operator policy cannot delete, so the account owner runs the two commands the script
   prints at the end (turn off deletion protection, then delete without a final snapshot).

5. Fill in the table below and commit it.

## What a restore does not bring back

- **Documents.** The bucket is versioned and separate; a database restore does not roll it back. After a restore, run
  the storage reconcile (`STORAGE_RECONCILE` dry run) to see rows without files and files without rows.
- **Secrets and parameters.** They live in Secrets Manager and Parameter Store, not in the database.
- **Anything after the snapshot.** Applications submitted since then are gone. Quote the snapshot's age with the time.

## Record of runs

| Date | Snapshot | Time to usable | Row counts matched | Run by | Notes |
|---|---|---|---|---|---|
| _not yet run_ | | | | | |
