import { v4 as uuidv4 } from 'uuid';
import { Pool, PoolConnection } from 'mysql2/promise';
import { getShard, getConnection, Movie } from '../utils/queries';
import { before1980NodePool, centralNodePool } from '../config/db';


function createTestMovie(): Movie {
  return {
    id: uuidv4(),
    name: 'Test Movie',
    year: 1979,
    rank: 5,
    actor1_first_name: 'John',
    actor1_last_name: 'Doe',
    actor2_first_name: 'Jane',
    actor2_last_name: 'Doe',
    actor3_first_name: 'Alice',
    actor3_last_name: 'Smith',
  };
}

describe('createMovie', () => {
  test('Case #1: Concurrent transactions in two or more nodes are creating the same movie', async () => {
    // Define sample movies
    const movie1 = createTestMovie();
    const movie2 = createTestMovie();

    // Establish a connection to two different nodes
    const mainConnection = await getConnection(centralNodePool, "mainPool");
    const shardConnection = await getConnection(before1980NodePool, "shardPool");

    expect(mainConnection).not.toBeNull();
    expect(shardConnection).not.toBeNull();

    // Create a transaction in the main node
    if (mainConnection && shardConnection) {
      await mainConnection.beginTransaction();
      await shardConnection.beginTransaction();
      // Insert the same movie in both transactions
      const results = await Promise.all([
        mainConnection.query('INSERT INTO movies SET ?', movie1),
        shardConnection.query('INSERT INTO movies SET ?', movie2),
      ]);

      // Expect both transactions to be successful and return the created movies
      expect(results[0]).toMatchObject(movie1);
      expect(results[1]).toMatchObject(movie2);

      // Commit both transactions
      await mainConnection.commit();
      await shardConnection.commit();

      // Expect both movies to be created in the database
      const mainMovie = await mainConnection.query('SELECT * FROM movies WHERE id = ?', movie1.id);
      const shardMovie = await shardConnection.query('SELECT * FROM movies WHERE id = ?', movie2.id);

      expect(mainMovie).toMatchObject(movie1);
      expect(shardMovie).toMatchObject(movie2);

      // Close the connections
      await mainConnection.release();
      await shardConnection.release();
    }
  });
});
