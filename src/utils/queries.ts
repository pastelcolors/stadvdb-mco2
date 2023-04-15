import { Pool } from "mysql2/promise";
import {
  after1980NodePool,
  before1980NodePool,
  centralNodePool,
} from "../config/db";
import { v4 as uuidv4 } from "uuid";

type Movie = {
  id?: string;
  name: string;
  year: number;
  rank: number;
  actor1_first_name: string;
  actor1_last_name: string;
  actor2_first_name: string;
  actor2_last_name: string;
  actor3_first_name: string;
  actor3_last_name: string;
};

function getShard(movie: Movie): [Pool, Pool] {
  if (movie.year < 1980) {
    return [centralNodePool, before1980NodePool];
  } else {
    return [centralNodePool, after1980NodePool];
  }
}

async function getConnection(pool: Pool, name: string) {
  try {
    return await pool.getConnection();
  } catch (e) {
    console.error(`Failed to connect to ${name}:`, e);
    return null;
  }
}

export const createMovie = async (movie: Movie) => {
  const [mainPool, shardPool] = getShard(movie);
  const mainConnection = await getConnection(mainPool, "mainPool");
  const shardConnection = await getConnection(shardPool, "shardPool");
  const id = uuidv4();

  try {
    if (mainConnection) {
      await mainConnection.query("XA START ?;", id);
      await mainConnection.query("INSERT INTO movies SET ?", { id, ...movie });
      await mainConnection.query("XA END ?;", id);
      await mainConnection.query("XA PREPARE ?;", id);
      await mainConnection.query("XA COMMIT ?;", id);
      await mainConnection.commit();
    }

    if (shardConnection) {
      await shardConnection.query("XA START ?;", id);
      await shardConnection.query("INSERT INTO movies SET ?", { id, ...movie });
      await shardConnection.query("XA END ?;", id);
      await shardConnection.query("XA PREPARE ?;", id);
      await shardConnection.query("XA COMMIT ?;", id);
      await shardConnection.commit();
    }

    return { id, ...movie };
  } catch (error) {
    if (mainConnection) await mainConnection.rollback();
    if (shardConnection) await shardConnection.rollback();
    throw error;
  } finally {
    if (mainConnection) mainConnection.release();
    if (shardConnection) shardConnection.release();
  }
};

export const getMovie = async (id: string) => {
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
    const centralResult = centralConnection
      ? await centralConnection.query("SELECT * FROM movies WHERE id = ?", [id])
      : [null];
    const node2Result = before1980Connection
      ? await before1980Connection.query("SELECT * FROM movies WHERE id = ?", [
          id,
        ])
      : [null];
    const node3Result = after1980Connection
      ? await after1980Connection.query("SELECT * FROM movies WHERE id = ?", [
          id,
        ])
      : [null];

    const results = [centralResult, node2Result, node3Result];
    const [movie] = results.find(
      (result) => result[0] && (result[0] as []).length > 0
    ) || [null];

    return movie;
  } finally {
    if (centralConnection) centralConnection.release();
    if (before1980Connection) before1980Connection.release();
    if (after1980Connection) after1980Connection.release();
  }
};

export const updateMovie = async (movie: Movie) => {
  const [mainPool, shardPool] = getShard(movie);
  const mainConnection = await getConnection(mainPool, "mainPool");
  const shardConnection = await getConnection(shardPool, "shardPool");

  try {
    if (mainConnection) {
      await mainConnection.query("XA START ?;", movie.id);
      await mainConnection.query("UPDATE movies SET ? WHERE id = ?", [
        movie,
        movie.id,
      ]);
      await mainConnection.query("XA END ?;", movie.id);
      await mainConnection.query("XA PREPARE ?;", movie.id);
      await mainConnection.query("XA COMMIT ?;", movie.id);
      await mainConnection.commit();
    }

    if (shardConnection) {
      await shardConnection.query("XA START ?;", movie.id);
      await shardConnection.query("UPDATE movies SET ? WHERE id = ?", [
        movie,
        movie.id,
      ]);
      await shardConnection.query("XA END ?;", movie.id);
      await shardConnection.query("XA PREPARE ?;", movie.id);
      await shardConnection.query("XA COMMIT ?;", movie.id);
      await shardConnection.commit();
    }

    return movie;
  } catch (error) {
    if (mainConnection) await mainConnection.rollback();

    if (shardConnection) await shardConnection.rollback();

    throw error;
  } finally {
    if (mainConnection) mainConnection.release();

    if (shardConnection) shardConnection.release();
  }
};

export const deleteMovie = async (id: string) => {
  const centralConnection = await centralNodePool.getConnection();
  const before1980Connection = await before1980NodePool.getConnection();
  const after1980Connection = await after1980NodePool.getConnection();

  try {
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
