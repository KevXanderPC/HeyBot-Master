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
const planes = require('./database/models/Plan');
const antenas = require('./database/models/Antena');
const cajas = require('./database/models/Fibra');
const equipos = require('./database/models/Equipo');
const reportes = require('./database/models/Reporte');
const tickets = require('./database/models/Ticket');
const facturas = require('./database/models/Factura');
const { exists } = require('fs');
//database
db.sync()
    .then(() => console.log('Conectado al servidor'))
    .catch(error => console.log(error));

//setting 
var PORT = process.env.PORT || 3000;
var maybe_port = process.env.PORT || 3000;
if (typeof maybe_port === "number") {
    port = maybe_port;
}
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
        var possibleResponse = [
            'Para comenzar por favor brindeme el número de cédula del cliente',
            'Como primer paso ayúdeme facilitandome el número de cédula del cliente por favor'
        ];
        var pick = Math.floor(Math.random() * possibleResponse.length);
        var response = possibleResponse[pick];
        agent.add(response);

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
                `Confírmeme que se trata del cliente ${cliente.nombre}`,
                `Con el cliente ${cliente.nombre} ¿cierto? `
            ];
            var pick = Math.floor(Math.random() * possibleResponse.length);
            var response = possibleResponse[pick];
            agent.add(response);
            agent.context.delete("vcfu");
        }
        agent.context.set({
            name: 'cliente',
            lifespan: 20,
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
        let nombre = contexto.cliente.nombre;
        var possibleResponse = [
            `No le entendí. ¿Es usted el cliente ` + nombre + ` correcto?`,
            "Por favor, indíqueme si se trata o no del cliente " + nombre + "",
            "Disculpe, necesito confirmar que se trata del cliente " + nombre + ""
        ];
        var pick = Math.floor(Math.random() * possibleResponse.length);
        var response = possibleResponse[pick];
        agent.add(response);
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
                },
            }).then(console.log(contrato))

            if (contrato == "") {
                agent.add(`No existe un contrato asociado al número de cédula`)
                agent.add('¿Desea proporcionar otro número de cédula?')

            } else {
                if (contrato.length >= 2) {
                    var possibleResponse = [
                        `¿Cuál de estas direcciones es a la que se refiere?`,
                        'Por favor facilíteme la dirección del contrato a validar',
                        'Verifico que tiene diferentes contratos. Especifiqueme la dirección por favor'
                    ];
                    var pick = Math.floor(Math.random() * possibleResponse.length);
                    var response = possibleResponse[pick];
                    agent.add(response);
                    contrato.forEach(contrato => {
                        agent.add(`${contrato.direccion}`)
                    });
                    agent.context.set({
                        name: 'cliente',
                        lifespan: 2,
                        parameters: {
                            'contrato': contrato,
                        }
                    });
                    agent.context.set({
                        name: 'clientevalidado',
                        lifespan: 1
                    });
                    agent.context.delete("vcsifu");
                    agent.context.delete("validarclientesi-followup");

                } else {
                    contrato = await contratos.findOne({ where: { cliente_id: cliente.cliente_id } }).then(console.log(contrato));
                    agent.context.set({
                        name: 'cliente',
                        lifespan: 15,
                        parameters: {
                            'contrato': contrato
                        }
                    });
                    PedirRequerimiento(agent);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }
    async function EspecificarContrato(agent) {
        let contexto = agent.context.get('cliente').parameters
        let cliente = contexto.cliente
        let contrato;
        let direccion;
        direccion = agent.parameters.direccion
        console.log(direccion)
        try {
            contrato = await contratos.findOne({
                where: {
                    cliente_id: cliente.cliente_id,
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
                    'contrato': contrato
                }
            });
            PedirRequerimiento(agent);
        }

    }

    async function PedirRequerimiento(agent) {
        agent.add(`Indíqueme su requrimiento por favor`);
        agent.context.set({
            name: 'requerimiento',
            lifespan: 1,
        });
    }
    async function ServicioIntermitente(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let tiempo = ""
        let tiempowan = ""
        try {
            plan = await planes.findOne({
                raw: true,
                attributes: ['megas'],
                where: {
                    plan_id: contrato.plan_id
                }
            })
            equipo = await equipos.findOne({
                raw: true,
                where: {
                    contrato_id: contrato.contrato_id
                }
            })
        } catch (e) {
            console.log(e);
        }
        if (plan.megas !== '10') {
            try {
                caja = await cajas.findOne({
                    raw: true,
                    where: {
                        caja_id: equipo.caja_id
                    }
                })
            } catch (e) {
                console.log(e);
                agent.clearOutgoingContexts();
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

    }

    async function Serviciolento(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let atenuacion;
        let plan;
        let equipo;
        let caja;
        let motivo;
        let solucionado;
        let requerimiento = 'Servicio Lento'
        try {
            plan = await planes.findOne({
                raw: true,
                attributes: ['megas'],
                where: {
                    plan_id: contrato.plan_id
                }
            })
            equipo = await equipos.findOne({
                raw: true,
                where: {
                    contrato_id: contrato.contrato_id
                }
            })
        } catch (e) {
            console.log(e);
        }
        console.log(plan.megas)
        if (plan.megas != '10') {
            try {
                caja = await cajas.findOne({
                    attributes: ['potencia'],
                    raw: true,
                    where: {
                        caja_id: equipo.caja_id
                    }
                })
                atenuacion = caja.potencia - equipo.potencia
                if (atenuacion >= 5) {
                    agent.add('Tiene la potencia del equipo elevada. Contactese a este numero para pedir ticket de atención')
                    motivo = "Potencia Elevada";
                    solucionado = true
                    SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                    agent.context.set({
                        name: 'finalizar',
                        lifespan: 1,
                    });
                } else {
                    var possibleResponse = [
                        "¿Tiene el servicio lento en algun dispositivo en especifico o en todos por igual?",
                        "¿El problema es solo con un dispositivo o es con todos por igual?",
                        '¿Tiene servicio lento en todos los dispositivoso o solo en uno de ellos?'
                    ];
                    var pick = Math.floor(Math.random() * possibleResponse.length);
                    var response = possibleResponse[pick];
                    agent.add(response);
                }
            } catch (e) {
                console.log(e);
                agent.clearOutgoingContexts();
            }

        } else {
            try {
                if (equipo.señal <= -68) {
                    agent.add('Tiene parámetros deficientes en la antena. Contáctese al 1700 439-439')
                    motivo = "Parámetros deficientes";
                    solucionado = true
                    SendReport(cliente, contrato, requerimiento, motivo, solucionado)
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
            }
        });

    }



    async function SLDisp(agent) {
        let dispositivos = agent.parameters.cantidad
        let contexto = agent.context.get('cliente').parameters
        let dispositivossistema = contexto.equipo.dispositivos
        console.log(contexto)
        if (parseInt(dispositivos) < parseInt(dispositivossistema)) {
            agent.add("Según el sistema, tiene conectado " + dispositivossistema + " dispositivos en su red. ¿Son todos de su propiedad?")
            agent.setContext({ 'name': 'sldispfu', 'lifespan': '1' });
        } else {
            agent.add("Por favor digame en que aplicación o plataforma se le pone lento.")
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
            let solucionado = true
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
        } else {
            agent.add("Por favor indíqueme,¿A cuántos metros del router se esta conectando?")
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
        let contexto = agent.context.get('cliente').parameters
        let cliente = contexto.cliente
        let contrato = contexto.contrato
        let requerimiento = contexto.requerimiento
        let motivo = contexto.motivo
        let parametros = agent.parameters
        let solucionado = contexto.solucionado
        console.log(parametros.distancia)
        if (parametros.distancia == "lejos" && parametros.estado == "menos") {
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.add("Lo siento no detecté fallas. Por favor contáctese al 1700 439-439")
            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
        } else if (parametros.distancia == "lejos" && parametros.verbo == "estar" &&
            negativo) {
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.add("Lo siento no detecté fallas. Por favor contáctese al 1700 439-439")
            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
        } else if (parametros.distancia == "cerca") {
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.add("Lo siento no detecté fallas. Por favor contáctese al 1700 439-439")
            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });

        } else {
            let motivo = "Cobertura"
            agent.add("El equipo le cubre máximo 10 metros cuadrados, acérquese más a su equipo por favor")
            agent.setContext({ name: 'comprobarservicio', lifespan: '1' })
        }
        agent.setContext({
            name: 'cliente',
            lifespan: '15',
            parameters: {
                'motivo': motivo
            }
        });

    }

    function Cobertura(agent) {

    }

    async function SinServicio(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let cliente = contexto.cliente
        let plan;
        let antena;
        let caja;
        let equipo;
        let motivo;
        let solucionado;
        let requerimiento = "Sin Servicio"
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
                        if (equipo.señal <= -68) {
                            agent.add('Tiene parámetros deficientes en la antena. Contáctese al 1700 439-439')
                            motivo = "Parámetros deficientes";
                            solucionado = true
                            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                            agent.context.set({
                                name: 'finalizar',
                                lifespan: 1,
                            });
                        } else if (equipo.estado == true) {
                            motivo = "Router Inhibido"
                            agent.add('Por favor pruebe con algun otro dispositivo o reinicie el equipo')
                            agent.context.set({
                                name: 'Comprobarservicio',
                                lifespan: 1,
                            });
                            agent.context.delete("SinServicio-followup");
                        } else {
                            agent.add("Router")
                            agent.setContext({ 'name': 'reset', 'lifespan': '1' });
                            agent.setFollowupEvent('get_routerreset');
                        }

                    } else {
                        agent.add('Mil disculpas estimad@ hay un problema a nivel general. Se resolverá en brevedad posible')
                        let motivo = "Mantenimiento"
                        let solucionado = true
                        SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                    }
                    break;
                default:
                    agent.add("Lo sentimos al momento su contrato esta suspendido. Contáctese al 1700 439-439")
                    motivo = "Suspendido"
                    solucionado = true
                    agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
                    SendReport(cliente, contrato, requerimiento, motivo, solucionado)
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
                            agent.add("¿Presenta una luz roja encendida en el equipo?");
                        } else if (equipo.estado == true) {
                            motivo = "Equipo Inhibido"
                            agent.add('Por favor pruebe con otro dispositivo o reinicie el router')
                            agent.context.set({
                                name: 'Comprobarservicio',
                                lifespan: 15,
                            });
                            agent.context.delete("SinServicio-followup");
                        } else if (equipo.estado == false) {
                            agent.add("Lo sentimos al momento su contrato esta suspendido. Comuníquese al 1700 439-439")
                            motivo = "Suspendido"
                            solucionado = true;
                            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
                        } else {

                            agent.add("Router")
                            agent.setContext({ 'name': 'reset', 'lifespan': '1' });
                            agent.setFollowupEvent('get_routerreset');
                        }
                    } else {
                        agent.add('Mil disculpas estimad@ hay un problema a nivel general. Se resolverá en brevedad posible')
                        let motivo = "Mantenimiento";
                        let solucionado = true;
                        agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
                        SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                    }
            }
        }
        agent.setContext({
            name: 'cliente',
            lifespan: '15',
            parameters: {
                'motivo': motivo,
                'requerimiento': requerimiento
            }
        });


    }

    async function Preguntar(agent) {
        let resp = agent.parameters
        if (resp.Positivo) {
            agent.add('Digame. ¿En que mas le puedo servir?');
            agent.context.set({
                name: 'cliente',
                lifespan: 15,
            });
            agent.context.set({
                name: 'requerimiento',
                lifespan: 1,
            });
        } else if (resp.Negativo) {

            agent.add("Finalizar")
            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
            agent.setFollowupEvent('get_finalizar');
        } else {
            agent.add("Respondame con si o no por favor")
            agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });

        }

    }

    function SSluzrojasi(agent) {
        let motivo = "Luz Roja";
        agent.add("Por favor desconecte el equipo de la corriente y desconecte el cable amarillo atras del router. Luego de unos segundos reconectelos y verifique si desaparece la luz roja")
        agent.setContext({
            name: 'cliente',
            lifespan: '5',
            parameters: {
                'motivo': motivo
            }
        });
    }

    function LuzRoja(agent) {
        let motivo = "Luz Roja"
        agent.add("Por favor desconecte el equipo de la corriente y desconecte el cable amarillo atras del router. Luego de unos segundos reconectelos y verifique si desaparece la luz roja")
        agent.setContext({
            name: 'cliente',
            lifespan: '5',
            parameters: {
                'motivo': motivo
            }
        });
    }

    function SSluzrojano(agent) {
        let motivo = "Router Inhibido"
        agent.add("Por favor reinicie su router o desconectelo y vuelvalo a conectar de la corriente")
        agent.setContext({ 'name': 'reset', 'lifespan': '1' });
        agent.setContext({
            'name': 'cliente',
            'lifespan': '10',
            'parameters': {
                'motivo': motivo
            }
        });
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
        let motivo = ""
        let solucionado = true
        SendReport(cliente, contrato, requerimiento, motivo, solucionado)
    }
    async function ConsultarDeuda(agent) {
        try {
            let contexto = agent.context.get('cliente').parameters
            let contrato = contexto.contrato;
            let cliente = contexto.cliente;
            let motivo = contexto.motivo;
            let requerimiento = "Consulta de Deuda"
            let factura;
            factura = await facturas.findAll({
                raw: true,
                where: { contrato_id: contrato.contrato_id, estado: true }
            })
            let total = 0;
            factura.forEach(factura => {
                total = parseFloat(total) + (parseFloat(factura.subtotal) * parseFloat(factura.iva)) - parseFloat(factura.descuento);
            });
            agent.add(`Su deuda total es de:  ${total.toFixed(2)}`);
            let solucionado = true;
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.add('¿Algo mas en lo que pueda servirle?');
            agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });

        } catch (e) {
            console.log(e)
        }
    }
    async function CrearTicket(motivo, cliente, contrato) {
        await tickets.create({
            estado: false,
            fechaatencion: null,
            descripcion: motivo,
            cliente_id: cliente.cliente_id,
            contrato_id: contrato.contrato_id,
        }).then(function(insertedReport) {
            console.log(insertedReport.dataValues)
        })
    }


    async function SendReport(cliente, contrato, requerimiento, motivo, solucionado) {
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

    async function EscalaroPreguntar(agent) {
        let contexto = agent.context.get('cliente').parameters
        let contrato = contexto.contrato
        let cliente = contexto.cliente
        let requerimiento = contexto.requerimiento
        let motivo = contexto.motivo
        let solucionado = contexto.solucionado;
        let resp = agent.parameters
        let msg = "Lo siento debo escalar su caso. Por favor contáctese al  o acerquese a las oficinas mas cercanas"
        if (resp.Resuelto || resp.Negativo) {
            solucionado = true
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.add('¿Algo mas en lo que pueda servirle?');
            agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });
        } else
        if (resp.Problemas || resp.Positivo) {
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.setContext({ 'name': 'finalizar', 'lifespan': '1' });
            console.log(motivo)
            if (motivo == "Luz Roja" | motivo == "Parámetros Deficientes" | motivo == "Router Reset") {
                CrearTicket(motivo, cliente, contrato)
                msg = "Se creó un ticket para su problema. El tiempo de atención estimado es de 24 horas laborables"
            }
            agent.add(msg)
        } else {
            agent.add("Disculpe no le entendí.Respondame si o no");
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
        let cliente = contexto.cliente
        let contrato = contexto.contrato
        let requerimiento = "Consulta de Tickets"
        let motivo = contexto.motivo
        let solucionado = contexto.solucionado
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
                    ticketsinfecha(ticket, agent)
                })
                solucionado = true
                SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                agent.add("¿Algo mas en lo que pueda servirle?")
                agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });
            } else {
                solucionado = true
                SendReport(cliente, contrato, requerimiento, motivo, solucionado)
                agent.add("No tiene visita programada. Por favor contáctese al 1700 439-439")
                Finalizarsi(agent);
            }

        } catch (err) {
            console.log(err)
        }
    }

    function ticketsinfecha(ticket, agent) {
        let fecha = ticket.fechaatencion
        let msg = `Tiene visita por ${ ticket.descripcion} programada para: ${ fecha }`
        if (fecha == null) {
            msgf = `Su visita por ${ ticket.descripcion} esta aún en estado: Por Agendar `
        }
        agent.add(msg)
    }
    async function ClaveCambiada(agent) {
        let contexto = agent.context.get('cliente').parameters
        let cliente = contexto.cliente
        let contrato = contexto.contrato
        let requerimiento = "Cambio de clave"
        let motivo = contexto.motivo
        let solucionado = contexto.solucionado
        let nuevaclave = ""
        let re = /^(?=.*\d)(?=.*[!@#$%^&*?])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
        nuevaclave = agent.parameters.clave
        if (re.test(nuevaclave)) {
            try {
                await equipos.update({
                    contraseña: nuevaclave
                }, {
                    where: {
                        contrato_id: contrato.contrato_id
                    }
                })
            } catch (e) {
                console.log(e)
            }
            agent.add('Tu contraseña ha sido cambiada con éxito a ' + nuevaclave);
            solucionado = true;
            SendReport(cliente, contrato, requerimiento, motivo, solucionado)
            agent.add("¿Algo mas en lo que le pueda servir?")
            agent.setContext({ 'name': 'preguntar', 'lifespan': '1' });
        } else {
            agent.add('Por favor ingrese una clave con al menos 8 digitos, una letra minuscula, una mayuscula y un caracter especial');
            agent.setContext({ 'name': 'cambioclave', 'lifespan': '1' });
        }

    }

    async function Finalizarsi(agent) {
        try {
            agent.add("Un placer atenderla que tenga un excelente día")
        } catch (e) {
            console.log(e)
        }
    }
    async function Resetno(agent) {
        agent.add("Por favor reincicie su router o descoenctalo y vuelvalo a conectar a la corriente")
    }
    async function Reset(agent) {
        let motivo = "Router Reset"
        agent.add("Por favor utilize la aplicación de Hey! para configurar su router reset")
        agent.setContext({
            name: 'cliente',
            lifespan: '5',
            parameters: {
                'motivo': motivo
            }
        });
        agent.setContext({ 'name': 'comprobar servicio', 'lifespan': '1' });

    }

    let intentMap = new Map();
    intentMap.set('Saludo', Saludo);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('ValidarCliente', ValidarCliente);
    intentMap.set('ValidarCliente.si', ValidarClientesi);
    intentMap.set('ValidarClientesi.fb', ValidarClientesifb);
    intentMap.set('ValidarContrato', ValidarContrato);
    intentMap.set('EspecificarContrato', EspecificarContrato);
    intentMap.set('ProblemasTV.general', ProblemasTVgeneral);
    intentMap.set('SLDisp', SLDisp);
    intentMap.set('SLCobertura', SLCob);
    intentMap.set('SLConsumo', SLConsumo);
    intentMap.set('ServicioLento', Serviciolento);
    intentMap.set('SinServicio', SinServicio);
    intentMap.set('Horarios', hoursHandler);
    intentMap.set('ConsultarDeuda', ConsultarDeuda);
    intentMap.set('EscalaroPreguntar', EscalaroPreguntar);
    intentMap.set('Preguntar', Preguntar);
    intentMap.set('Clavecambiada', ClaveCambiada);
    intentMap.set('ConsultaTicket', ConsultaTicket);
    intentMap.set('LuzRoja', LuzRoja);
    intentMap.set('SinServicio.luzrojasi', SSluzrojasi);
    intentMap.set('SinServicio.luzrojano', SSluzrojano);
    intentMap.set('Finalizar', Finalizarsi);
    intentMap.set('Reset - no', Resetno);
    intentMap.set('Reset - yes', Reset);
    //Reset - yes

    agent.handleRequest(intentMap);

})

//arrancamos el servidor
app.listen(PORT, () => {
    console.log(`
                        Our app is running on port $ { PORT }
                        `);
})