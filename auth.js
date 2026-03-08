const jwt = require('jsonwebtoken');
const token = jwt.sign({ sub: "test-admin", role: "admin", name: "Admin" }, process.env.JWT_SECRET || "super_secret_key_change_in_production");
console.log(token);
