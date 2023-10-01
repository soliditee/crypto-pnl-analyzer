# PnL Analyzer

## How to run DB migration
When creating a new DB, make sure character set is utf8mb4
```
ALTER DATABASE crypto_pnl CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
```

In case we need to convert an existing table:
```
ALTER TABLE tokens CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

On localhost, makesure the IP for DB Host is up to date in `.env`

Migration commands:
```
yarn sequelize-cli db:migrate
```