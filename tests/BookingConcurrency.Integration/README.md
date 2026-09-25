# PostgreSQL concurrency check

Set `TEST_DATABASE_URL` to a disposable PostgreSQL database and run:

```powershell
dotnet run --project tests/BookingConcurrency.Integration/BookingConcurrency.Integration.csproj
```

The test starts two simultaneous booking transactions for one room and verifies that the advisory lock allows exactly one request to succeed.
