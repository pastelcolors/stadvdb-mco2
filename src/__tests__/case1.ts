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

async function testFetchMovie(mainConnection: PoolConnection, shardConnection: PoolConnection, isolationLevel: string): Promise<void> {
  // Read the same movie in both transactions
  const MOVIE_ID =  sampleMovie.id;
  const results = await Promise.all([
    mainConnection.query('SELECT * FROM movies WHERE id = ?', MOVIE_ID),
    shardConnection.query('SELECT * FROM movies WHERE id = ?', MOVIE_ID),
  ]);

  // Expect both transactions to be successful and return the same movie
  if (isolationLevel === "READ UNCOMMITTED") {
    expect(results[0]).toMatchObject(results[1]);
  } else {
    expect(results[0]).not.toMatchObject(results[1]);
  }

  return Promise.resolve();
}

describe('Case #1: Concurrent transactions in two or more nodes are reading the same data item', () => {
  test('Repeatable Read', async () => {
    await runIsolationLevelTest('REPEATABLE READ', testFetchMovie);
  });

  test('Read Uncommitted', async () => {
    await runIsolationLevelTest('READ UNCOMMITTED', testFetchMovie);
  });
  
  test('Read Committed', async () => {
    await runIsolationLevelTest('READ COMMITTED', testFetchMovie);
  });

  test('Serializable', async () => {
    await runIsolationLevelTest('SERIALIZABLE', testFetchMovie);
  });
});
