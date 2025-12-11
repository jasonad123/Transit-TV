'use strict';

// Shared server state
// This module is separate to avoid circular dependency issues
module.exports = {
  isShutdown: false,
  shutdownTime: null,
  isRestarting: false
};
