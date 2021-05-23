const Equipos = require('../database/models/Equipo');
const Contrato = require('../database/models/Contrato');
const User = require('../database/models/User');
const Antena = require('../database/models/Antena');
const Fibra = require('../database/models/Fibra');

const Sequelize = require('sequelize');
const Op = Sequelize.Op;

exports.listadoEquipos = async(req, res) => {
    const consultas = [];
    consultas.push(User.findAll({}))
    consultas.push(Contrato.findAll({}))
    consultas.push(Antena.findAll({}))
    consultas.push(Fibra.findAll({}))
    consultas.push(Equipos.findAll({
        include: [{ model: User }, { model: Contrato }, { model: Fibra }, { model: Antena }]
    }))
    const [usuarios, contratos, fibra, antena, equipos] = await Promise.all(consultas);
    console.log(consultas);

    res.render('equipos', {
        nombrePagina: 'Equipos',
        usuarios,
        contratos,
        fibra,
        antena,
        equipos
    })
}


/* https://sequelize.org/v5/manual/models-usage.html */
/* const { cliente, contrato } = req.query;
console.log(cliente);
let query ;
if (cliente === '') {
    query= ''
} else {
    query= `where :  { 
        cliente_id: {[Op.eq]:${cliente}}
    }`
}

if (contrato === '') {
    query= ''
} else {
    query= `where :  { 
        contrato_id: {[Op.eq]:${contrato}}
    }`
}

const equipos = await Equipos.findAll({ 
    query,
    include: [
        {
            model: User, 
            attributes : ['nombre']
        },
        {
            model: Contrato, 
            attributes : ['contrato_id']
        },
        {
            model: Antena, 
            attributes : ['nombre']
        },
        {
            model: Fibra, 
            attributes : ['nombre']
        }
    ]
}); */



/* res.render('resultado',{
    nombrePagina:'Resultado Busqueda',
    equipos
}) */