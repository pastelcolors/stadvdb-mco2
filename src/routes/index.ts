import { Router } from "express";
import { createConnection } from "mysql2/promise";
import { NODE_LIST } from "../config/db";
import Connection from "mysql2/typings/mysql/lib/Connection";

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

export type NODES = 'Central Node' | 'Before 1980 Node' | 'After 1980 Node';
// Default Movie
// Name: $1,000 Reward
// Year: 1913
// Rank: NULL
// Actor 1: Charles (II) Bennett
// Actor 2: Morris McGee
// Actor 3: Crane Wilbur
const DEFAULT_MOVIE_ID = '37b34019-d298-11ed-a5cb-00155d052813'; 

// Log data structure to store the results of the tests
interface Log {
  status?: string;
  node: string;
  isolationLevel: ISOLATION_LEVELS;
  body: any;
  timestamp?: Date;
}

// Case #1: Concurrent transactions in two or more nodes are reading the same data item.
router.post('/case1', async (req, res) => {
  const centralNode = await createConnection(NODE_LIST.centralNodeConfig);
  const before1980Node = await createConnection(NODE_LIST.before1980NodeConfig);
  const after1980Node = await createConnection(NODE_LIST.after1980NodeConfig);
  const log: Log[] = [];

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

    const queryPromises = [
      centralNode.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]),
      before1980Node.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]),
      after1980Node.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]),
    ];

    const [centralMovieSelected, before1980MovieSelected, after1980MovieSelected] = await Promise.all(queryPromises);

    log.push({
      status: 'Selected movie from central node',
      node: 'Central Node',
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: centralMovieSelected[0],
      timestamp: new Date(),
    });

    // Select movies from node 2, where id = MOVIE_ID
    log.push({
      status: 'Selected movie from before 1980 node',
      node: 'Before 1980 Node',
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: before1980MovieSelected[0],
      timestamp: new Date(),
    });

    // Select movies from node 3, where id = MOVIE_ID
    log.push({
      status: 'Selected movie from after 1980 node',
      node: 'After 1980 Node',
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: after1980MovieSelected[0],
      timestamp: new Date(),
    });

    // Commit promises for each node
    const commitPromises = [
      centralNode.commit(),
      before1980Node.commit(),
      after1980Node.commit(),
    ];

    await Promise.all(commitPromises);

    res.status(200).send(log);
  } catch (err) {
    // Rollback transactions for each node in case of error
    await centralNode.rollback();
    await before1980Node.rollback();
    await after1980Node.rollback();

    res.status(500).send(err);
  }
});

// Case #2: At least one transaction in the three nodes is writing (update / delete) and the other concurrent transactions are reading the same data item.
router.post('/case2', async (req, res) => {
  const centralNode = await createConnection(NODE_LIST.centralNodeConfig);
  const before1980Node = await createConnection(NODE_LIST.before1980NodeConfig);
  const after1980Node = await createConnection(NODE_LIST.after1980NodeConfig);
  const log: Log[] = [];

  // Get isolation level set via query string
  const ISOLATION_LEVEL_SELECTED = req.query.isolationLevel as ISOLATION_LEVELS ?? 'READ UNCOMMITTED';
  const MOVIE_ID = req.query.movieId ?? DEFAULT_MOVIE_ID;
  const UPDATER_NODE: NODES = req.query.updaterNode as NODES ?? 'Central Node';

  try {
    // Simulate the case where node 2 is updating the movie
    // Set isolation level for each node
    await centralNode.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await before1980Node.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await after1980Node.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);

    // Begin transactions for each node
    await centralNode.beginTransaction();
    await before1980Node.beginTransaction();
    await after1980Node.beginTransaction();

    const queryPromises = [];

    // Update movie
    if (UPDATER_NODE === 'Central Node') {
      queryPromises.push(centralNode.query('UPDATE movies SET title = ? WHERE id = ?', ['Updated Title', MOVIE_ID]));
    } else if (UPDATER_NODE === 'Before 1980 Node') {
      queryPromises.push(before1980Node.query('UPDATE movies SET title = ? WHERE id = ?', ['Updated Title', MOVIE_ID]));
    } else if (UPDATER_NODE === 'After 1980 Node') {
      queryPromises.push(after1980Node.query('UPDATE movies SET title = ? WHERE id = ?', ['Updated Title', MOVIE_ID]));
    }

    // Get the updated movie from all nodes
    queryPromises.push(centralNode.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]));
    queryPromises.push(before1980Node.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]));
    queryPromises.push(after1980Node.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]));

    // Commit transactions for each node
    const [movieUpdated, before1980MovieSelected, centralMovieSelected, after1980MovieSelected] = await Promise.all(queryPromises);

    // Review the results
    log.push({
      status: 'Updated movie from ' + UPDATER_NODE,
      node: UPDATER_NODE,
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: movieUpdated[0],
      timestamp: new Date(),
    });

    log.push({
      status: 'Selected movie from central node',
      node: 'Central Node',
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: centralMovieSelected[0],
      timestamp: new Date(),
    });

    log.push({
      status: 'Selected movie from before 1980 node',
      node: 'Before 1980 Node',
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: before1980MovieSelected[0],
      timestamp: new Date(),
    });

    log.push({
      status: 'Selected movie from after 1980 node',
      node: 'After 1980 Node',
      isolationLevel: ISOLATION_LEVEL_SELECTED,
      body: after1980MovieSelected[0],
      timestamp: new Date(),
    });

    // Commit promises for each node
    const commitPromises = [
      centralNode.commit(),
      before1980Node.commit(),
      after1980Node.commit(),
    ];

    await Promise.all(commitPromises);

    res.sendStatus(200);
  } catch (err) {
    // Rollback transactions for each node in case of error
    await centralNode.rollback();
    await before1980Node.rollback();
    await after1980Node.rollback();

    res.status(500).send(err);
  }

  res.sendStatus(200);
});

export default router;