import { PoolConnection } from "mysql2/promise";
import { Movie } from "../utils/queries";
import { runIsolationLevelTest } from "./utils/runIsolationLevelTest";

async function updateAndReadMovie(
  mainConnection: PoolConnection,
  shardConnection: PoolConnection,
  mainConnection2: PoolConnection,
  isolationLevel: string,
  movie: Movie
): Promise<void> {
  // Update the movie in both the main node and shard node
  await Promise.all([
    mainConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      movie.name + " - Updated Main",
      movie.id,
    ]),
    shardConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      movie.name + " - Updated Shard",
      movie.id,
    ]),
  ]);

  // Read the movie from the main node after updating both nodes
  const [mainReadResult] = await mainConnection.query(
    "SELECT * FROM movies WHERE id = ?",
    [movie.id]
  );

  // Compare the movie names in the main node read result and the updated sample movie
  if (isolationLevel === "READ UNCOMMITTED") {
    expect((mainReadResult as any).name).toBe(movie.name + " - Updated Main");
  } else {
    expect((mainReadResult as any).name).not.toBe(
      movie.name + " - Updated Main"
    );
  }

  return Promise.resolve();
}

describe("Case #3: Concurrent transactions in two or more nodes are writing (update / delete) the same data item.", () => {
  test("Repeatable Read", async () => {
    await runIsolationLevelTest("REPEATABLE READ", updateAndReadMovie);
  });

  test("Read Uncommitted", async () => {
    await runIsolationLevelTest("READ UNCOMMITTED", updateAndReadMovie);
  });

  test("Read Committed", async () => {
    await runIsolationLevelTest("READ COMMITTED", updateAndReadMovie);
  });

  test("Serializable", async () => {
    await runIsolationLevelTest("SERIALIZABLE", updateAndReadMovie);
  });
});
