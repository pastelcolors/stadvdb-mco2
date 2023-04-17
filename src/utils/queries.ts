import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  after1980NodePool,
  before1980NodePool,
  centralNodePool,
} from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { NextFunction, Request, Response } from "express";

export type Movie = {
  id?: string;
  name: string;
  year: number;
  rank?: number | null;
  actor1_first_name?: string | null;
  actor1_last_name?: string | null;
  actor2_first_name?: string | null;
  actor2_last_name?: string | null;
  actor3_first_name?: string | null;
  actor3_last_name?: string | null;
};

type Log = {
  id: number;
  operation: string;
  value: string;
  node: string;
  active: string;
};

export type IsolationLevels =
  | "READ UNCOMMITTED"
  | "READ COMMITTED"
  | "REPEATABLE READ"
  | "SERIALIZABLE";

export function getShard(movie: Movie): [Pool, Pool] {
  if (movie.year < 1980) {
    return [centralNodePool, before1980NodePool];
  } else {
    return [centralNodePool, after1980NodePool];
  }
}

const CONNECTION_TIMEOUT = 10000;

export async function getConnection(
  pool: Pool,
  name: string,
  timeout: number = CONNECTION_TIMEOUT,
  maxRetries: number = 1,
  retryInterval: number = 1000
): Promise<PoolConnection | null | undefined> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connectionPromise = pool.getConnection();
      const connection = await Promise.race([
        connectionPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), timeout)
        ),
      ]);
      return connection as PoolConnection;
    } catch (e) {
      console.error(`Failed to connect to ${name} (attempt ${i + 1}):`, e);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      } else {
        return null;
      }
    }
  }
}

export const aggregateRanks = async (agg: string) => {
  const centralConnection = await getConnection(
    centralNodePool,
    "centralNodePool"
  );

  let query;
  switch (agg) {
    case "avg":
      query =
        "SELECT `year`, AVG(`rank`) AS 'rank' FROM movies WHERE `rank` is not null GROUP BY `year` ORDER BY `year` DESC;";
      break;
    case "min":
      query =
        "SELECT `year`, MIN(`rank`) AS 'rank' FROM movies WHERE `rank` is not null GROUP BY `year` ORDER BY `year` DESC;";
      break;
    case "max":
      query =
        "SELECT `year`, MAX(`rank`) AS 'rank' FROM movies WHERE `rank` is not null GROUP BY `year` ORDER BY `year` DESC;";
      break;
    case "count":
    default:
      query =
        "SELECT `year`, COUNT(*) AS num_movies FROM movies GROUP BY `year` ORDER BY `year` DESC;";
      break;
  }

  if (centralConnection) {
    try {
      const centralResult = await centralConnection.query(query);
      if (centralResult.length > 0) {
        return centralResult[0];
      }
    } catch (e) {
      console.error("Failed to query centralNodePool:", e);
    } finally {
      centralConnection.release();
    }
  }

  // Fallback to slave nodes if centralConnection failed
  const before1980Connection = await getConnection(
    before1980NodePool,
    "before1980NodePool"
  );
  const after1980Connection = await getConnection(
    after1980NodePool,
    "after1980NodePool"
  );

  try {
    const [before1980Result] = before1980Connection
      ? await before1980Connection.query(query, [])
      : [null];

    const [after1980Result] = after1980Connection
      ? await after1980Connection.query(query, [])
      : [null];

    const combinedResult = [
      ...((before1980Result as Movie[]) ?? []),
      ...((after1980Result as Movie[]) ?? []),
    ]
      .sort((a, b) => b.year - a.year)
      .slice(0, 10);
    return combinedResult;
  } catch (e) {
    console.error("Failed to query slave nodes:", e);
  } finally {
    if (before1980Connection) before1980Connection.release();
    if (after1980Connection) after1980Connection.release();
  }

  return []; // Return an empty array if all connections failed
};

async function recover(
  log: Log,
  node: PoolConnection,
  recoveredFrom: PoolConnection
) {
  const movie = JSON.parse(log.value);
  switch (log.operation) {
    case "INSERT":
      console.log(`Recovering INSERT operation from ${log.node}...`);
      console.log(
        `Inserting movie to ${log.node}: ${movie.name} (${movie.year})`
      );
      await node.query("INSERT INTO movies SET ?", movie);
      break;
    case "UPDATE":
      console.log(`Recovering UPDATE operation from ${log.node}...`);
      console.log(
        `Updating movie in ${log.node}: ${movie.name} (${movie.year})`
      );
      await node.query("UPDATE movies SET ? WHERE id = ?", [movie, movie.id]);
      break;
    case "DELETE":
      console.log(`Recovering DELETE operation from ${log.node}...`);
      console.log(
        `Deleting movie in ${log.node}: ${movie.name} (${movie.year})`
      );
      await node.query("DELETE FROM movies WHERE id = ?", [movie.id]);
      break;
  }
  await recoveredFrom.query("UPDATE logs SET active = 0 WHERE id = ?", [
    log.id,
  ]);
}

export const recoverFromLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const centralConnection = await getConnection(
    centralNodePool,
    "centralNodePool"
  );
  const before1980Connection = await getConnection(
    before1980NodePool,
    "before1980NodePool"
  );
  const after1980Connection = await getConnection(
    after1980NodePool,
    "after1980NodePool"
  );

  try {
    if (centralConnection) {
      const [logs] = await centralConnection.query(
        "SELECT * FROM logs WHERE active = 1"
      );
      if ((logs as Log[]).length > 0) {
        console.log("Executing recovery from logs...");
        for (let log of logs as Log[]) {
          const node =
            log.node === "before1980" && before1980Connection
              ? before1980Connection
              : log.node === "after1980" && after1980Connection
              ? after1980Connection
              : null;

          if (node) {
            recover(log, node, centralConnection);
          } else {
            console.log(`Recovery failed. Node ${log.node} is not available.`);
          }
        }
      }
    }
    if (before1980Connection) {
      const [logs] = await before1980Connection.query(
        "SELECT * FROM logs WHERE active = 1"
      );
      if ((logs as Log[]).length > 0) {
        console.log("Executing recovery from logs...");
        for (let log of logs as Log[]) {
          const node =
            log.node === "central" && centralConnection
              ? centralConnection
              : null;

          if (node) {
            recover(log, node, before1980Connection);
          } else {
            console.log(`Recovery failed. Node ${log.node} is not available.`);
          }
        }
      }
    }

    if (after1980Connection) {
      const [logs] = await after1980Connection.query(
        "SELECT * FROM logs WHERE active = 1"
      );
      if ((logs as Log[]).length > 0) {
        console.log("Executing recovery from logs...");
        for (let log of logs as Log[]) {
          const node =
            log.node === "central" && centralConnection
              ? centralConnection
              : null;

          if (node) {
            recover(log, node, after1980Connection);
          } else {
            console.log(`Recovery failed. Node ${log.node} is not available.`);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to recover from logs:", e);
  } finally {
    if (centralConnection) {
      // await centralConnection.query("DELETE FROM logs");
      await centralConnection.commit();
      centralConnection.release();
    }
    if (before1980Connection) {
      await before1980Connection.commit();
      before1980Connection.release();
    }
    if (after1980Connection) {
      await after1980Connection.commit();
      after1980Connection.release();
    }
    next();
  }
};

export const createMovie = async (
  movie: Movie,
  isolationLevel: IsolationLevels
) => {
  const [mainPool, shardPool] = getShard(movie);
  const mainConnection = await getConnection(mainPool, "mainPool");
  const shardConnection = await getConnection(shardPool, "shardPool");
  const id = uuidv4();
  const logXid = `log-${id}`;

  try {
    if (!mainConnection && !shardConnection) {
      throw new Error("No connection available");
    }

    if (mainConnection) {
      await mainConnection.query(
        `SET TRANSACTION ISOLATION LEVEL ${isolationLevel};`
      );
      await mainConnection.query("XA START ?;", id);
      await mainConnection.query("INSERT INTO movies SET ?", { id, ...movie });
      await mainConnection.query("XA END ?;", id);
      await mainConnection.query("XA PREPARE ?;", id);
      await mainConnection.query("XA COMMIT ?;", id);
    } else if (!mainConnection && shardConnection) {
      // If the main pool is not available, we log the operation in the central node to recover it later
      const log = {
        operation: "INSERT",
        node: "central",
        value: JSON.stringify({ id, ...movie }),
      };
      await shardConnection.query("XA START ?;", logXid);
      await shardConnection.query("INSERT INTO logs SET ?", log);
      await shardConnection.query("XA END ?;", logXid);
      await shardConnection.query("XA PREPARE ?;", logXid);
      await shardConnection.query("XA COMMIT ?;", logXid);
    }

    if (shardConnection) {
      await shardConnection.query(
        `SET TRANSACTION ISOLATION LEVEL ${isolationLevel};`
      );
      await shardConnection.query("XA START ?;", id);
      await shardConnection.query("INSERT INTO movies SET ?", { id, ...movie });
      await shardConnection.query("XA END ?;", id);
      await shardConnection.query("XA PREPARE ?;", id);
      await shardConnection.query("XA COMMIT ?;", id);
    } else if (!shardConnection && mainConnection) {
      // If the shard pool is not available, we log the operation in the central node to recover it later
      const log = {
        operation: "INSERT",
        node: movie.year >= 1980 ? "after1980" : "before1980",
        value: JSON.stringify({ id, ...movie }),
      };
      await mainConnection.query("XA START ?;", logXid);
      await mainConnection.query("INSERT INTO logs SET ?", log);
      await mainConnection.query("XA END ?;", logXid);
      await mainConnection.query("XA PREPARE ?;", logXid);
      await mainConnection.query("XA COMMIT ?;", logXid);
    }

    return { id, ...movie };
  } catch (error) {
    if (mainConnection) await mainConnection.query("XA ROLLBACK ?;", id);
    if (shardConnection) await shardConnection.query("XA ROLLBACK ?;", id);
    throw error;
  } finally {
    if (mainConnection) mainConnection.release();
    if (shardConnection) shardConnection.release();
  }
};

export const getMovies = async () => {
  const centralConnection = await getConnection(
    centralNodePool,
    "centralNodePool"
  );

  if (centralConnection) {
    try {
      const [centralResult] = await centralConnection.query(
        "SELECT * FROM movies ORDER BY year DESC LIMIT 10"
      );
      return centralResult;
    } catch (e) {
      console.error("Failed to query centralNodePool:", e);
    } finally {
      centralConnection.release();
    }
  }

  // Fallback to slave nodes if centralConnection failed
  const before1980Connection = await getConnection(
    before1980NodePool,
    "before1980NodePool"
  );
  const after1980Connection = await getConnection(
    after1980NodePool,
    "after1980NodePool"
  );

  try {
    const [before1980Result] = before1980Connection
      ? await before1980Connection.query(
          "SELECT * FROM movies WHERE year < 1980 ORDER BY year DESC LIMIT 10"
        )
      : [null];

    const [after1980Result] = after1980Connection
      ? await after1980Connection.query(
          "SELECT * FROM movies WHERE year >= 1980 ORDER BY year DESC LIMIT 10"
        )
      : [null];

    // Combine and sort the results from both slave nodes
    const combinedResult = [
      ...((before1980Result as Movie[]) ?? []),
      ...((after1980Result as Movie[]) ?? []),
    ]
      .sort((a, b) => b.year - a.year)
      .slice(0, 10);
    return combinedResult;
  } catch (e) {
    console.error("Failed to query slave nodes:", e);
  } finally {
    if (before1980Connection) before1980Connection.release();
    if (after1980Connection) after1980Connection.release();
  }

  return []; // Return an empty array if all connections failed
};

export const getMovieById = async (id: string) => {
  const centralConnection = await getConnection(
    centralNodePool,
    "centralNodePool"
  );

  if (centralConnection) {
    try {
      const [centralResult] = await centralConnection.query(
        "SELECT * FROM movies WHERE id = ?",
        [id]
      );
      if ((centralResult as Movie[]).length > 0) {
        return centralResult;
      }
    } catch (e) {
      console.error("Failed to query centralNodePool:", e);
    } finally {
      centralConnection.release();
    }
  }

  // Fallback to slave nodes if centralConnection failed
  const before1980Connection = await getConnection(
    before1980NodePool,
    "before1980NodePool"
  );
  const after1980Connection = await getConnection(
    after1980NodePool,
    "after1980NodePool"
  );

  try {
    const [before1980Result] = before1980Connection
      ? await before1980Connection.query("SELECT * FROM movies WHERE id = ?", [
          id,
        ])
      : [null];

    const [after1980Result] = after1980Connection
      ? await after1980Connection.query("SELECT * FROM movies WHERE id = ?", [
          id,
        ])
      : [null];

    const results = [before1980Result, after1980Result];
    const movie = results.find(
      (result: any) => result && result.length > 0
    ) || [null];

    return movie;
  } catch (e) {
    console.error("Failed to query slave nodes:", e);
  } finally {
    if (before1980Connection) before1980Connection.release();
    if (after1980Connection) after1980Connection.release();
  }

  return null; // Return null if all connections failed
};

export const searchMovie = async (name: string) => {
  const centralConnection = await getConnection(
    centralNodePool,
    "centralNodePool"
  );

  if (centralConnection) {
    try {
      const centralResult = await centralConnection.query(
        "SELECT * FROM movies WHERE name LIKE CONCAT('%', ?, '%') ORDER BY year DESC LIMIT 10",
        [name]
      );
      if (centralResult.length > 0) {
        console.log(centralResult[0]);
        return centralResult[0];
      }
    } catch (e) {
      console.error("Failed to query centralNodePool:", e);
    } finally {
      centralConnection.release();
    }
  }

  // Fallback to slave nodes if centralConnection failed
  const before1980Connection = await getConnection(
    before1980NodePool,
    "before1980NodePool"
  );
  const after1980Connection = await getConnection(
    after1980NodePool,
    "after1980NodePool"
  );

  try {
    const [before1980Result] = before1980Connection
      ? await before1980Connection.query(
          "SELECT * FROM movies WHERE name LIKE CONCAT('%', ?, '%') ORDER BY year DESC LIMIT 10",
          [name]
        )
      : [null];

    const [after1980Result] = after1980Connection
      ? await after1980Connection.query(
          "SELECT * FROM movies WHERE name LIKE CONCAT('%', ?, '%') ORDER BY year DESC LIMIT 10",
          [name]
        )
      : [null];

    const combinedResult = [
      ...((before1980Result as Movie[]) ?? []),
      ...((after1980Result as Movie[]) ?? []),
    ]
      .sort((a, b) => b.year - a.year)
      .slice(0, 10);
    return combinedResult;
  } catch (e) {
    console.error("Failed to query slave nodes:", e);
  } finally {
    if (before1980Connection) before1980Connection.release();
    if (after1980Connection) after1980Connection.release();
  }

  return []; // Return an empty array if all connections failed
};

export const updateMovie = async (
  movie: Movie,
  IsolationLevel: IsolationLevels
) => {
  const [mainPool, shardPool] = getShard(movie);
  const mainConnection = await getConnection(mainPool, "mainPool");
  const shardConnection = await getConnection(shardPool, "shardPool");
  const logXid = `log-${movie.id}`;

  try {
    if (!mainConnection && !shardConnection) {
      throw new Error("No connection available");
    }

    if (mainConnection) {
      await mainConnection.query(
        `SET TRANSACTION ISOLATION LEVEL ${IsolationLevel};`
      );
      await mainConnection.query("XA START ?;", movie.id);
      await mainConnection.query("UPDATE movies SET ? WHERE id = ?", [
        movie,
        movie.id,
      ]);
      await mainConnection.query("XA END ?;", movie.id);
      await mainConnection.query("XA PREPARE ?;", movie.id);
      await mainConnection.query("XA COMMIT ?;", movie.id);
    } else if (!mainConnection && shardConnection) {
      // If the main node is down, we need to log the operation to be recovered later
      const log = {
        operation: "UPDATE",
        node: "central",
        value: JSON.stringify(movie),
      };
      await shardConnection.query("XA START ?;", logXid);
      await shardConnection.query("INSERT INTO logs SET ?", log);
      await shardConnection.query("XA END ?;", logXid);
      await shardConnection.query("XA PREPARE ?;", logXid);
      await shardConnection.query("XA COMMIT ?;", logXid);
    }

    if (shardConnection) {
      await shardConnection.query(
        `SET TRANSACTION ISOLATION LEVEL ${IsolationLevel};`
      );
      await shardConnection.query("XA START ?;", movie.id);
      await shardConnection.query("UPDATE movies SET ? WHERE id = ?", [
        movie,
        movie.id,
      ]);
      await shardConnection.query("XA END ?;", movie.id);
      await shardConnection.query("XA PREPARE ?;", movie.id);
      await shardConnection.query("XA COMMIT ?;", movie.id);
      await shardConnection.commit();
    } else if (!shardConnection && mainConnection) {
      // If the shard node is down, we need to log the operation to be recovered later
      const log = {
        operation: "UPDATE",
        node: movie.year >= 1980 ? "after1980" : "before1980",
        value: JSON.stringify(movie),
      };

      await mainConnection.query("XA START ?;", logXid);
      await mainConnection.query("INSERT INTO logs SET ?", log);
      await mainConnection.query("XA END ?;", logXid);
      await mainConnection.query("XA PREPARE ?;", logXid);
      await mainConnection.query("XA COMMIT ?;", logXid);
    }
    return movie;
  } catch (error) {
    if (mainConnection) await mainConnection.query("XA ROLLBACK ?;", movie.id);
    if (shardConnection)
      await shardConnection.query("XA ROLLBACK ?;", movie.id);

    throw error;
  } finally {
    if (mainConnection) mainConnection.release();
    if (shardConnection) shardConnection.release();
  }
};

export const deleteMovie = async (
  id: string,
  isolationLevel: IsolationLevels
) => {
  const centralConnection = await centralNodePool.getConnection();
  const before1980Connection = await before1980NodePool.getConnection();
  const after1980Connection = await after1980NodePool.getConnection();

  try {
    await centralConnection.beginTransaction();
    await before1980Connection.beginTransaction();
    await after1980Connection.beginTransaction();

    // Set isolation level
    await centralConnection.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel};`
    );
    await before1980Connection.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel};`
    );
    await after1980Connection.query(
      `SET TRANSACTION ISOLATION LEVEL ${isolationLevel};`
    );

    // Start phase
    await centralConnection.query("XA START ?;", id);
    await before1980Connection.query("XA START ?;", id);
    await after1980Connection.query("XA START ?;", id);

    // Delete the movie in all the nodes
    await centralConnection.query("DELETE FROM movies WHERE id = ?", [id]);
    await before1980Connection.query("DELETE FROM movies WHERE id = ?", [id]);
    await after1980Connection.query("DELETE FROM movies WHERE id = ?", [id]);

    // End phase
    await centralConnection.query("XA END ?;", id);
    await before1980Connection.query("XA END ?;", id);
    await after1980Connection.query("XA END ?;", id);

    // Prepare phase
    await centralConnection.query("XA PREPARE ?;", id);
    await before1980Connection.query("XA PREPARE ?;", id);
    await after1980Connection.query("XA PREPARE ?;", id);

    // Commit phase
    await centralConnection.query("XA COMMIT ?;", id);
    await before1980Connection.query("XA COMMIT ?;", id);
    await after1980Connection.query("XA COMMIT ?;", id);

    await centralConnection.commit();
    await before1980Connection.commit();
    await after1980Connection.commit();

    return true;
  } catch (error) {
    await centralConnection.rollback();
    await before1980Connection.rollback();
    await after1980Connection.rollback();
    throw error;
  } finally {
    centralConnection.release();
    before1980Connection.release();
    after1980Connection.release();
  }
};
