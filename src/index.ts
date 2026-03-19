import { app } from "./app";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { startJobs } from "./jobs";

async function main() {
  await connectDb();

  app.listen(env.PORT, () => {
    console.log(`Gasolink API listening on :${env.PORT}`);
    startJobs();
  });
}

main().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});

