import("./src/node/server.js").catch((error) => {
  console.error("Failed to start Node adapter:", error);
  process.exit(1);
});
