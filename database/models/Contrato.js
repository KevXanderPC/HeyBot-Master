const Sequelize = require('sequelize');
const db = require('../config/db');
const Planes = require('../models/Plan');
const User = require('../models/User');

const Contrato = db.define('contrato', {
    contrato_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    direccion: {
        type: Sequelize.STRING,

    },
    estado: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    }
});

/* Contrato.belongsTo(User);
Contrato.belongsTo(Planes); */

Contrato.belongsTo(User, {
    foreignKey: {
        name: 'cliente_id'
    }
});
Contrato.belongsTo(Planes, {
    foreignKey: {
        name: 'plan_id'
    }
})

module.exports = Contrato