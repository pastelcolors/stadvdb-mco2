import { Router } from "express";
import { createConnection } from "mysql2/promise";
import { NODE_LIST } from "../config/db";

const router = Router();

/*
CREATE TABLE `movies` (
  `id` varchar(36) CHARACTER SET utf8mb3 NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  `year` int DEFAULT NULL,
  `rank` float DEFAULT NULL,
  `actor1_first_name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  `actor1_last_name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  `actor2_first_name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  `actor2_last_name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  `actor3_first_name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  `actor3_last_name` varchar(100) CHARACTER SET utf8mb3 DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
*/

export type ISOLATION_LEVELS = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
// Default Movie
// Name: $1,000 Reward
// Year: 1913
// Rank: NULL
// Actor 1: Charles (II) Bennett
// Actor 2: Morris McGee
// Actor 3: Crane Wilbur
const DEFAULT_MOVIE_ID = '37b34019-d298-11ed-a5cb-00155d052813'; 

// Case #1: Concurrent transactions in two or more nodes are reading the same data item.
router.post('/case1', async (req, res) => {
  const centralNode = await createConnection(NODE_LIST.centralNode);
  const before1980Node = await createConnection(NODE_LIST.before1980Node);
  const after1980Node = await createConnection(NODE_LIST.after1980Node);

  // Get isolation level set via query string
  const ISOLATION_LEVEL_SELECTED = req.query.isolationLevel as ISOLATION_LEVELS ?? 'READ UNCOMMITTED';
  const MOVIE_ID = req.query.movieId ?? DEFAULT_MOVIE_ID;

  try {
    // Set isolation level for each node
    await centralNode.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await before1980Node.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await after1980Node.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);

    // Begin transactions for each node
    await centralNode.beginTransaction();
    await before1980Node.beginTransaction();
    await after1980Node.beginTransaction();

    // Implement the logic for Case #1 here
    // Select movies from central node, where id = MOVIE_ID
    const [centralMovieSelected] = await centralNode.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);
    console.log('Central node: ', centralMovieSelected);

    // Select movies from node 2, where id = MOVIE_ID
    const [node2MovieSelected] = await before1980Node.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);
    console.log('Node 2: ', node2MovieSelected);

    // Select movies from node 3, where id = MOVIE_ID
    const [node3MovieSelected] = await after1980Node.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);
    console.log('Node 3: ', node3MovieSelected);

    // Commit transactions for each node
    await centralNode.commit();
    await before1980Node.commit();
    await after1980Node.commit();

    res.sendStatus(200);
  } catch (err) {
    // Rollback transactions for each node in case of error
    await centralNode.rollback();
    await before1980Node.rollback();
    await after1980Node.rollback();

    res.status(500).send(err.message);
  }
});

// Case #2: At least one transaction in the three nodes is writing (update / delete) and the other concurrent transactions are reading the same data item.
router.post('/case2', async (req, res) => {
  const central = await createConnection(NODE_LIST.centralNode);
  const node2 = await createConnection(NODE_LIST.before1980Node);
  const node3 = await createConnection(NODE_LIST.after1980Node);

  // Get isolation level set via query string
  const ISOLATION_LEVEL_SELECTED = req.query.isolationLevel;
  const MOVIE_ID = req.query.movieId ?? DEFAULT_MOVIE_ID;

  try {
    // Simulate the case where node 2 is updating the movie
    // Set isolation level for each node

    await central.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await node2.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await node3.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);

    // Begin transactions for each node
    await central.beginTransaction();
    await node2.beginTransaction();
    await node3.beginTransaction();

    // Implement the logic for Case #2 here
    // Select movies from central node, where id = MOVIE_ID
    const [centralMovieSelected] = await central.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);

    // Select movies from node 2, where id = MOVIE_ID
    const [node2MovieSelected] = await node2.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);

    // Select movies from node 3, where id = MOVIE_ID
    const [node3MovieSelected] = await node3.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);

    // Update movie in node 2
    await node2.query('UPDATE movies SET name = ? WHERE id = ?', ['Bogus Movie', MOVIE_ID]);

    // Commit transactions for each node
    await central.commit();
    await node2.commit();
    await node3.commit();

    // Review the results
    console.log('Central node: ', centralMovieSelected);
    console.log('Node 2: ', node2MovieSelected);
    console.log('Node 3: ', node3MovieSelected);

    // After logging, rollback transactions for each node to reset the data
    await central.rollback();
    await node2.rollback();
    await node3.rollback();

    res.sendStatus(200);
  } catch (err) {
    // Rollback transactions for each node in case of error
    await central.rollback();
    await node2.rollback();
    await node3.rollback();

    res.status(500).send(err.message);
  }

  res.sendStatus(200);
});

export default router;