import { before1980NodePool, centralNodePool } from "../../config/db";
import { getConnection } from "../../utils/queries";

// Helper function to establish connections
export async function getConnections() {
  const mainConnection = await getConnection(centralNodePool, "mainPool");
  const shardConnection = await getConnection(before1980NodePool, "shardPool");

  return { mainConnection, shardConnection };
}