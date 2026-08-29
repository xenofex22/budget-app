const { getSessionUser } = require("../lib/server/auth");
module.exports = async function handler(req,res){ const user=getSessionUser(req); if(!user) return res.status(401).json({authenticated:false}); return res.status(200).json({authenticated:true,username:user}); };
