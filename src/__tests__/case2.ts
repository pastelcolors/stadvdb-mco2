import { PoolConnection } from 'mysql2/promise';
import { Movie } from '../utils/queries';
import { runIsolationLevelTest } from './utils/runIsolationLevelTest';

const sampleMovie: Movie = {
  "id": "391b7277-d298-11ed-a5cb-00155d052813",
  "name": "Good Shepherd, The",
  "year": 2005,
  "rank": null,
  "actor1_first_name": "Robert",
  "actor1_last_name": "De Niro",
  "actor2_first_name": "Leonardo",
  "actor2_last_name": "DiCaprio",
  "actor3_first_name": null,
  "actor3_last_name": null
}

async function updateMovie(mainConnection: PoolConnection, shardConnection: PoolConnection, isolationLevel: string) {
  // Execute the update and read operations concurrently
  await Promise.all([
    mainConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      sampleMovie.name + " - Updated",
      sampleMovie.id,
    ]),
    shardConnection.query("SELECT * FROM movies WHERE id = ?", [
      sampleMovie.id,
    ]).then(([shardReadResult]) => {
      // Compare the movie names in the shard node read result and the updated sample movie
      if (isolationLevel === "READ UNCOMMITTED") {
        expect(shardReadResult[0].name).toBe(sampleMovie.name + " - Updated");
      } else {
        expect(shardReadResult[0].name).not.toBe(sampleMovie.name + " - Updated");
      }
    }),
  ]);

  return Promise.resolve();
}

describe('Case #2: At least one transaction in the three nodes is writing (update / delete) and the other concurrent transactions are reading the same data item.', () => {
  test('Repeatable Read', async () => {
    runIsolationLevelTest('REPEATABLE READ', updateMovie);
  });

  test('Read Uncommitted', async () => {
    runIsolationLevelTest('READ UNCOMMITTED', updateMovie);
  });
  
  test('Read Committed', async () => {
    runIsolationLevelTest('READ COMMITTED', updateMovie);
  });

  test('Serializable', async () => {
    runIsolationLevelTest('SERIALIZABLE', updateMovie);
  });
});
