import { Router } from "express";
import { centralNode as central, node2, node3 } from "../config/db";
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

const ISOLATION_LEVELS = {
  READ_UNCOMMITTED: 'READ UNCOMMITTED',
  READ_COMMITTED: 'READ COMMITTED',
  REPEATABLE_READ: 'REPEATABLE READ',
  SERIALIZABLE: 'SERIALIZABLE',
};

// Case #1: Concurrent transactions in two or more nodes are reading the same data item.
router.post('/case1', async (req, res) => {
  const central = await createConnection(NODE_LIST.central);
  const node2 = await createConnection(NODE_LIST.node2);
  const node3 = await createConnection(NODE_LIST.node3);

  // Get isolation level set via query string
  const ISOLATION_LEVEL_SELECTED = req.query.isolationLevel;
  const DEFAULT_MOVIE_ID = '37b34019-d298-11ed-a5cb-00155d052813';
  const MOVIE_ID = req.query.movieId ?? DEFAULT_MOVIE_ID;

  try {
    // Set isolation level for each node
    await central.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await node2.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);
    await node3.query('SET TRANSACTION ISOLATION LEVEL ' + ISOLATION_LEVEL_SELECTED);

    // Begin transactions for each node
    await central.beginTransaction();
    await node2.beginTransaction();
    await node3.beginTransaction();

    // Implement the logic for Case #1 here
    // Select movies from central node, where id = MOVIE_ID
    const [centralMovieSelected] = await central.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);
    console.log('Central node: ', centralMovieSelected);

    // Select movies from node 2, where id = MOVIE_ID
    const [node2MovieSelected] = await node2.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);
    console.log('Node 2: ', node2MovieSelected);

    // Select movies from node 3, where id = MOVIE_ID
    const [node3MovieSelected] = await node3.query('SELECT * FROM movies WHERE id = ?', [MOVIE_ID]);
    console.log('Node 3: ', node3MovieSelected);

    // Commit transactions for each node
    await central.commit();
    await node2.commit();
    await node3.commit();

    res.sendStatus(200);
  } catch (err) {
    // Rollback transactions for each node in case of error
    await central.rollback();
    await node2.rollback();
    await node3.rollback();

    res.status(500).send(err.message);
  }
});
