import { IsolationLevels, Movie } from "./../../utils/queries";
import { PoolConnection } from "mysql2/promise";
import { getConnections } from "./getConnections";
import { isolationLevelMovieKV } from "./movies";

// Helper function to run tests with different isolation levels
export async function runIsolationLevelTest(
  isolationLevel: IsolationLevels,
  testFn: (
    mainConnection: PoolConnection,
    shardConnection: PoolConnection,
    mainConnection2: PoolConnection,
    isolationLevel: IsolationLevels,
    movie: Movie
  ) => Promise<void>
) {
  const { mainConnection, shardConnection, mainConnection2 } =
    await getConnections();

  expect(mainConnection).not.toBeNull();
  expect(shardConnection).not.toBeNull();
  expect(mainConnection2).not.toBeNull();

  if (mainConnection && shardConnection && mainConnection2) {
    await mainConnection.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
    );
    await shardConnection.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
    );
    await mainConnection2.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
    );

    await testFn(
      mainConnection,
      shardConnection,
      mainConnection2,
      isolationLevel,
      isolationLevelMovieKV[isolationLevel]
    );

    // Commit both transactions
    await mainConnection.commit();
    await shardConnection.commit();

    await mainConnection.release();
    await shardConnection.release();
    await mainConnection2.release();
  }
}
