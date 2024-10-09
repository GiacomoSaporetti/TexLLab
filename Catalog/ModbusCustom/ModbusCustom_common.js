// queste funzioni/classi sono in un file _common.js di cui viene fatto #include perchè usate anche da 
// dispositivi "quasi-ModbusCustom" tipo i multi-zona !

var MODBUSFUNC_READCOIL = 1
var MODBUSFUNC_READINPUTSTATUS = 2
var MODBUSFUNC_READHOLDINGREG = 3
var MODBUSFUNC_READINPUTREG = 4
var MODBUSFUNC_WRITESINGLECOIL = 5
var MODBUSFUNC_WRITESINGLEREG = 6
var MODBUSFUNC_WRITEMULTIPLECOILS = 15
var MODBUSFUNC_WRITEMULTIPLEREGS = 16

//Costanti per size massimo 
var MAX_SIZE_BIT = 2000
/* TODO: gestire configurazione per AlModbusRTU */
var MAX_SIZE_REGISTERS = 120  // la specifica modbus è 125... c'è un motivo nello slave LLExec per cui è 120...?


// ------------------------------------ messaggio modbus -------------------------------
function CModbusMsg(turnAround, timeout, maxMsgMappings, maxMsgSizeReg, maxMsgSizeBit)
{
	this.pollTime = null  // ereditato dalla prima variabile
	this.turnAround = turnAround
	this.tmo = timeout
	this.maxMsgMappings = maxMsgMappings
	this.maxMsgSizeReg = maxMsgSizeReg
	this.maxMsgSizeBit = maxMsgSizeBit
	// elenco di CModbusVar
	this.vars = []
	this.oneshot = null //ereditato dalla prima variabile
	this.writeFirst = null //ereditato dalla prima variabile
}

CModbusMsg.prototype.CanAdd = function(curVar)
{
	if (this.vars.length == 0)
		return true
		
	if (this.funcode == MODBUSFUNC_READHOLDINGREG || this.funcode == MODBUSFUNC_READINPUTREG || this.funcode == MODBUSFUNC_WRITEMULTIPLEREGS || this.funcode == MODBUSFUNC_WRITESINGLEREG)
		var maxSize = this.maxMsgSizeReg
	else
		var maxSize = this.maxMsgSizeBit
	
	// la nuova variabile deve essere contigua e la dimensione totale sufficiente, oppure già inclusa nel msg attuale
	var sizeok = (this.addr + this.size == curVar.addr && this.size + curVar.size <= maxSize) ||
				 (this.addr <= curVar.addr && curVar.addr < this.addr + this.size)
	
	// la funzione deve coincidere, il num di mappature deve essere < del max del master, il tempo di polling uguale, il oneshot uguale
	var result = curVar.isInOut == false &&
				 curVar.funcode == this.funcode && 
				 this.vars.length + 1 <= this.maxMsgMappings &&
				 this.pollTime == curVar.pollTime &&
				 sizeok && 
				 this.oneshot == curVar.oneshot &&
				 this.writeFirst == curVar.writeFirst
				 
	return result
}

CModbusMsg.prototype.Add = function(curVar, allowUnassigned)
{
	if (this.vars.length == 0)
	{
		if (!curVar.db && !allowUnassigned)
		{
			msg = genfuncs.FormatMsg(app.Translate("Parameter %1 must be assigned (it is the first of the Modbus message)"), curVar.addr)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetModbusRTUCfg", msg, app.CallFunction("common.SplitFieldPath", curVar.node))
		}
		
		// prima variabile, inizializza i dati generici del messaggio
		this.funcode = curVar.funcode
		this.addr = curVar.addr
		this.size = curVar.size
		this.pollTime = curVar.pollTime
		this.isInOut = curVar.isInOut
		this.oneshot = curVar.oneshot		//	valorizzato solo se isInOut false
		this.writeFirst = curVar.writeFirst	//	valorizzato solo se isInOut true
	}
	else
	{
		// incrementa dimensione totale messaggio se variabile NON già contenuta nel msg
		if (!(this.addr <= curVar.addr && curVar.addr < this.addr + this.size))
			this.size += curVar.size
	}
	
/*	if (curVar.db)
		// se la variabile è assegnata la aggiunge all'elenco, altrimenti verrà solo incrementata la dimensione del msg
		this.vars.push(curVar)  */
		
	// aggiunge sempre la variabile alla lista, se non è mappata l'errore sarà intercettato dopo
	this.vars.push(curVar)
}


// ------------------------------------ singola variabile modbus -------------------------------
function CModbusVar(node, parMap, usedVars, addressOffset, pos)
{
	var ipa = parseInt(GetNode(node, "ioObject/@objectIndex"))
	var inout = GetNode(node, "ioObject/@inout")
	var label = GetNode(node, "label")
	
	if (inout == "in" && label)
	{
		// per le input verifica la non duplicazione della variabile destinazione
		if (usedVars[label])
		{
			var err = app.CallFunction("common.SplitFieldPath", node)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetModbusRTUCfg", app.Translate("Duplicate destination variabile: ") + label, err)
		}
		else
			usedVars[label] = true
	}
	
	var par = parMap[ipa]
	if (!par)
	{
		var err = app.CallFunction("common.SplitFieldPath", node)
		throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetModbusRTUCfg", app.Translate("Invalid parameter, address ") + ipa, err)
	}

	// attributo realReadOnly per gestire quei device che hanno parametri readonly che però devono essere letti con i comandi modbus
	// per i parametri normali (es. uso "read holding reg" anche se ci vorrebbe "read input reg" essendo r/o) : ADV20,ADV50
	if (par.realReadOnly != undefined && par.realReadOnly != "")
		var ro = genfuncs.ParseBoolean(par.realReadOnly)
	else
		var ro = par.readOnly
		
	this.addr = par.commIndex + addressOffset;
	this.funcode = GetModbusFunction(inout, par.type, ro)
	this.size = app.CallFunction("parameters.GetModbusAddressSize", par.type)
	this.db = GetNode(node, "dataBlock")
	this.dbt = GetNode(node, "type")
	this.label = GetNode(node, "label")
	this.pollTime = parseInt(GetNode(node, "pollTime"))
	this.bit = parseInt(GetNode(node, "ioObject/@PDOStartBit"))
	var inout = GetNode(node, "ioObject/@inout")
	if ( inout == "inOut" )
	{
		this.isInOut = true		
		this.writeFirst = parseInt(GetNode(node, "writeFirst"))
		this.oneshot = null
	}
	else
	{
		this.isInOut = false		
		this.writeFirst = null		
		this.oneshot = GetNode(node, "oneshot")
	}
	this.pos = pos
	this.objectName = par.name;
	this.objectType = GetNode(node, "ioObject/@objtype");
	
	this.node = node
}

function GetModbusSendParams(device, parMap, xpath, addressOffset)
{
	var result = []
	
	var nodelist = device.selectNodes(xpath)
	var node
	while (node = nodelist.nextNode())
	{
		var enabledNode = node.selectSingleNode("enabled");
		if (enabledNode)
			if (!genfuncs.ParseBoolean(enabledNode.text))
				continue;
		
		var ipa = parseInt(GetNode(node, "address"))
		var par = parMap[ipa]
		if (!par)
		{
			var err = app.CallFunction("common.SplitFieldPath", node)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetModbusSendParams", app.Translate("Invalid parameter, address ") + ipa, err)
		}

		var item = {}
		item.addr = par.commIndex + addressOffset;
		item.type = par.typeIEC
		item.value = parseFloat(GetNode(node, "value"))
		item.tmo = parseInt(GetNode(node, "timeout"))
		item.node = node
		item.parName = par.name;
		
		result.push(item)
	}
	
	return result
}

function GetModbusFunction(inout, type, readOnly)
{
	switch (type)
	{
		case "digitalInput":
			if (inout == "in")
				return MODBUSFUNC_READINPUTSTATUS
			else
				return null    // output non valido per i digitalInput !
			
		case "digitalOutput":
			if (inout == "in")
				return MODBUSFUNC_READCOIL
			else
				// usa sempre la write multiple, anche solo per 1 registro
				return MODBUSFUNC_WRITEMULTIPLECOILS   // si suppone che ovviamente il digitalOutput NON sia readonly !
					
		case "boolean":
		case "char":
		case "unsignedChar":
		case "short":
		case "unsignedShort":
			if (inout == "in" && readOnly)
				return MODBUSFUNC_READINPUTREG
			else if (inout == "in" && !readOnly)
				return MODBUSFUNC_READHOLDINGREG
			else if ((inout == "out" || inout == "inOut") && !readOnly)
				// usa sempre la write multiple, anche solo per 1 registro
				return MODBUSFUNC_WRITEMULTIPLEREGS
			else
				return null
			
		case "float":
		case "int":
		case "unsignedInt":
			if (inout == "in" && readOnly)
				return MODBUSFUNC_READINPUTREG
			else if (inout == "in" && !readOnly)
				return MODBUSFUNC_READHOLDINGREG
			else if ((inout == "out" || inout == "inOut") && !readOnly)
				return MODBUSFUNC_WRITEMULTIPLEREGS
			else
				return null
	}
}