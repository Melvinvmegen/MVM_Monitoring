import * as fetch from "./fetch.js";
import settings from "./settings.js";
import fastify from "fastify";

const app = fastify({
  bodyLimit: 52428800,
  disableRequestLogging: true,
  trustProxy: true,
  logger: {
    level: settings.logger.minimumLevel,
    customLevels: {
      log: 35,
    },
    formatters: {
      level: (label) => {
        return { level: label === "log" ? "INFO" : label.toUpperCase() };
      },
    },
    timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
  },
});

app.get("/stats/:node?", async (request, reply) => {
  let fetchUrl = `${settings.monitoringDashboard.baseUrl}/api/${settings.cAdvisor.apiVersion}/containers/`;
  if (request.params.node) {
    fetchUrl = `${settings.monitoringDashboard.baseUrl.replace("monitoring-dashboard", `monitoring-dashboard-${request.params.node}`)}/api/${settings.cAdvisor.apiVersion}/containers/`;
  }

  try {
    const response = await fetch.get(fetchUrl, {
      auth: {
        username: settings.basicAuth.username,
        password: settings.basicAuth.password,
      },
    });

    const spec = response.spec;
    const stats = response.stats.at(-1);
    const memoryUsage = stats.memory.usage / 1_000_000_000 || 0;
    const memoryWorkingSet = stats.memory.working_set / 1_000_000_000 || 0;
    console.log({spec, stats})
    const memoryLimit =
      (spec.memory.limit - (spec.memory.swap_limit || 0)) / 1_000_000_000 || 0;

    const subContainersStats = await getSubContainerStats(
      memoryLimit,
      request.params.node,
    );
    if (request.query.format === "csv") {
      const headers = Object.keys(subContainersStats[0]).join(",");
      const rows = subContainersStats
        .map((sc) => Object.values(sc).join(","))
        .join("\n");
      reply.header("Content-Type", "text/csv");
      return `${headers}\n${rows}`;
    } else {
      return {
        memoryUsage: `${memoryUsage.toFixed(2)} GB`,
        memoryWorkingSet: `${memoryWorkingSet.toFixed(2)} GB`,
        memoryLimit: `${memoryLimit.toFixed(2)} GB`,
        memoryPercentage:
          (memoryLimit > 0
            ? ((memoryWorkingSet / memoryLimit) * 100).toFixed(2)
            : 0) + "%",
        totalMemoryPercentage:
          (memoryLimit > 0
            ? ((memoryUsage / memoryLimit) * 100).toFixed(2)
            : 0) + "%",
        subContainersStats,
      };
    }
  } catch (error) {
    app.log.error(
      `[${request.params.node?.toUpperCase() || ""}] Error checking node stats: ${error.message}`,
    );
    reply.code(500).send({ error: `Error fetching stats: ${error.message}` });
  }
});

app.get("/check-memory/:threshold/:node?", async (request, reply) => {
  let fetchUrl = `${settings.monitoringDashboard.baseUrl}/api/${settings.cAdvisor.apiVersion}/containers/`;
  if (request.params.node) {
    fetchUrl = `${settings.monitoringDashboard.baseUrl.replace("monitoring-dashboard", `monitoring-dashboard-${request.params.node}`)}/api/${settings.cAdvisor.apiVersion}/containers/`;
  }

  try {
    const threshold = parseFloat(request.params.threshold);
    const response = await fetch.get(fetchUrl, {
      auth: {
        username: settings.basicAuth.username,
        password: settings.basicAuth.password,
      },
    });
    const spec = response.spec;
    const stats = response.stats.at(-1);
    const memoryUsage = stats.memory.usage / 1_000_000_000 || 0;
    const memoryWorkingSet = stats.memory.working_set / 1_000_000_000 || 0;
    const memoryLimit =
      (spec.memory.limit - (spec.memory.swap_limit || 0)) / 1_000_000_000 || 0;
    const memoryPercentage =
      memoryLimit > 0 ? (memoryWorkingSet / memoryLimit) * 100 : 0;
    const totalMemoryPercentage =
      memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
    const exceedsThreshold = memoryPercentage > threshold;
    const memoryStats = {
      memoryUsage,
      memoryWorkingSet,
      memoryLimit,
      memoryPercentage,
      totalMemoryPercentage,
    };

    app.log.info(
      `[${request.params.node?.toUpperCase() || ""}] Current Stats, memory_limit: ${memoryLimit.toFixed(2)}G, memory_usage: ${memoryUsage.toFixed(2)}G, memory_working_set: ${memoryWorkingSet.toFixed(2)}G, memory_percentage: ${memoryPercentage.toFixed(2)}%`,
    );
    if (exceedsThreshold) {
      const subContainersStats = await getSubContainerStats(
        memoryLimit,
        request.params.node,
      );
      reply.send({
        status: "DOWN",
        message: `Memory usage is above threshold of ${threshold}%`,
        details: { ...memoryStats, subContainersStats },
      });
    } else {
      reply.send({
        status: "UP",
        message: `Memory usage is below threshold of ${threshold}%`,
        details: memoryStats,
      });
    }
  } catch (error) {
    app.log.error(
      `[${request.params.node.toUpperCase()}]Error checking memory threshold:`,
      error.message,
    );
    reply.code(500).send({ error: "Error checking memory threshold" });
  }
});

async function getSubContainerStats(memoryLimit, node = null) {
  let fetchUrl = `${settings.monitoringDashboard.baseUrl}/api/${settings.cAdvisor.apiVersion}/subcontainers/`;
  if (node) {
    fetchUrl = `${settings.monitoringDashboard.baseUrl.replace("monitoring-dashboard", `monitoring-dashboard-${request.params.node}`)}/api/${settings.cAdvisor.apiVersion}/subcontainers/`;
  }

  const subContainers = await fetch.get(fetchUrl,
    {
      auth: {
        username: settings.basicAuth.username,
        password: settings.basicAuth.password,
      },
    },
  );

  const subContainersStats = subContainers.reduce((acc, sc) => {
    if (sc.aliases?.[0]) {
      const stats = sc.stats.at(-1);
      const memoryUsage = stats.memory.usage / 1_000_000_000 || 0;
      const memoryWorkingSet = stats.memory.working_set / 1_000_000_000 || 0;
      acc.push({
        name: sc.aliases?.[0]?.split(".")[0] || sc.name,
        memoryWorkingSet: `${memoryWorkingSet.toFixed(2)} GB` || 0,
        totalMemoryUsage: `${memoryUsage.toFixed(2)} GB` || 0,
        memoryPercentage:
          (memoryLimit > 0
            ? ((memoryWorkingSet / memoryLimit) * 100).toFixed(2)
            : 0) + "%",
        totalMemoryPercentage:
          (memoryLimit > 0
            ? ((memoryUsage / memoryLimit) * 100).toFixed(2)
            : 0) + "%",
      });
    }
    return acc;
  }, []);

  return subContainersStats.sort(
    (a, b) =>
      b.memoryWorkingSet.replace(" GB", "") -
      a.memoryWorkingSet.replace(" GB", ""),
  );
}

app
  .listen({
    port: +settings.constants.web.port,
    host: settings.constants.web.host,
  })
  .then((address) => `API Server listening on port ${address.split(":").pop()}`)
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
