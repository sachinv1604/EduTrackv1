module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      // Use the EAS Secret file path during remote cloud builds,
      // otherwise fall back to the local file for local development.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
  };
};
