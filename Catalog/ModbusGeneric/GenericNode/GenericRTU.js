// import funzioni da estensione common
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var ParseBoolean = genfuncs.ParseBoolean

	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1
var TREENAME = "tree1";

var MODBUSADDRESSTYPE = {
	MODBUS: 0,
	JBUS: 1
};

var SWAPWORDSMODE = {
	LITTLE_ENDIAN: 0,
	BIG_ENDIAN_DWORD_ONLY: 1,
	BIG_ENDIAN_REAL_ONLY: 2,
	BIG_ENDIAN_ALL: 3
};

var SLAVEADDRESSCONFIGMODE = {
	STATIC: 0,
	BY_VARIABLE_NAME: 1,
	BY_16BIT_KEY: 2,
	BY_32BIT_KEY: 4
};

function GetSlaveAddressConfigMode()
	{ return SLAVEADDRESSCONFIGMODE }

var MODBUS_ADDRESS_OFFSET = app.CallFunction("script.GetModbusAddressOffset");

var ADDRESSTYPE_MODBUS = "modbus";
var ADDRESSTYPE_JBUS = "jbus";


function Init(p)
{
	return 1
}

function UpgradeNode(device, oldversion)
{
	var xmldoc = app.GetXMLDocument();
	
	if (oldversion < 2.0)
	{
		// usa la vecchia impostazione globale per l'upgrade
		var parentNode = device.selectSingleNode("GenericRTU_config");
		newnode = xmldoc.createElement("addressType");
		newnode.text = (MODBUS_ADDRESS_OFFSET == MODBUSADDRESSTYPE.MODBUS) ? ADDRESSTYPE_MODBUS : ADDRESSTYPE_JBUS;
		parentNode.appendChild(newnode);
	}

	if (oldversion < 3.0)
	{
		// usa la vecchia impostazione globale per l'upgrade
		var parentNode = device.selectSingleNode("GenericRTU_config");
		newnode = xmldoc.createElement("swapWordsMode");
		newnode.text = SWAPWORDSMODE.LITTLE_ENDIAN;
		parentNode.appendChild(newnode);
	}
	
	if (oldversion < 4.0)
	{
		// usa la vecchia impostazione globale per l'upgrade
		var parentNode = device.selectSingleNode("GenericRTU_config");
		newnode = xmldoc.createElement("slaveAddressConfigMode");
		newnode.text = SLAVEADDRESSCONFIGMODE.STATIC;
		parentNode.appendChild(newnode);
		
		newnode = xmldoc.createElement("dynamicSlaveAddress");
		newnode.text = "";
		parentNode.appendChild(newnode);
	}
}

function OnCreateNode(device)
{
	// crea nodeNumber successivo libero con valore iniziale 1
	app.CallFunction("common.CreateUniqueSubNode", device, "*/nodeNumber", 1)
	
	var protocol = device.parentNode.getAttribute("protocol")
	if (protocol == "ModbusTCP_master")
		// se modbus tcp come address per default è 255
		SetNode(device, "*/modbusAddress", 255)
		
	// parte con il settaggio globale della suite
	device.selectSingleNode("GenericRTU_config/addressType").text = (MODBUS_ADDRESS_OFFSET == MODBUSADDRESSTYPE.MODBUS) ? ADDRESSTYPE_MODBUS : ADDRESSTYPE_JBUS;
}

function OnLoadNode(node)
{	
	//caricamento overlay icona per disabilitazione
	var enabled = node.getAttribute("enabled")
	
	if (enabled === null)
	{
		node.setAttribute("enabled", "1")
		enabled = true
	}
	else
		enabled = ParseBoolean(enabled)
	
	if (!enabled)
	{
		var datapath = app.GetDataPathFromNode(node)
		// mette overlay di disabilitazione (X rossa)
		app.HMISetOverlayImg(TREENAME, app.HMIGetElementPath(TREENAME, datapath), TREE_OVERLAY_DISABLED)
	}
	
	/*	aggiunta minPollTime */
	
	var STR_MINPOLLTIME = "minPollTime"
	
	var minPollTimeNode = node.selectSingleNode("GenericRTU_config/" + STR_MINPOLLTIME)
	if ( !minPollTimeNode )
	{
		var GenericRTU_configNode = node.selectSingleNode("GenericRTU_config")
		var minPollTimeNode = GenericRTU_configNode.appendChild(app.GetXMLDocument().createElement(STR_MINPOLLTIME))
		minPollTimeNode.text = "1"
		app.ModifiedFlag = true
	}
	
	/*	aggiunta slaveAddressConfigMode */
	
	var STR_SLAVEADDRESSINGMODE = "slaveAddressConfigMode"
	
	var slaveAddressingModeNode = node.selectSingleNode("GenericRTU_config/" + STR_SLAVEADDRESSINGMODE)
	if ( !slaveAddressingModeNode )
	{
		var GenericRTU_configNode = node.selectSingleNode("GenericRTU_config")
		var slaveAddressingModeNode = GenericRTU_configNode.appendChild(app.GetXMLDocument().createElement(STR_SLAVEADDRESSINGMODE))
		slaveAddressingModeNode.text = SLAVEADDRESSCONFIGMODE.STATIC
		app.ModifiedFlag = true
	}
	
	/*	aggiunta dynamicSlaveAddress */
	
	var STR_DYNAMICSLAVEADDRESS = "dynamicSlaveAddress"
	
	var dynamicSlaveAddressNode = node.selectSingleNode("GenericRTU_config/" + STR_DYNAMICSLAVEADDRESS)
	if ( !dynamicSlaveAddressNode )
	{
		var GenericRTU_configNode = node.selectSingleNode("GenericRTU_config")
		var dynamicSlaveAddressNode = GenericRTU_configNode.appendChild(app.GetXMLDocument().createElement(STR_DYNAMICSLAVEADDRESS))
		dynamicSlaveAddressNode.text = ""
		app.ModifiedFlag = true
	}
}

// ritorna la configurazione dello slave per la generazione dei settaggi del master
// per la struttura vedi GetModbusRTUCfg() in ModbusCustom.js 
function GetModbusRTUCfg(device, reqAddressType, allowUnassigned)
{
	// tipologia di configurazione richiesta dal master (modbus/jbus), per retrocompatibilità vecchi target è quella globale della suite
	if (reqAddressType === undefined)
		reqAddressType = MODBUS_ADDRESS_OFFSET;
	
	// tipologia dello slave corrente
	var devAddressType = (GetNode(device, "*/addressType") == ADDRESSTYPE_MODBUS) ? MODBUSADDRESSTYPE.MODBUS : MODBUSADDRESSTYPE.JBUS;
	
	// calcolo offset: se richiesto modbus e lo slave è jbus farà +1, se richiesto jbus e lo slave è modbus farà -1
	var addressOffset = devAddressType - reqAddressType;
	
	var result = {}
	result.name = device.getAttribute("caption");
	result.modbusAddress = parseInt(GetNode(device, "*/modbusAddress"))
	result.nodeNumber = parseInt(GetNode(device, "*/nodeNumber"))
	result.IPAddress = GetNode(device, "*/ip")
	result.minPollTime = parseInt(GetNode(device, "*/minPollTime"))
	result.swapWordsMode = parseInt(GetNode(device, "*/swapWordsMode"))
	result.slaveAddressConfigMode = parseInt(GetNode(device, "*/slaveAddressConfigMode"))
	result.dynamicSlaveAddress = GetNode(device, "*/dynamicSlaveAddress")
	result.images = GetModbusRTUImages(device, addressOffset, allowUnassigned)
	if (!result.images)
		return
	
	result.params = GetModbusSendParams(device, addressOffset)
	result.addressType = devAddressType;
	
//	result.PLCImages = GetPlcIECImages(device)
	return result
}

function GetModbusSendParams(device, addressOffset)
{
	var list = []
	var nodelist = device.selectNodes("*/sendParams/sendParam")
	var node
	
	while (node = nodelist.nextNode())
	{
		var item = {}
		item.addr = parseInt(GetNode(node, "address")) + addressOffset
		item.type = GetNode(node, "type")
		item.value = parseFloat(GetNode(node, "value"))
		item.tmo = parseInt(GetNode(node, "timeout"))
		item.node = node
		
		list.push(item)
	}
	return list
}

function GetModbusRTUVariable(imgNode, addr, pos)
{
	//imgNode.setAttribute( "modbusAddress", addr)
	//imgNode.setAttribute( "subindex", subi )
	
	var v = {}
	v.objectType = imgNode.getAttribute("objtype");
	v.objectName = (v.objectType == "BOOL") ? 
		app.Translate("Coil") : 
		app.Translate("Register");
	v.type  = v.objectType == "BOOL" ? "bit" : "word"
	v.addr  = addr
	// TODO estrazione del bit: non ancora implementato a livello grafico, serve per mappare un singolo bit su una word
	v.bitn  = 0
	v.db    = GetNode(imgNode, "../dataBlock")
	v.dbt   = GetNode(imgNode, "../type")
	v.size = 1  // TODO oggetti complessi?
	v.label = GetNode(imgNode, "../label")
	v.node = imgNode.parentNode
	v.pos = pos;
	return v
}

// restituisce array del tipo  { block, type, addr, size, tmo } con le immagini per modbus.conf
// ricalcola anche i modbusAddress degli ioObject
function GetModbusRTUImages( device, addressOffset, allowUnassigned )
{
	var list = []
	var nodelist
	var objlist
	var addr
	var subi
	var imgNode

		//	Numero di messaggi
	nodelist = device.selectNodes("*[@insertable]")
	while( node = nodelist.nextNode() )
	{
		var item = {}
		item.block	 = GetNode( node, "FC_config/block")
		item.funcode = parseInt(GetNode( node, "FC_config/funcode"))
		item.type	 = GetNode( node, "FC_config/type")
		item.node = node
		item.vars = []

		if( item.block == "inputoutput" )
		{
			// solo funzione 23
			subi	    = 0;
			addr 	    = parseInt(GetNode( node, "FC_config/wrAddress")) + addressOffset
			item.addrwr = addr
			objlist     = node.selectNodes("FC_config/*/FC_image/ioObject[@inout = 'out']")
			item.sizewr = objlist.length

			var pos = 0
			while( imgNode = objlist.nextNode() )
			{
				var v = GetModbusRTUVariable(imgNode, addr, pos)
				// aggiunge sempre la variabile alla lista, se non è mappata l'errore sarà intercettato dopo
				
				//	word position of the variable into the image
				pos++
				
				item.vars.push(v)
				addr++
			}

			subi	    = 0;
			addr 		= parseInt(GetNode( node, "FC_config/rdAddress")) + addressOffset
			item.addrrd = addr
			objlist     = node.selectNodes("FC_config/*/FC_image/ioObject[@inout = 'in']")
			item.sizerd = objlist.length

			var pos = 0
			while( imgNode = objlist.nextNode() )
			{
				var v = GetModbusRTUVariable(imgNode, addr, pos)
				
				//	word position of the variable into the image
				pos++
				
				// aggiunge sempre la variabile alla lista, se non è mappata l'errore sarà intercettato dopo
				item.vars.push(v)
				addr++
			}
		}
		else
		{
			subi	  = 0;
			addr	  = parseInt(GetNode( node, "FC_config/startAddress")) + addressOffset
			item.addr = addr
			objlist   = node.selectNodes("FC_config/*/FC_image/ioObject")
			item.size = objlist.length;

			var pos = 0
			while( imgNode = objlist.nextNode() )
			{
				var v = GetModbusRTUVariable(imgNode, addr, pos)
				
				//	word position of the variable into the image
				pos++
				
				if (v.label || allowUnassigned)
				{
					item.vars.push(v)
				}
				else
				{
					if (item.vars.length == 0)
						// se siamo sulla prima riga e non c'è nessuna var mappata aggiunge lo stesso alla lista, l'errore sarà gestito dopo
						// altrimenti tollera la riga vuota per mappature ad es. di due registri su una var dword
						item.vars.push(v)
				}
				
				addr++
			}
		}

		item.turnAround = parseInt(GetNode( node, "FC_config/turnAround"))
		item.pollTime = parseInt(GetNode( node, "FC_config/pollTime"))
		item.tmo 	  = parseInt(GetNode( node, "FC_config/tmo"))
		item.oneshot = GetNode( node, "FC_config/oneshot")
		

		list.push( item )
    }
	//app.ModifiedFlag = true

	return list
}

/*function GetPlcIECImages( device )
{
	var list = []

	nodelist = device.selectNodes(".//*[ioObject and label != '']")
	while( node = nodelist.nextNode() )
	{
		var item = {}
		item.block = GetNode(node, "ioObject/@inout") == "in" ? "input" : "output"
		item.type  = GetNode(node, "ioObject/@objtype") == "BOOL" ? "bit" : "word"
		item.addr  = GetNode(node, "ioObject/@modbusAddress")
		item.bitn  = GetNode(node, "ioObject/@subindex")
		item.db    = "%" + GetNode(node, "dataBlock")
		item.dbt   = GetNode(node, "type")
		list.push( item )
	}

	return list
}*/

function GetNode(node, query)
{
	if (!node || !query || query == '') return ''
	var ris = node.selectSingleNode(query)
	if (ris) return ris.nodeTypedValue
	return ''
}

function SetNode(node, query, value)
{
	if (!node || !query) return
	var ris = node.selectSingleNode(query)
	ris.nodeTypedValue = value
	app.ModifiedFlag = true
}


// funzione invocata da script.OnRefactoringMsg per rinomino istanze variabili dentro XML
function Refactor(deviceNode, objType, oldName, newName)
{
	var querylist = [
		"*[@insertable]/FC_config/FC_images_in/FC_image/label",
		"*[@insertable]/FC_config/FC_images_out/FC_image/label"
	];
	
	var totReplaced = 0;
	
	for (var i = 0; i < querylist.length; i++)
	{
		var nodelist = deviceNode.selectNodes(querylist[i] + "[. = '" + oldName + "']");
		var node;
		while (node = nodelist.nextNode())
			node.text = newName;
		
		totReplaced += nodelist.length;
	}
	
	return totReplaced;
}
