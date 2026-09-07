// costing-main.js
// The one script tag for the Costing module. It loads every costing file through plain relative imports so each
// module runs exactly once. (Loading costing.js with a ?v= query while the other files import ./costing.js made
// the browser run costing.js twice: two click handlers, buttons firing twice. Fixed in Phase 3.)
// Cache busting is handled by the Cache-Control header for /admin/** in firebase.json, not by query strings.
import './costing.js';
import './costing-products.js';
import './costing-estimator.js';
import './costing-reports.js';
import './costing-reviews.js';
