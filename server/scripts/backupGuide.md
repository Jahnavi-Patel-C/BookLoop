# BookLoop — Database Backup & Disaster Recovery Guide

This guide details procedures for backing up and restoring MongoDB databases for BookLoop in both local development and MongoDB Atlas production environments.

---

## 1. Prerequisites

Install MongoDB Database Tools (`mongodump` and `mongorestore`):
- macOS: `brew tap mongodb/brew && brew install mongodb-database-tools`
- Windows: Download from the official [MongoDB Tools Download Center](https://www.mongodb.com/try/download/database-tools) or install via `winget install MongoDB.DatabaseTools`.
- Linux: `sudo apt-get install mongodb-database-tools`

---

## 2. Production Backup (MongoDB Atlas)

### Scheduled Automated Backups
MongoDB Atlas provides built-in Point-in-Time Restore (PITR) and daily automated snapshots:
1. Open the [MongoDB Atlas Console](https://cloud.mongodb.com).
2. Navigate to your cluster -> **Backup** tab.
3. Verify that Cloud Backups are enabled.

### Manual Backup via `mongodump`
To take an immediate point-in-time snapshot of the production database before major operations:

```bash
# Set your Atlas connection URI (replace credentials safely)
export MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/bookloop"
BACKUP_DIR="./backups/$(date +%Y-%m-%d_%H%M%S)"

# Run mongodump with gzip compression
mongodump --uri="$MONGODB_URI" --gzip --out="$BACKUP_DIR"
```

This creates an archive of all collections:
- `users.bson.gz` & `users.metadata.json.gz`
- `books.bson.gz` & `books.metadata.json.gz`
- `borrowrequests.bson.gz` & `borrowrequests.metadata.json.gz`
- `circulationrecords.bson.gz` & `circulationrecords.metadata.json.gz`
- `notifications.bson.gz` & `notifications.metadata.json.gz`

---

## 3. Database Restoration via `mongorestore`

> [!WARNING]
> Restoring with `--drop` will replace existing collections with the contents of the backup. Ensure you have tested on staging first.

### Restoring to MongoDB Atlas:

```bash
mongorestore --uri="$MONGODB_URI" --gzip --dir="$BACKUP_DIR/bookloop"
```

### Restoring to Local Development Database:

```bash
mongorestore --uri="mongodb://localhost:27017/bookloop" --gzip --drop --dir="$BACKUP_DIR/bookloop"
```

---

## 4. Collection Verification After Restore

After performing a restore, verify document counts and index status by running the test suite:

```bash
cd server
node scripts/testPhase5.js
```
All 15 verification tests must pass, confirming that indexes, constraints, and relationships are intact.

