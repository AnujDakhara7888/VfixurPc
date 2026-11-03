const { withEntitlementsPlist } = require('@expo/config-plugins');

// Apply after notifications configuration; personal teams cannot sign APNs.
module.exports = (config) => withEntitlementsPlist(config, (result) => {
  delete result.modResults['aps-environment'];
  return result;
});
