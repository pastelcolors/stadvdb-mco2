import * as dotenv from "dotenv";
import { Pool, createPool } from "mysql2/promise";

dotenv.config();

export const centralNodeConfig = {
  host: process.env.CENTRAL_NODE_HOST,
  port: 3306,
  user: "tyrone",
  password: "123456",
  database: "all_movies",
  connectionLimit: 0,
};

export const centralNodeConfig2 = {
  host: "localhost",
  port: 3306,
  user: "tyrone",
  password: "123456",
  database: "all_movies",
  connectionLimit: 0,
};

export const before1980NodeConfig = {
  host: process.env.NODE_2_HOST,
  port: 3306,
  user: "tyrone",
  password: "123456",
  database: "movies_before_1980",
  connectionLimit: 0,
};

export const after1980NodeConfig = {
  host: process.env.NODE_3_HOST,
  port: 3306,
  user: "tyrone",
  password: "123456",
  database: "movies_from_1980",
  connectionLimit: 0,
};

export const NODE_LIST = {
  centralNodeConfig,
  centralNodeConfig2,
  before1980NodeConfig,
  after1980NodeConfig,
};

export const centralNodePool: Pool = createPool(NODE_LIST.centralNodeConfig);
export const centralNodePool2: Pool = createPool(NODE_LIST.centralNodeConfig2);
export const before1980NodePool: Pool = createPool(
  NODE_LIST.before1980NodeConfig
);
export const after1980NodePool: Pool = createPool(
  NODE_LIST.after1980NodeConfig
);
