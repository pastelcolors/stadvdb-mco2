import { PoolConnection } from "mysql2/promise";
import { runIsolationLevelTest } from "./utils/runIsolationLevelTest";
import { Movie } from "../utils/queries";

async function testFetchMovie(
  mainConnection: PoolConnection,
  shardConnection: PoolConnection,
  mainConnection2: PoolConnection,
  isolationLevel: string,
  movie: Movie
): Promise<void> {
  // Read the same movie in both transactions
  const results = await Promise.all([
    mainConnection.query("SELECT * FROM movies WHERE id = ?", movie.id),
    shardConnection.query("SELECT * FROM movies WHERE id = ?", movie.id),
  ]);

  // Expect both transactions to be successful and return the same movie
  expect(results[0][0]).toMatchObject(results[1][0]);

  return Promise.resolve();
}

describe("Case #1: Concurrent transactions in two or more nodes are reading the same data item", () => {
  test("Repeatable Read", async () => {
    await runIsolationLevelTest("REPEATABLE READ", testFetchMovie);
  });

  test("Read Uncommitted", async () => {
    await runIsolationLevelTest("READ UNCOMMITTED", testFetchMovie);
  });

  test("Read Committed", async () => {
    await runIsolationLevelTest("READ COMMITTED", testFetchMovie);
  });

  test("Serializable", async () => {
    await runIsolationLevelTest("SERIALIZABLE", testFetchMovie);
  });
});
