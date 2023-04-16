import { PoolConnection } from 'mysql2/promise';
import { Movie } from '../utils/queries';
import { runIsolationLevelTest } from './utils/runIsolationLevelTest';

const sampleMovie: Movie = {
  "id": "37b348bd-d298-11ed-a5cb-00155d052813",
  "name": "$30,000",
  "year": 1920,
  "rank": null,
  "actor1_first_name": "Joseph J.",
  "actor1_last_name": "Dowling",
  "actor2_first_name": "Frank",
  "actor2_last_name": "Geraghty",
  "actor3_first_name": "Tom",
  "actor3_last_name": "Guise"
}

async function updateAndReadMovie(mainConnection: PoolConnection, shardConnection: PoolConnection, isolationLevel: string): Promise<void> {
  // Update the movie in both the main node and shard node
  await Promise.all([
    mainConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      sampleMovie.name + " - Updated Main",
      sampleMovie.id,
    ]),
    shardConnection.query("UPDATE movies SET name = ? WHERE id = ?", [
      sampleMovie.name + " - Updated Shard",
      sampleMovie.id,
    ]),
  ]);

  // Read the movie from the main node after updating both nodes
  const [mainReadResult] = await mainConnection.query(
    "SELECT * FROM movies WHERE id = ?",
    [sampleMovie.id]
  );

  // Compare the movie names in the main node read result and the updated sample movie
  if (isolationLevel === "READ UNCOMMITTED") {
    expect(mainReadResult[0].name).toBe(sampleMovie.name + " - Updated Main");
  } else {
    expect(mainReadResult[0].name).not.toBe(sampleMovie.name + " - Updated Main");
  }

  return Promise.resolve();
}

describe('Case #3: Concurrent transactions in two or more nodes are writing (update / delete) the same data item.', () => {
  test('Repeatable Read', async () => {
    runIsolationLevelTest('REPEATABLE READ', updateAndReadMovie);
  });

  test('Read Uncommitted', async () => {
    runIsolationLevelTest('READ UNCOMMITTED', updateAndReadMovie);
  });
  
  test('Read Committed', async () => {
    runIsolationLevelTest('READ COMMITTED', updateAndReadMovie);
  });

  test('Serializable', async () => {
    runIsolationLevelTest('SERIALIZABLE', updateAndReadMovie);
  });
});
