const Sequelize = require('sequelize');
const db = require('../config/db');
const Contrato = require('../models/Contrato');
const User = require('../models/User');

const Reporte = db.define('reporte', {
    reporte_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    requerimiento: {
        type: Sequelize.STRING,
        allowNull: false
    },
    solucionado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        default: false
    },
    motivo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    fechacreacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }



});

Reporte.belongsTo(User, {
    foreignKey: {
        name: 'cliente_id'
    }
});
Reporte.belongsTo(Contrato, {
    foreignKey: {
        name: 'contrato_id'
    }
});

module.exports = Reporte;