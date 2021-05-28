const express = require('express');
/* const { sequelize, clientes, contratos, planes, equipos, cajas, reportes, antenas, facturas, tickets, usuarios } = require('./database/models'); */
const app = express();

/* modificado */
var expressLayouts = require("express-ejs-layouts");
const path = require('path');
const bodyParser = require('body-parser');
const router = require('./routes');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const passport = require('./database/passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');
/*  */

const { WebhookClient } = require('dialogflow-fulfillment');
const { dialogflow } = require('actions-on-google');
const { query, response } = require('express');
const cors = require('cors')
    //middlewares
const middlewares = require("./middlewares/middlewares");
app.use(cors());
//routes

/* const apiRouter = require("./routes/apiRouter");
const registerRouter = require("./routes/registerRouter"); */
const { on } = require('nodemon');
const { convert } = require('actions-on-google/dist/service/actionssdk');

const db = require('./database/config/db');

//Modelos
require('./database/models/Login');
const clientes = require('./database/models/User');
const contratos = require('./database/models/Contrato');
const Planes = require('./database/models/Plan');
const Antena = require('./database/models/Antena');
const Caja = require('./database/models/Fibra');
const Equipos = require('./database/models/Equipo');
const Reportes = require('./database/models/Reporte');
const Tickets = require('./database/models/Ticket');
const Facturas = require('./database/models/Factura');
db.sync()
    .then(() => console.log('Conectado al servidor'))
    .catch(error => console.log(error));

/* Variables de desarrollo */
require('dotenv').config({ path: 'variables.env' })

/* app.use("/api", apiRouter);
app.use("/register", registerRouter); */

//setting 

/* var PORT = process.env.PORT || 8000; */
/* var maybe_port = process.env.PORT || 8000;
if (typeof maybe_port === "number") {
    port = maybe_port;
} */
process.env.DEBUG = 'dialogflow:debug';

//variables
const timeZone = 'Ecuador/Quito';
const timeZoneOffset = '-05:00';

//webhook


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(expressValidator());
app.use(expressLayouts);
app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, './views'));
app.use(express.static('public'));

app.use(cookieParser());

app.use(session({
    secret: 'kevxander',
    key: 'supersecreta',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use((req, res, next) => {
    res.locals.usuario = {...req.user } || null;
    res.locals.mensajes = req.flash();
    next();
})


app.use('/', router());

app.post('/webhook', express.json(), function(req, res) {
    const agent = new WebhookClient({ request: req, response: res });
    console.log('Dialogflow Request headers: ' + JSON.stringify(req.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(req.body));

    async function Saludo(agent) {
        agent.add(`Muy buenas mi nombre es HeyBot, bienvenido a servicio tecnico automatizado de Hey!.`);
        agent.add(`Puedes escribir Menu para conocer mis funciones y Salir para finalizar `);
    }

    async function IngresarCedula(agent) {
        let requerimiento = agent.parameters.requerimientos
        console.log(requerimiento)
        var possibleResponse = [
            'Por favor indíqueme el número de cédula del cliente',
            'Por favor brindeme el número de cédula del cliente',
            'Ayúdeme facilitandome el número de cédula del cliente por favor'
        ];
        var pick = Math.floor(Math.random() * possibleResponse.length);
        var response = possibleResponse[pick];
        agent.add(response);
        //agent.add(`Por favor indíqueme el número de cédula del cliente`);
        agent.context.set({
            name: 'peticion',
            lifespan: 15,
            parameters: {
                'requerimiento': requerimiento
            }
        });
    }

    async function ValidarCliente(agent) {
        let cliente = "";
        let contrato = "";
        let motivo = "sin motivo";
        let requerimiento = "";
        let solucionado = false;
        agent.context.delete("sfu");
        agent.context.delete("Saludo-followup");
        const cedula = agent.parameters["number-sequence"]
        try {
            cliente = await clientes.findOne({ where: { cedula } }).then(console.log(cliente))

        } catch (err) {
            console.log(err);
            agent.clearOutgoingContexts();
        }
        if (cliente == null) {
            var possibleResponse = [
                `No existe cliente asociado intente nuevamente`,
                `No se encontro cliente asociado con este numero de cédula, ingrese un número válido por favor`,
                `No se reconoce a un cliente registrado con tal número de cédula, ingrese otro número por favor`
            ];
            var pick = Math.floor(Math.random() * possibleResponse.length);
            var response = possibleResponse[pick];
            agent.add(response);
            // agent.add(`No existe cliente asociado intente nuevamente`)
            agent.context.delete("vcsifu");
            agent.context.delete("validarcliente-followup");
            agent.context.set({
                name: 'validarcliente',
                lifespan: 1
            });
        } else {
            // agent.add(`El cliente ${cliente.nombre} verdad?`)
            var possibleResponse = [
                `El cliente ${cliente.nombre} ¿correcto?`,
                `Confírmeme  que se trata del cliente ${cliente.nombre}`,
            ];
            var pick = Math.floor(Math.random() * possibleResponse.length);
            var response = possibleResponse[pick];
            agent.add(response);
            agent.context.delete("vcfu");
        }
        agent.context.set({
            name: 'cliente',
            lifespan: 15,
            parameters: {
                'cliente': cliente,
                'contrato': contrato,
                'requerimiento': requerimiento,
                'motivo': motivo,
                'solucionado': solucionado
            }
        });
    }

    async function ValidarClientesi(agent) {
        agent.context.delete("vcsifu");
        await ValidarContrato(agent);
    }

    function ValidarClientesifb(agent) {
        let contexto = agent.context.get('cliente').parameters
        let cliente = contexto.cliente;
        agent.add(`No le entendí. Es usted el cliente ${cliente.nombre} o no?`)
    }

    async function ValidarContrato(agent) {
        let contexto = agent.context.get('cliente').parameters
        let cliente = contexto.cliente;
        let contrato;
        try {
            contrato = await contratos.findAll({
                raw: true,
                where: {
                    cliente_id: cliente.cliente_id,
                    estado: true
                },
            }).then(console.log(contrato))

            if (contrato == "") {
                agent.add(`No existe un contrato asociado al número de cédula`)
                agent.add('¿Desea proporcionar otro numero de cédula?')

            } else {
                if (contrato.length >= 2) {
                    var possibleResponse = [
                        `Cual es la dirección de su contrato?`,
                        'Por favor faciliteme la dirección del contrato a validar',
                        'Verifico que tiene diferentes contratos. Especifique la dirección por favor'
                    ];
                    var pick = Math.floor(Math.random() * possibleResponse.length);
                    var response = possibleResponse[pick];
                    agent.add(response);
                    //agent.add(`Cual es la direccion de su contrato?`)
                    contrato.forEach(contrato => {
                        agent.add(`${contrato.direccion}`)
                    });
                    agent.context.set({
                        name: 'econfu',
                        lifespan: 2,
                    });
                    agent.context.set({
                        name: 'cliente',
                        lifespan: 1,
                        parameters: {
                            'contrato': contrato,
                            'cliente': cliente
                        }
                    });
                    agent.context.set({
                        name: 'clientevalidado',
                        lifespan: 1,
                    });
                    agent.context.delete("vcsifu");
                    agent.context.delete("validarclientesi-followup");

                } else {
                    contrato = await contratos.findOne({ where: { cliente_id: cliente.cliente_id } }).then(console.log(contrato));
                    agent.context.set({
                        name: 'cliente',
                        lifespan: 15,
                        parameters: {
                            'contrato': contrato,
                            'cliente': cliente
                        }
                    });
                    Requerimiento(agent);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }


    function Requerimiento(agent) {
        let contexto = agent.context.get('peticion').parameters
        switch (contexto.requerimiento) {
            case "Servicio Tecnico":
                agent.add("¿Indiqueme que problema técnico esta experimentando?");
                agent.setContext({ 'name': 'requerimiento', 'lifespan': '1' });
                agent.setContext({ 'name': 'requerimientofb', 'lifespan': '1' });
                break;
            case "Cambio de Clave":
                agent.add("Cambio de clave");
                agent.context.set({
                    name: 'requerimiento',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Cambio de clave'
                    }
                });
                agent.setFollowupEvent('get_cambioclave');
                break;
            case "Consulta de Deuda":
                agent.add("Consulta Deuda");
                agent.context.set({
                    name: 'requerimiento',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Consulta de Deuda'
                    }
                });
                agent.setFollowupEvent('get_consultadeuda');
                break;
            case "Consulta de Tickets":
                agent.add("Consulta Deuda");
                agent.context.set({
                    name: 'requerimiento',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Consulta de Deuda'
                    }
                });
                agent.setFollowupEvent('get_consultadeuda');
                break;
            case "Consulta de Horarios":
                agent.add("Horarios de Atencion");
                agent.context.set({
                    name: 'requerimiento',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Consulta de Deuda'
                    }
                });
                agent.setFollowupEvent('get_consultadeuda');
                break;
            case "Servicio Lento":
                agent.add("Servicio lento");
                agent.context.set({
                    name: 'requerimiento',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Servicio lento'
                    }
                });
                agent.setFollowupEvent('get_serviciolento');
                break;
            case "Sin Servicio":
                agent.add("Sin Servicio");
                agent.context.set({
                    name: 'requerimiento',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Sin Servicio'
                    }
                });
                agent.setFollowupEvent('get_sinservicio');
                break;
            default:
                agent.add("Por favor repitame,¿En que le puedo servir?")
                agent.setContext({ 'name': 'requerimiento', 'lifespan': '1' });
                break;
        }

    }
    async function EspecificarContrato(agent) {
        let contexto2 = agent.context.get('cliente').parameters
        let contrato;
        let direccion;
        console.log(contexto2.solucionado)
        try {
            direccion = agent.parameters.direccion
            contrato = await contratos.findOne({
                where: {
                    cliente_id: contexto2.cliente.cliente_id,
                    direccion: direccion
                }
            })


        } catch (err) {
            console.log(err);
            agent.clearOutgoingContexts();
        }
        if (contrato == null) {
            agent.add(`No existe un contrato con esa direccion. Intentelo de nuevo`)
            agent.context.set({
                name: 'clientevalidado',
                lifespan: 1
            });

        } else {
            agent.context.set({
                name: 'cliente',
                lifespan: 15,
                parameters: {
                    //'cliente': contexto2.cliente,
                    'contrato': contrato
                }
            });
            Requerimiento(agent);
        }

    }

    async function Serviciolento(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let atenuacion;
        let plan;
        let equipo;
        let caja;
        requerimiento = 'Servicio Lento'
        try {
            plan = await planes.findOne({
                raw: true,
                attributes: ['megas'],
                where: {
                    plan_id: contrato.plan_id
                }
            })

        } catch (e) {
            console.log(e);
            agent.clearOutgoingContexts();
        }
        if (plan.megas !== '10') {
            try {
                console.log(contrato)
                equipo = await equipos.findOne({
                    raw: true,
                    where: {
                        contrato_id: contrato.contrato_id
                    }
                })
                caja = await cajas.findOne({
                    attributes: ['potencia'],
                    raw: true,
                    where: {
                        caja_id: equipo.caja_id
                    }
                })
                atenuacion = caja.potencia - equipo.potencia
                agent.context.set({
                    name: 'cliente',
                    lifespan: 15,
                    parameters: {
                        'requerimiento': 'Servicio Lento',
                        'equipo': equipo,
                        'caja': caja
                    }
                });


            } catch (e) {
                console.log(e);
                agent.clearOutgoingContexts();
            }
            if (atenuacion >= 5) {
                agent.add('Tiene la potencia del equipo elevada. Contactese a este numero para pedir ticket de atención')
                let motivo = "potencia elevada";
                agent.add("¿Algo mas en lo que  pueda servirle?")
                agent.context.set({
                    name: 'cliente',
                    lifespan: 15,
                    parameters: {
                        'motivo': motivo
                    }
                });
                agent.context.set({
                    name: 'finalizar',
                    lifespan: 1,
                });

            } else {
                var possibleResponse = [
                    "¿Tiene el servicio lento en algun dispositivo en especifico o en todos por igual?",
                    "¿El problema es solo con un dispositivo o es con todos por igual?",
                    '¿Tiene servicio lento en todos los dispositivoso solo en uno de ellos?'
                ];
                var pick = Math.floor(Math.random() * possibleResponse.length);
                var response = possibleResponse[pick];
                agent.add(response);
            }
        } else {
            try {
                equipo = await equipos.findOne({
                    raw: true,
                    where: {
                        contrato_id: contrato.contrato_id
                    }
                })


            } catch (e) {
                console.log(e);
                agent.clearOutgoingContexts();
            }
        }
        agent.context.set({
            name: 'cliente',
            lifespan: 15,
            parameters: {
                'requerimiento': 'Servicio Lento',
                'equipo': equipo,
                'plan': plan,
                'caja': caja
            }
        });

    }

    async function SLDisp(agent) {
        let dispositivos = agent.parameters.cantidad
            // let contexto2 = agent.context.get('equipo').parameters
        let contexto = agent.context.get('cliente').parameters
        let dispositivossistema = contexto.equipo.dispositivos
        console.log(contexto)
        if (parseInt(dispositivos) > parseInt(dispositivossistema)) {
            agent.add("Tiene conectado " + dispositivossistema + " dispositivos en su red según el sistema, son todos suyos?")
            agent.setContext({ 'name': 'sldispfu', 'lifespan': '1' });
        } else {
            agent.add("Por favor indiqueme en que aplicación o plataforma tiene la novedad.")
        }
        agent.context.set({
            name: 'cliente',
            lifespan: 6,
            parameters: {
                'dispositivos': dispositivos
            }
        });
    }

    async function SLConsumo(agent) {
        let tipoconsumo = agent.parameters["consumo"]
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let dispositivossistema = contexto.equipo.dispositivos
        let consumototal;
        let plan;
        let consumo;
        console.log(tipoconsumo)
        if (tipoconsumo == "redesociales" | tipoconsumo == "video") {
            consumo = 2.5
        } else {
            consumo = 4
        }
        consumototal = parseInt(dispositivossistema) * parseInt(consumo)
        try {
            plan = await planes.findOne({
                raw: true,
                attributes: ['megas'],
                where: {
                    plan_id: contrato.plan_id
                }
            })
        } catch (e) {
            console.log(e)
        }
        if (consumototal > plan.megas) {
            agent.add("Esta consumiendo " + JSON.stringify(consumototal) +
                " megas que supera su plan asignado, por favor controle el ancho de banda o contrate otro plan")
            let motivo = "Consumo elevado"
            let solucionado = true;
            agent.context.set({
                name: 'cliente',
                lifespan: 15,
                parameters: {
                    'motivo': motivo,
                    'solcionado': solucionado
                }
            });
            agent.add("¿Algo mas en lo que pueda servirle?")
            agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });
        } else {
            agent.add("Por favor indíqueme,¿A cuántos metros del router se esta coenctando?")
        }
        agent.context.set({
            name: 'cliente',
            lifespan: 5,
            parameters: {
                'tipoconsumo': tipoconsumo,
            }
        });

    }


    async function SLCob(agent) {
        let contexto = agent.context.get('contrato').parameters
        let contrato = contexto.contrato
        let contexto2 = agent.context.get('cliente').parameters
        let cliente = contexto2.cliente
        let parametros = agent.parameters
        console.log(parametros.distancia)
        if (parametros.distancia == "lejos" && parametros.estado == "menos") {
            let solucionado = false;
            let motivo = "sin motivo"
            await reportes.create({
                cliente_id: cliente.cliente_id,
                contrato_id: contrato.contrato_id,
                requerimiento: requerimiento,
                motivo: motivo,
                solucionado: solucionado
            }).then(function(insertedReport) {
                console.log(insertedReport.dataValues)
            })
        } else if (parametros.distancia == "lejos" && parametros.verbo == "estar" &&
            negativo) {
            let solucionado = false;
            let motivo = "sin motivo"
            await reportes.create({
                cliente_id: cliente.cliente_id,
                contrato_id: contrato.contrato_id,
                requerimiento: requerimiento,
                motivo: motivo,
                solucionado: solucionado
            }).then(function(insertedReport) {
                console.log(insertedReport.dataValues)
            })
        } else if (parametros.distancia == "cerca") {
            let solucionado = false;
            let motivo = "sin motivo"
            await reportes.create({
                cliente_id: cliente.cliente_id,
                contrato_id: contrato.contrato_id,
                requerimiento: requerimiento,
                motivo: motivo,
                solucionado: solucionado
            }).then(function(insertedReport) {
                console.log(insertedReport.dataValues)
            })
            agent.add("Lo siento no detecté fallas. Por favor contáctese al  o acerquese a las oficinas mas cercanas")
        } else {
            agent.add("La distancia desde la cual se esta conectando no es la" +
                " apropiada, por favor acérquese al router ");
            let solucionado = true;
            let motivo = "Cobertura"
            await reportes.create({
                cliente_id: cliente.cliente_id,
                contrato_id: contrato.contrato_id,
                requerimiento: requerimiento,
                motivo: motivo,
                solucionado: solucionado
            }).then(function(insertedReport) {
                console.log(insertedReport.dataValues)
            })
        }
        agent.context.set({
            name: 'Comprobar servicio',
            lifespan: 1
        });

    }


    async function SinServicio(agent) {
        let contexto = agent.context.get('contrato').parameters
        let contexto2 = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let cliente = contexto2.cliente
        let plan;
        let antena;
        let caja;
        let equipo;
        let requerimiento;
        let motivo;
        requerimiento = 'Sin Servicio'
        try {
            plan = await planes.findOne({
                raw: true,
                attributes: ['megas'],
                where: {
                    plan_id: contrato.plan_id
                }
            }).then(console.log(plan))
        } catch (e) {
            console.log(e)
        }
        if (plan.megas == '10') {
            try {

                equipo = await equipos.findOne({
                    raw: true,
                    where: {
                        contrato_id: contrato.contrato_id
                    }
                }).then(console.log(equipo));
                antena = await antenas.findOne({
                    raw: true,
                    attributes: ['estado'],
                    where: { antena_id: equipo.antena_id }
                }).then(console.log(antena))
            } catch (e) {
                console.log(e)
            }
            switch (contrato.estado) {
                case true:
                    if (antena.estado == true) {
                        if (equipo.estado == true) {
                            motivo = "Router Inhibido"
                            agent.add('Por favor verifique que esté debidamente conectado a la red o pruebe con algun otro dispositivo')
                            agent.context.set({
                                name: 'Comprobarservicio',
                                lifespan: 1,
                            });
                            agent.context.set({
                                name: 'requerimiento',
                                lifespan: 5,
                                parameters: {
                                    'requerimiento': requerimiento,
                                    'motivo': motivo
                                }
                            });
                            agent.context.delete("SinServicio-followup");

                        } else {
                            agent.add("Router")
                            agent.setContext({ 'name': 'reset', 'lifespan': '1' });
                            agent.setFollowupEvent('get_routerreset');
                        }

                    } else {
                        agent.add('Mil disculpas estimad@ hay un problema a nivel general. Se resolverá en brevedad posible')
                    }
                    break;
                default:
                    agent.add("Lo sentimos al momento su contrato esta suspendido. Consulte sus facturas para mas información")
                    break;
            }

        } else {
            try {
                equipo = await equipos.findOne({
                        raw: true,
                        where: {
                            contrato_id: contrato.contrato_id
                        }
                    }),
                    caja = await cajas.findOne({
                        raw: true,
                        attributes: ['estado', 'potencia'],
                        where: { caja_id: equipo.caja_id }
                    })
            } catch (e) {
                console.log(e)
                agent.clearOutgoingContexts();
            }
            switch (contrato.estado) {
                case true:
                    if (caja.estado == true) {
                        if (equipo.potencia == 0) {
                            agent.add("Presenta una luz roja encendida en el equipo")
                            agent.context.delete("Comprobarservicio");
                        } else if (equipo.estado == true) {
                            motivo = "Equipo Inhibido"
                            agent.add('Por favor pruebe con otro dispositivo o reinicie el router')
                            agent.context.set({
                                name: 'Comprobarservicio',
                                lifespan: 15,
                            });
                            agent.context.set({
                                name: 'requerimiento',
                                lifespan: 5,
                                parameters: {
                                    'requerimiento': requerimiento,
                                    'motivo': motivo
                                }
                            });
                            agent.context.delete("SinServicio-followup");

                        } else {
                            agent.add("Router")
                            agent.setContext({ 'name': 'reset', 'lifespan': '1' });
                            agent.setFollowupEvent('get_routerreset');
                        }
                    } else {
                        agent.add('Mil disculpas estimad@ hay un problema a nivel general. Se resolverá en brevedad posible')
                        let motivo = "Mantenimiento";
                        let solucionado = true;
                        await reportes.create({
                            cliente_id: cliente.cliente_id,
                            contrato_id: contrato.contrato_id,
                            requerimiento: requerimiento,
                            motivo: motivo,
                            solucionado: solucionado
                        }).then(function(insertedReport) {
                            console.log(insertedReport.dataValues)
                        })
                    }
                default:
                    agent.add("Lo sentimos al momento su contrato esta suspendido. Consulte sus facturas para mas información")
                    break;
            }
        }
        agent.context.set({
            name: 'requerimiento',
            lifespan: 15,
            parameters: {
                'requerimiento': 'Servicio Lento'
            }
        });

    }

    function LuzRoja(agent) {
        let requerimiento = "Sin Servicio"
        let motivo = "Luz Roja"
        agent.add("Por favor desconecte el equipo de la corriente" +
            "y desconecte el cable amarillo atras del router." +
            "Luego de unos segundos reconectelos y valide si desaparece la luz roja")
        agent.context.set({
            name: 'requerimiento',
            lifespan: 15,
            parameters: {
                'requerimiento': requerimiento,
                'motivo': motivo
            }
        });
    }

    function SSluzroja(agent) {
        agent.add("Router")
        agent.setContext({ 'name': 'reset', 'lifespan': '1' });
        agent.setFollowupEvent('get_luzroja');
    }


    function SLsincliente(agent) {
        requerimiento = "Servicio Lento"
        agent.add(`Entiendo que tiene problemas con su servicio, por favor indiqueme su cédula para ayudarle`);
    }

    function fallback(agent) {
        agent.add(`Disculpe tengo que escalar su caso. Para mas información contáctese al 1700 439-439`);
    }

    function currentlyOpen() {
        // Get current datetime with proper timezone
        let date = new Date();
        date.setHours(date.getHours() + parseInt(timeZoneOffset.split(':')[0]));
        date.setMinutes(date.getMinutes() + parseInt(timeZoneOffset.split(':')[0][0] + timeZoneOffset.split(':')[1]));

        return date.getDay() >= 1 &&
            date.getDay() <= 6 &&
            date.getHours() >= 8 &&
            date.getHours() <= 18;
    }

    async function hoursHandler(agent) {
        let contexto = agent.context.get('cliente').parameters
        let cliente = contexto.cliente
        let contrato = contexto.contrato
        if (currentlyOpen()) {
            agent.add('Estamos atendiendo en las oficinas de 8 AM a 6 PM');

        } else {
            agent.add('Las oficinas se encuentran cerradas en este momento pero abren de Lunes a Sabado a las 8 AM');
        }
        let requerimiento = "Consulta de horarios"
        await reportes.create({
            cliente_id: cliente.cliente_id,
            contrato_id: contrato.contrato_id,
            requerimiento: requerimiento,
            motivo: contexto.motivo,
            solucionado: contexto.solucionado
        }).then(function(insertedReport) {
            console.log(insertedReport.dataValues)
        })
    }
    async function ConsultarDeuda(agent) {
        try {
            let contexto = agent.context.get('cliente').parameters
                //    let contexto2 = agent.context.get('cliente').parameters
            let contrato = contexto.contrato
            let cliente = contexto.cliente
            console.log(contrato.contrato_id)
            let factura;
            //  let cliente = contexto2.cliente
            factura = await facturas.findAll({
                raw: true,
                where: { contrato_id: contrato.contrato_id, estado: true }
            })
            let total = 0;
            factura.forEach(factura => {
                total = parseFloat(total) + (parseFloat(factura.subtotal) * parseFloat(factura.iva)) - parseFloat(factura.descuento);
            });
            agent.add(`Su deuda total es de:  ${total.toFixed(2)}`);
            let requerimiento = "Consulta de deuda";
            let motivo = "Pagar deuda";
            let solucionado = true;
            await reportes.create({
                cliente_id: cliente.cliente_id,
                contrato_id: contrato.contrato_id,
                requerimiento: requerimiento,
                motivo: motivo,
                solucionado: solucionado
            }).then(function(insertedReport) {
                console.log(insertedReport.dataValues)
            })

        } catch (e) {
            console.log(e)
        }
    }

    async function VerificarParametros(agent) {
        let contexto = agent.context.get('cliente').parameters
        let dispositivos = contexto.equipo.dispositivos
        let tipoconsumo = contexto.tipoconsumo
        let cobertura = contexto.cobertura
        agent.add("Dejeme ver si le entendí: tiene conectados " + dispositivos +
            " dispositivos, utilizando " + tipoconsumo +
            " y esta relativamente " + cobertura + " del router, correcto?");
        agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });
    }


    async function EscalaroFinalizar(agent) {
        let solucionado;
        if (resp.Problemas) {
            agent.add("Por favor comuniquese al 1700 439-439 o acerquese a las oficinas mas cercanas y un asesor le atenderá.");
            Finalizarsi(agent);
        } else if (resp.Resuelto) {
            solucionado = true
            agent.add('¿Algo mas en lo que pueda servirle?');
            agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });
        } else {
            agent.add("Disculpe no le entendí.¿El servicio de internet quedó bien o mal?");
            agent.setContext({ 'name': 'escalar', 'lifespan': '1' });
        }

    }

    function ProblemasTVgeneral(agent) {
        agent.add('Some dummy text');
        agent.setContext({ 'name': 'requerimiento', 'lifespan': '1' });
        agent.setFollowupEvent('get_serviciolento');
    }


    async function ConsultaTicket(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let ticket;
        try {
            ticket = await tickets.findAll({
                raw: true,
                where: {
                    contrato_id: contrato.contrato_id
                }
            })
            if (ticket != null) {
                ticket.forEach(ticket => {
                    agent.add(`Tiene visita por ${ ticket.descripcion} programada para el: ${ ticket.fechaatencion }`)
                })
                agent.add("¿Algo mas en lo que pueda servirle?")
                agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
            } else {
                agent.add("No tiene visita programada. Por favor contáctese al 1700 439-439 para solicitar asistencia")
                Finalizarsi(agent);
            }

        } catch (err) {
            console.log(err)
        }
    }

    async function ClaveCambiada(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let nuevaclave = ""
        let re = /^(?=.*\d)(?=.*[!@#$%^&*?])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
        nuevaclave = agent.parameters.clave
        if (re.test(nuevaclave)) {
            await equipos.update({
                contraseña: nuevaclave
            }, {
                where: {
                    contrato_id: contrato.contrato_id
                }
            })
            agent.add('Tu contraseña ha sido cambiada con éxito a ' + nuevaclave);
            let requerimiento = "Cambio de clave"
            let motivo = "Dispositivos"
            let solucionado = true;
            agent.context.set({
                name: 'cliente',
                lifespan: 15,
                parameters: {
                    'requerimiento': requerimiento,
                    'motivo': motivo,
                    'solucionado': solucionado
                }
            });
        } else {
            agent.add('Por favor ingrese una clave con al menos 8 digitos, una letra minuscula, una mayuscula y un caracter especial');
            agent.setContext({ 'name': 'cambioclave', 'lifespan': '1' });
        }
        agent.add("¿Algo mas en lo que pueda servirle?")
        agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
    }

    async function Finalizarsi(agent) {
        try {
            let contexto = agent.context.get('cliente').parameters
            let cliente = contexto.cliente
            let contrato = contexto.contrato
            let requerimiento = contexto.requerimiento
            let motivo = contexto.motivo
            let solucionado = contexto.solucionado
            await reportes.create({
                cliente_id: cliente.cliente_id,
                contrato_id: contrato.contrato_id,
                requerimiento: requerimiento,
                motivo: motivo,
                solucionado: solucionado
            }).then(function(insertedReport) {
                console.log(insertedReport.dataValues)
            })
            agent.add("Un placer atenderla que tenga un excelente día")
        } catch (e) {
            console.log(e)
        }
    }
    async function Finalizarno(agent) {
        await reportes.create({
            cliente_id: cliente.cliente_id,
            contrato_id: contrato.contrato_id,
            requerimiento: requerimiento,
            motivo: motivo,
            solucionado: solucionado
        }).then(function(insertedReport) {
            console.log(insertedReport.dataValues)
        })
        agent.add("Por favor indiqueme su requerimiento")
    }


    let intentMap = new Map();
    intentMap.set('Saludo', Saludo);
    intentMap.set('Ingresar Cédula', IngresarCedula);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('ValidarCliente', ValidarCliente);
    intentMap.set('ValidarCliente.si', ValidarClientesi);
    intentMap.set('ValidarClientesi.fb', ValidarClientesifb);
    intentMap.set('ValidarContrato', ValidarContrato);
    intentMap.set('VerificarParametros', VerificarParametros);
    intentMap.set('EspecificarContrato', EspecificarContrato);
    intentMap.set('ProblemasTV.general', ProblemasTVgeneral);
    intentMap.set('SLDisp', SLDisp);
    intentMap.set('SLCobertura', SLCob);
    intentMap.set('SLConsumo', SLConsumo);
    intentMap.set('ServicioLento', Serviciolento);
    intentMap.set('SinServicio', SinServicio);
    intentMap.set('Horarios', hoursHandler);
    intentMap.set('ConsultarDeuda', ConsultarDeuda);
    intentMap.set('EscalaroFinalizar', EscalaroFinalizar);
    intentMap.set('Clavecambiada', ClaveCambiada);
    intentMap.set('ConsultaTicket', ConsultaTicket);
    intentMap.set('SinServicio.luzrojasi', SSluzroja);
    intentMap.set('LuzRoja', LuzRoja);
    intentMap.set('Salir', Salir);
    intentMap.set('Finalizarsi', Finalizarsi);
    intentMap.set('Finalizarno', Finalizarno);

    agent.handleRequest(intentMap);

})

//arrancamos el servidor
app.listen(PORT, () => {
    console.log(`Our app is running on port ${ PORT }`);
})