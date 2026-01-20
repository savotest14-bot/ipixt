const jwt = require('jsonwebtoken');
const User = require('../models/users');

exports.authenticate = async (req, res, next) => {

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).send({ message: 'Token not found' });
    }
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Invalid or expired token' });
        }
        try {
            const user = await User.findOne({ _id: decoded.userId, isDeleted: false, tokens: token }, { email: 1, phoneNumber: 1, role: 1 }).lean(true);
         
            if (!user) {
                return res.status(401).json({ message: 'Token revoked. Please login.' });
            }
            req.user = user;
            next();
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }
    });
};
