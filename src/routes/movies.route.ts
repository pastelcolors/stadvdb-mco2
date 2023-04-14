import { Router } from "express";
import { NODE_LIST } from "../config/db";
import { createConnection } from "mysql2/promise";
import { REFUSED } from "dns";

const router = Router();

router.post("/case-1", async (req, res) => {
  const nodeConfig = NODE_LIST[req.query.node as keyof typeof NODE_LIST];
  const node = await createConnection(nodeConfig);
  const [rows] = await node.execute("SELECT * FROM movies WHERE name=?", [
    "$30",
  ]);

  return res.send(rows);
});

router.get("/", async (req, res) => {
  const nodeConfig = NODE_LIST[req.query.node as keyof typeof NODE_LIST];

  // const node = createConnection(nodeConfig);
  // const movies = MovieRepository(node);
  // const { rows } = await movies.findAll();

  // return res.send(rows);
});

router.get("/:movie", async (req, res) => {
  // return res.send(rows);
});

export default router;
