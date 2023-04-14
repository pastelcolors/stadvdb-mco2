import { Router } from "express";
import { centralNode, node2, node3 } from "../config/db";


const NODE_LIST = {
  central: centralNode,
  node2,
  node3,
};

const router = Router();

router.get("/case-1", async(req,res)=>{
  
})

router.get("/", async (req, res) => {
  const nodeConfig = NODE_LIST[req.query.node as keyof typeof NODE_LIST];

  // const node = createConnection(nodeConfig);
  // const movies = MovieRepository(node);
  // const { rows } = await movies.findAll();

  // return res.send(rows);
});

router.get("/:movie", async (req,res) => {
  const nodeConfig = NODE_LIST[req.query.node as keyof typeof NODE_LIST];

  

  // return res.send(rows);
})

export default router;
