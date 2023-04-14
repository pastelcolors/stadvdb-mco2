import * as dotenv from "dotenv";
import { createConnection } from "mysql2";

dotenv.config();

export const centralNode = {
  host: process.env.CENTRAL_NODE_HOST,
  port: Number(process.env.CENTRAL_NODE_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.CENTRAL_NODE_DB,
};

export const before1980Node = {
  host: process.env.NODE_2_HOST,
  port: Number(process.env.NODE_2_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.NODE_2_DB,
};

export const after1980Node = {
  host: process.env.NODE_3_HOST,
  port: Number(process.env.NODE_3_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.NODE_3_DB,
};


export const NODE_LIST = {
  centralNode,
  before1980Node,
  after1980Node,
};