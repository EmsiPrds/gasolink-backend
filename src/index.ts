import { app } from "./app";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { startJobs } from "./jobs";

async function main() {
  await connectDb();

  app.listen(env.PORT, () => {
    const baseUrl =
      env.NODE_ENV === "production"
        ? `https://api.gasolink.app:${env.PORT}`
        : `http://localhost:${env.PORT}`;

    console.log("");
    console.log("🚀 Gasolink API development server");
    console.log("----------------------------------");
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Port:       ${env.PORT}`);
    console.log(`Base URL:   ${baseUrl}`);
    console.log("");
    console.log("HTTP request logs (morgan) will appear below.");
    console.log("");

    startJobs();
  });
}

main().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});

