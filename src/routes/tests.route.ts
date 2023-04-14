import { Router } from "express";
import { centralNode, node2, node3 } from "../config/db";
import { createConnection } from "mysql2/promise";
import { NODE_LIST } from "../config/db";

const router = Router();

router.post('/case1', async (req, res) => {
  try {
    const central = await createConnection(NODE_LIST.central);

    // Set isolation level for each node
    await centralNode.query('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
    await node2.query('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
    await node3.query('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');

    // Begin transactions for each node
    await centralNode.beginTransaction();
    await node2.beginTransaction();
    await node3.beginTransaction();

    // Implement the logic for Case #1 here

    // Commit transactions for each node
    await centralNode.commit();
    await node2.commit();
    await node3.commit();

    res.sendStatus(200);
  } catch (err) {
    // Rollback transactions for each node in case of error
    await centralNode.rollback();
    await node2.rollback();
    await node3.rollback();

    res.status(500).send(err.message);
  }
});
