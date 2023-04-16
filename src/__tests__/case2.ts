import { PoolConnection } from "mysql2/promise";
import { Movie } from "../utils/queries";
import { runIsolationLevelTest } from "./utils/runIsolationLevelTest";

async function updateMovie(
  mainConnection: PoolConnection,
  shardConnection: PoolConnection,
  mainConnection2: PoolConnection,
  isolationLevel: string,
  movie: Movie
): Promise<void> {
  const updatePromise = new Promise<void>(async (resolve) => {
    await mainConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      movie.name,
      movie.id,
    ]);
    await mainConnection.commit();
    resolve();
  });

  const readPromise = new Promise<void>(async (resolve) => {
    // Add a random delay
    setTimeout(async () => {
      await mainConnection2
        .query("SELECT * FROM movies WHERE id = ?", [movie.id])
        .then(async ([shardReadResult]: any) => {
          console.log(shardReadResult[0]);
          await mainConnection2.commit();

          if (
            isolationLevel === "READ UNCOMMITTED" &&
            shardReadResult[0].name === movie.name + " - Updated"
          ) {
            expect(shardReadResult[0].name).toBe(movie.name + " - Updated");
          } else if (
            isolationLevel !== "READ UNCOMMITTED" &&
            shardReadResult[0].name !== movie.name + " - Updated"
          ) {
            expect(shardReadResult[0].name).not.toBe(movie.name + " - Updated");
          }
        });
      resolve();
    }, Math.floor(Math.random() * 100));
  });

  await Promise.all([updatePromise, readPromise]);
}

describe("Case #2: At least one transaction in the three nodes is writing (update / delete) and the other concurrent transactions are reading the same data item.", () => {
  test("Repeatable Read", async () => {
    await runIsolationLevelTest("REPEATABLE READ", updateMovie);
  });

  test("Read Uncommitted", async () => {
    await runIsolationLevelTest("READ UNCOMMITTED", updateMovie);
  });

  test("Read Committed", async () => {
    await runIsolationLevelTest("READ COMMITTED", updateMovie);
  });

  test("Serializable", async () => {
    await runIsolationLevelTest("SERIALIZABLE", updateMovie);
  });
});
