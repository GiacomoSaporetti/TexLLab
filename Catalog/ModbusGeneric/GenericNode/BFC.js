var genfuncs = app.CallFunction("common.GetGeneralFunctions")

	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1
var TREENAME = "tree1";

var MODBUSADDRESSTYPE = {
	MODBUS: 0,
	JBUS: 1
};

var MODBUS_ADDRESS_OFFSET = app.CallFunction("script.GetModbusAddressOffset");

function Init(p)
{
	return 1
}

function UpgradeNode(device, oldversion)
{
		//aggiunto attributo per agganciare una variabile che permette l'invio oneshot
	if (oldversion < 2.0)
	{
		// aggiunge FC_config/oneshot 
		var parent = device.selectSingleNode("FC_config")
		parent.appendChild(xmldoc.createElement("oneshot")).text = ''
	}
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
		enabled = genfuncs.ParseBoolean(enabled)
	
	if (!enabled)
	{
		var datapath = app.GetDataPathFromNode(node)
		// mette overlay di disabilitazione (X rossa)
		app.HMISetOverlayImg(TREENAME, app.HMIGetElementPath(TREENAME, datapath), TREE_OVERLAY_DISABLED)
	}

}

// ritorna la configurazione dello slave per la generazione dei settaggi del master
// per la struttura vedi GetModbusRTUCfg() in ModbusCustom.js 
function GetModbusRTUCfg(device, reqAddressType, allowUnassigned)
{
	// tipologia di configurazione richiesta dal master (modbus/jbus), per retrocompatibilità vecchi target è quella globale della suite
	if (reqAddressType === undefined)
		reqAddressType = MODBUS_ADDRESS_OFFSET;
	
	// tipologia dello slave corrente: i broadcast non hanno settaggio locale ma seguono sempre quello globale della suite
	var devAddressType = MODBUS_ADDRESS_OFFSET;
	
	// calcolo offset: se richiesto modbus e lo slave è jbus farà +1, se richiesto jbus e lo slave è modbus farà -1
	var addressOffset = devAddressType - reqAddressType;
	
	var result = {}
	result.name = device.getAttribute("caption");
	result.modbusAddress = -1
	result.nodeNumber = -1
	result.images = GetModbusRTUImages(device, addressOffset, allowUnassigned)
	result.params = []

	return result
}

function GetModbusRTUImages(device, addressOffset, allowUnassigned)
{
	var list = []
	var nodelist
	var objlist
	var addr
	var subi
	var imgNode

	var item = {}
	item.block	 = GetNode( device, "config/block")
	item.funcode = GetNode( device, "config/funcode")
	item.type	 = GetNode( device, "config/type")

	subi	  = 0;
	addr	  = parseInt(GetNode( device, "config/startAddress")) + addressOffset;
	item.addr = addr
	objlist   = device.selectNodes("config/*/*/ioObject")
	item.size = objlist.length;
	item.vars = []

	while( imgNode = objlist.nextNode() )
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
		v.bitn  = subi
		v.db    = GetNode(imgNode, "../dataBlock")
		v.dbt   = GetNode(imgNode, "../type")
		v.size = 1  // TODO oggetti complessi?
		v.label = GetNode(imgNode, "../label")
		v.node = imgNode
		
		item.vars.push(v)
		addr++
	}

	item.turnAround = GetNode( device, "config/turn")
	item.pollTime = GetNode( device, "config/pollTime")
	item.tmo 	  = GetNode( device, "config/tmo")
	item.oneshot = GetNode( device, "config/oneshot")

	list.push( item )
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
		"config/images_out/FC_image/label"
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
