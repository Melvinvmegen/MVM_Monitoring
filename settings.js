export default {
  constants: {
    web: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || "0.0.0.0",
      logFormat: process.env.LOG_FORMAT || "dev",
    },
  },
  basicAuth: {
    username: process.env.BASIC_AUTH_USERNAME,
    password: process.env.BASIC_AUTH_PASSWORD
  },
  logger: {
    json: !!process.env.LOGGER_JSON,
    translateTime: process.env.LOGGER_TRANSLATE_TIME || "SYS:HH:MM:ss",
    ignore: process.env.LOGGER_IGNORED_FIELDS || "reqId,http",
    minimumLevel: process.env.LOGGER_MIN_LEVEL || "info",
  },
  monitoringDashboard: {
    baseUrl: process.env.MONITORING_DASHBOARD_BASE_URL,
  },
  cAdvisor: {
    apiVersion: process.env.CADVISOR_API_VERSION || "v1.3"
  }
}