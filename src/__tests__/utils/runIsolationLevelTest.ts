import { IsolationLevels, Movie } from './../../utils/queries';
import { PoolConnection } from 'mysql2/promise';
import { getConnections } from './getConnections';
import { isolationLevelMovieKV } from './movies';

// Helper function to run tests with different isolation levels
export async function runIsolationLevelTest(isolationLevel: IsolationLevels, testFn: (mainConnection: PoolConnection, shardConnection: PoolConnection, isolationLevel: IsolationLevels, movie: Movie) => Promise<void>) {
  const { mainConnection, shardConnection } = await getConnections();

  expect(mainConnection).not.toBeNull();
  expect(shardConnection).not.toBeNull();

  if (mainConnection && shardConnection) {
    await mainConnection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    await shardConnection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);

    await testFn(mainConnection, shardConnection, isolationLevel, isolationLevelMovieKV[isolationLevel]);

    // Commit both transactions
    await mainConnection.commit();
    await shardConnection.commit();

    await mainConnection.release();
    await shardConnection.release();
  }
}