// -----> cercare e controllare tutte le occorrenze di "TODO_NEWTARGET" in questo file !


// TODO_NEWTARGET : abilitazione selettiva funzionalità dei plugins con flags
// TODO_NEWTARGET : andare poi nel PCT e togliere/commentare le parti non necessarie in base a questi stessi flag (presenti come commenti)
var USE_LOCALIO = true
var USE_DATABASE = true
var USE_CONFIGURATOR = false
var USE_MODBUSRTU_MASTER = false
var USE_MODBUSTCP_MASTER = true
var USE_MODBUSRTU_SLAVE = false
var USE_CANOPEN_MASTER = false
var USE_CANOPEN_SLAVE = false
var USE_CANOPEN_SLAVE_OD = false	//	requires USE_CANOPEN_SLAVE
var USE_LLSYMBOLSSERVER = false
var USE_ETHERCAT_MASTER = false
var USE_MQTT = false
var USE_MOTION = false
var USE_WEBSERVER = false

function Init(p)
{
	return Init_Common(p)
}

#include PowerXXX.js