const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) { 
  let token = req.headers["authorization"]; 
  if (!token) return res.status(403).send("Access denied"); 

  if (token.startsWith("Bearer ")) {
    token = token.slice(7, token.length).trimLeft();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { 
    if (err) return res.status(401).send("Invalid token"); 
    req.user = decoded; 
    next(); 
  }); 
}

module.exports = verifyToken;
