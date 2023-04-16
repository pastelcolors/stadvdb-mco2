import * as dotenv from "dotenv";
import { Pool, createPool } from "mysql2/promise";

dotenv.config();

export const centralNodeConfig = {
  host: process.env.CENTRAL_NODE_HOST,
  port: Number(process.env.CENTRAL_NODE_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.CENTRAL_NODE_DB,
  connectionLimit: 20,
};

export const before1980NodeConfig = {
  host: process.env.NODE_2_HOST,
  port: Number(process.env.NODE_2_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.NODE_2_DB,
  connectionLimit: 20,
};

export const after1980NodeConfig = {
  host: process.env.NODE_3_HOST,
  port: Number(process.env.NODE_3_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.NODE_3_DB,
  connectionLimit: 20,
};

export const NODE_LIST = {
  centralNodeConfig,
  before1980NodeConfig,
  after1980NodeConfig,
};

export const centralNodePool: Pool = createPool(NODE_LIST.centralNodeConfig);
export const before1980NodePool: Pool = createPool(NODE_LIST.before1980NodeConfig);
export const after1980NodePool: Pool = createPool(NODE_LIST.after1980NodeConfig);
