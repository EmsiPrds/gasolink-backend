import { Queue } from "bullmq";
import { redisConnection } from "./redis";

const connection = redisConnection();

export const collectorsQueue = new Queue("collectors", { connection });
export const qualityQueue = new Queue("quality", { connection });
export const aiEstimationQueue = new Queue("ai-estimation", { connection });

