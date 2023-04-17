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
  const updatePromise = new Promise<void>(async (resolve) => {
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
    await Promise.all([mainConnection.commit(), shardConnection.commit()]);
    resolve();
  });

  const readPromise = new Promise<void>(async (resolve) => {
    // Add a random delay
    setTimeout(async () => {
      const [mainReadResult]: [any, any] = await mainConnection2.query(
        "SELECT * FROM movies WHERE id = ?",
        [movie.id]
      );
      await mainConnection2.commit();

      if (
        isolationLevel === "READ UNCOMMITTED" &&
        mainReadResult[0].name === movie.name + " - Updated Main"
      ) {
        expect(mainReadResult[0].name).toBe(movie.name + " - Updated Main");
      } else if (
        isolationLevel !== "READ UNCOMMITTED" &&
        mainReadResult[0].name !== movie.name + " - Updated Main"
      ) {
        expect(mainReadResult[0].name).not.toBe(movie.name + " - Updated Main");
      }
      resolve();
    }, Math.floor(Math.random() * 100));
  });

  await Promise.all([updatePromise, readPromise]);
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
