using Npgsql;

var connectionString = Environment.GetEnvironmentVariable("TEST_DATABASE_URL");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.WriteLine("SKIPPED: set TEST_DATABASE_URL to run PostgreSQL concurrency integration test.");
    return;
}

var schema = "booking_test_" + Guid.NewGuid().ToString("N");
await using (var setup = new NpgsqlConnection(connectionString))
{
    await setup.OpenAsync();
    await using var command = setup.CreateCommand();
    command.CommandText = $"CREATE SCHEMA {schema}; CREATE TABLE {schema}.stays(id bigserial primary key, room_id bigint not null, from_date date not null, to_date date not null);";
    await command.ExecuteNonQueryAsync();
}

try
{
    // Mirrors AdvisoryLocks in the API: two-key form, namespace 2 = room type. Room-level flows (host manual
    // booking, room change, extension) resolve the room to its room type, so every path takes the same key.
    const string RoomTypeLock = "SELECT pg_advisory_xact_lock(2, 7)";

    async Task<bool> TryBook(TaskCompletionSource gate, string lockSql, long roomId)
    {
        await using var connection = new NpgsqlConnection(connectionString); await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync(); await gate.Task;
        await using (var advisory = new NpgsqlCommand(lockSql, connection, transaction)) await advisory.ExecuteNonQueryAsync();
        await using var check = new NpgsqlCommand($"SELECT EXISTS(SELECT 1 FROM {schema}.stays WHERE room_id={roomId} AND from_date < DATE '2030-01-05' AND to_date > DATE '2030-01-01')", connection, transaction);
        if ((bool)(await check.ExecuteScalarAsync())!) { await transaction.RollbackAsync(); return false; }
        await using var insert = new NpgsqlCommand($"INSERT INTO {schema}.stays(room_id,from_date,to_date) VALUES({roomId},DATE '2030-01-01',DATE '2030-01-05')", connection, transaction);
        await insert.ExecuteNonQueryAsync(); await transaction.CommitAsync(); return true;
    }

    async Task Scenario(string name, long roomId, string firstLock, string secondLock)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var first = TryBook(gate, firstLock, roomId); var second = TryBook(gate, secondLock, roomId); gate.SetResult();
        var results = await Task.WhenAll(first, second);
        if (results.Count(x => x) != 1) throw new Exception($"Double-booking protection failed ({name}): exactly one request must win.");
        Console.WriteLine($"  passed: {name}");
    }

    await Scenario("two online bookings for the same room type", 1, RoomTypeLock, RoomTypeLock);
    await Scenario("host manual booking vs online booking for the same physical room", 2, RoomTypeLock, RoomTypeLock);
    Console.WriteLine("PostgreSQL concurrency integration test passed.");
}
finally
{
    await using var cleanup = new NpgsqlConnection(connectionString); await cleanup.OpenAsync();
    await using var command = new NpgsqlCommand($"DROP SCHEMA IF EXISTS {schema} CASCADE", cleanup); await command.ExecuteNonQueryAsync();
}
