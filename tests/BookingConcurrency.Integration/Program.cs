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
    var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    async Task<bool> TryBook()
    {
        await using var connection = new NpgsqlConnection(connectionString); await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync(); await gate.Task;
        await using (var advisory = new NpgsqlCommand("SELECT pg_advisory_xact_lock(424242)", connection, transaction)) await advisory.ExecuteNonQueryAsync();
        await using var check = new NpgsqlCommand($"SELECT EXISTS(SELECT 1 FROM {schema}.stays WHERE room_id=1 AND from_date < DATE '2030-01-05' AND to_date > DATE '2030-01-01')", connection, transaction);
        if ((bool)(await check.ExecuteScalarAsync())!) { await transaction.RollbackAsync(); return false; }
        await using var insert = new NpgsqlCommand($"INSERT INTO {schema}.stays(room_id,from_date,to_date) VALUES(1,DATE '2030-01-01',DATE '2030-01-05')", connection, transaction);
        await insert.ExecuteNonQueryAsync(); await transaction.CommitAsync(); return true;
    }

    var first = TryBook(); var second = TryBook(); gate.SetResult();
    var results = await Task.WhenAll(first, second);
    if (results.Count(x => x) != 1) throw new Exception("Double-booking protection failed: exactly one request must win.");
    Console.WriteLine("PostgreSQL concurrency integration test passed.");
}
finally
{
    await using var cleanup = new NpgsqlConnection(connectionString); await cleanup.OpenAsync();
    await using var command = new NpgsqlCommand($"DROP SCHEMA IF EXISTS {schema} CASCADE", cleanup); await command.ExecuteNonQueryAsync();
}
