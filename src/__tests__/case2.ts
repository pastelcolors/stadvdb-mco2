import { PoolConnection } from 'mysql2/promise';
import { Movie } from '../utils/queries';
import { runIsolationLevelTest } from './utils/runIsolationLevelTest';

async function updateMovie(mainConnection: PoolConnection, shardConnection: PoolConnection, isolationLevel: string, movie: Movie): Promise<void> {
  // Execute the update and read operations concurrently
  await Promise.all([
    mainConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      movie.name + " - Updated",
      movie.id,
    ]),
    shardConnection.query("SELECT * FROM movies WHERE id = ?", [
      movie.id,
    ]).then(([shardReadResult]) => {
      // Compare the movie names in the shard node read result and the updated sample movie
      if (isolationLevel === "READ UNCOMMITTED") {
        expect((shardReadResult as any).name).toBe(movie.name + " - Updated");
      } else {
        expect((shardReadResult as any).name).not.toBe(movie.name + " - Updated");
      }
    }),
  ]);

  return Promise.resolve();
}

describe('Case #2: At least one transaction in the three nodes is writing (update / delete) and the other concurrent transactions are reading the same data item.', () => {
  test('Repeatable Read', async () => {
    await runIsolationLevelTest('REPEATABLE READ', updateMovie);
  });

  test('Read Uncommitted', async () => {
    await runIsolationLevelTest('READ UNCOMMITTED', updateMovie);
  });
  
  test('Read Committed', async () => {
    await runIsolationLevelTest('READ COMMITTED', updateMovie);
  });

  test('Serializable', async () => {
    await runIsolationLevelTest('SERIALIZABLE', updateMovie);
  });
});
