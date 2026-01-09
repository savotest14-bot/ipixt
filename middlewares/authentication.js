const jwt = require('jsonwebtoken');
const User = require('../models/users');

exports.authenticate = async (req, res, next) => {

    const token = req.cookies.token;

    if (!token) {
        return res.status(401).send({ message: 'Token not found' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {

        if (err) {
            return res.status(401).send({ message: 'Invalid or expired token' });
        }

        try {
            const user = await User.findOne({ _id: decoded._id, isDeleted: false, tokens: token }, { email: 1 }).lean(true);

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
