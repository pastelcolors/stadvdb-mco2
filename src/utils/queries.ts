import { Pool } from "mysql2/promise";
import { after1980NodePool, before1980NodePool, centralNodePool } from "../config/db";

type Movie = {
  id: string;
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

export const createMovie = async (movie: Movie) => {
  const [mainPool, shardPool] = getShard(movie);
  const mainConnection = await mainPool.getConnection();
  const shardConnection = await shardPool.getConnection();

  try {
    await mainConnection.beginTransaction();
    await shardConnection.beginTransaction();

    // Insert the movie in both the central node and the shard
    await mainConnection.query('INSERT INTO movies SET ?', movie);
    await shardConnection.query('INSERT INTO movies SET ?', movie);

    // Prepare phase
    await mainConnection.query('XA PREPARE ?;', movie.id);
    await shardConnection.query('XA PREPARE ?;', movie.id);

    // Commit phase
    await mainConnection.query('XA COMMIT ?;', movie.id);
    await shardConnection.query('XA COMMIT ?;', movie.id);

    await mainConnection.commit();
    await shardConnection.commit();

    return movie;
  } catch (error) {
    await mainConnection.rollback();
    await shardConnection.rollback();
    throw error;
  } finally {
    mainConnection.release();
    shardConnection.release();
  }
};

export const getMovie = async (id: string) => {
  const centralConnection = await centralNodePool.getConnection();
  const before1980Connection = await before1980NodePool.getConnection();
  const after1980Connection = await after1980NodePool.getConnection();

  try {
    const [centralResult] = await centralConnection.query('SELECT * FROM movies WHERE id = ?', [id]);
    const [node2Result] = await before1980Connection.query('SELECT * FROM movies WHERE id = ?', [id]);
    const [node3Result] = await after1980Connection.query('SELECT * FROM movies WHERE id = ?', [id]);

    return centralResult || node2Result || node3Result || null;
  } finally {
    centralConnection.release();
    before1980Connection.release();
    after1980Connection.release();
  }
}

export const updateMovie = async (movie: Movie) => {
  const [mainPool, shardPool] = getShard(movie);
  const mainConnection = await mainPool.getConnection();
  const shardConnection = await shardPool.getConnection();

  try {
    await mainConnection.beginTransaction();
    await shardConnection.beginTransaction();

    // Update the movie in both the central node and the shard
    await mainConnection.query('UPDATE movies SET ? WHERE id = ?', [movie, movie.id]);
    await shardConnection.query('UPDATE movies SET ? WHERE id = ?', [movie, movie.id]);

    // Prepare phase
    await mainConnection.query('XA PREPARE ?;', movie.id);
    await shardConnection.query('XA PREPARE ?;', movie.id);

    // Commit phase
    await mainConnection.query('XA COMMIT ?;', movie.id);
    await shardConnection.query('XA COMMIT ?;', movie.id);

    await mainConnection.commit();
    await shardConnection.commit();

    return movie;
  } catch (error) {
    await mainConnection.rollback();
    await shardConnection.rollback();
    throw error;
  } finally {
    mainConnection.release();
    shardConnection.release();
  }
}

export const deleteMovie = async (id: string) => {
  const centralConnection = await centralNodePool.getConnection();
  const before1980Connection = await before1980NodePool.getConnection();
  const after1980Connection = await after1980NodePool.getConnection();

  try {
    await centralConnection.beginTransaction();
    await before1980Connection.beginTransaction();
    await after1980Connection.beginTransaction();

    // Delete the movie in all the nodes
    await centralConnection.query('DELETE FROM movies WHERE id = ?', [id]);
    await before1980Connection.query('DELETE FROM movies WHERE id = ?', [id]);
    await after1980Connection.query('DELETE FROM movies WHERE id = ?', [id]);

    // Prepare phase
    await centralConnection.query('XA PREPARE ?;', id);
    await before1980Connection.query('XA PREPARE ?;', id);
    await after1980Connection.query('XA PREPARE ?;', id);

    // Commit phase
    await centralConnection.query('XA COMMIT ?;', id);
    await before1980Connection.query('XA COMMIT ?;', id);
    await after1980Connection.query('XA COMMIT ?;', id);

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
}
