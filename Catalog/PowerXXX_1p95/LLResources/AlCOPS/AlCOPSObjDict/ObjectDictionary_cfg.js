// indirizzi estremi inclusi!
#include ObjectDictionary_def.js

//	dato l'ipa ottiene il parametro
function GetParamNode( device, ipa )
{
	var paramNode = device.selectSingleNode( PATH_PARAMS + "[ipa = '" + ipa + "'] | " + PATH_PARAMSRO + "[ipa = '" + ipa + "']" )
	return paramNode
}

//	dato index e subindex ottiene il parametro
function GetParamNodeFromObjDict( device, index, subindex )
{
	var paramNode
	var objdictNode = device.selectSingleNode( PATH_OBJECT_DICTIONARY + "[index ='" + index + "' and subindex = '" + subindex + "']" )
	if ( objdictNode )
	{
		var ipa = parseInt( GetNode( objdictNode, "ipa" ) )
		paramNode = GetParamNode( device, ipa )
	}
	
	return paramNode
}

function ValidateObjectDictionary(device, forceGeneration)
{
	var objMap = {}

	if ( !forceGeneration )
	{
		//	è necessario validarlo solo se il CANopen slave è abilitato su qualche porta
		var validateObjectDictionary = false
		var portList = device.selectNodes( "CANopen" )
		var port
		var portErr
		while (port = portList.nextNode())
		{
			if (parseInt(port.getAttribute("mode")) == CAN_MODE_SLAVE)
			{
				portErr = port
				validateObjectDictionary = true
				break
			}
		}
		
		if ( !validateObjectDictionary )
			return enuLogLevels.LEV_OK
	}

	// verifica duplicazione nomi e ipa per parametri e statusvar
	var nodes = device.selectNodes(PATH_OBJECT_DICTIONARY)
	var node
	while (node = nodes.nextNode())
	{
		//	trova il param node corrispondente
		var ipa = GetNode( node, "ipa" )
		var index = parseInt( GetNode( node, "index" ) )
		var subindex = parseInt( GetNode( node, "subindex" ) )
		
		//	controllo range index
		if ( index < m_CANOpen_IndexRange.start || index > m_CANOpen_IndexRange.end )
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode( "ipa" ) )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid index: " + app.CallFunction("common.sprintf", "0x%04X", index ) + " specified for Object Dictionary entry", err )
		}
		
		//	controllo range subindex
		if ( subindex < m_CANOpen_SubindexRange.start || subindex > m_CANOpen_SubindexRange.end )
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode( "ipa" ) )			
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid subindex: " + app.CallFunction("common.sprintf", "0x%02X", subindex ) + " specified for Object Dictionary entry index: " +  app.CallFunction("common.sprintf", "0x%04X", index ), err )
		}
		
		//	controllo esistenza parametro
		var paramNode = GetParamNode( device, ipa )
		if ( !paramNode )
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode( "ipa" ) )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Cannot find Public Object Parameter/Status Variable related to ipa: " + ipa + ", index: " +  app.CallFunction("common.sprintf", "0x%04X", index ) + ", subindex: " + app.CallFunction("common.sprintf", "0x%02X", subindex ), err )
		}
		
			//	Verifica duplicazione index subindex
		var key = index + "." + subindex
		if ( objMap[key] )
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode( "ipa" ) )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Duplicated object specification. Index: " +  app.CallFunction("common.sprintf", "0x%04X", index ) + ", subindex: " +  app.CallFunction("common.sprintf", "0x%02X", subindex ) , err)
		}
		
		objMap[key] = true
	}
	
	return enuLogLevels.LEV_OK
}

function GetParIpaFromName(root, name)
{
	// cerca tra i parametri applicativi
	var par = root.selectSingleNode(".//param[name = '" + name + "']/ipa")
	if (par)
		return parseInt(par.text)
	
	return
}

function GenerateObjectDictionaryTable(device)
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
		
	/*	Object dictionary code generation */

	var objdictList = device.selectNodes( PATH_OBJECT_DICTIONARY )	
	var objtot = objdictList.length
	var objarray = ( objtot == 0 ) ? 1 : objtot 
	// Init code
	var content = ""
		
	if ( objtot > 0 )
	{
		content += "\tPROGRAM ProgramObjectDictionaryInit WITH Init;\n"
		content += "\tPROGRAM ProgramObjectDictionaryInit\n"
		content += "\t{ HIDDEN:ON }\n\n"
		content += "\tVAR CONSTANT\n"
		content += "\t\t$$ObjectDictionary : ARRAY[ 0.." + objarray + " ] OF ObjectDictionaryType := [\n"
		
		var objnum = 0
		var objdict
		while (objdict = objdictList.nextNode())
		{
			//	16		8 + 8				16				16
			//	index,	subindex + len,		flags, 			modbus address
			//								bit 0:readonly
			//								bit 1:write
			//								bit 2:pdomapping
			var ipa = parseInt( GetNode( objdict, "ipa" ) )
			var index = parseInt( GetNode( objdict, "index" ) )
			var indexStr = app.CallFunction("common.sprintf", "16#%04X", index)
			var subindex = parseInt( GetNode( objdict, "subindex" ) )
			var pdomapping = parseInt( GetNode( objdict, "pdomapping" ) )
			var readonly = parseInt( GetNode( objdict, "readonly" ) )
			var write = readonly ? 0 : 1
			var flags = readonly | ( write << 1 ) | ( pdomapping << 2 )
			var flagsStr = app.CallFunction("common.sprintf", "16#%04X", flags)
			
			var paramNode = GetParamNode( device, ipa )
			var name = GetNode( paramNode, "name" )
			var address = parseInt( GetNode( paramNode, "address" ) )
			var typeIEC = GetNode( paramNode, "typetarg" )
			var isEnum = app.CallFunction( targetID + ".IsEnumType", typeIEC )
			if ( isEnum )
				var len = app.CallFunction("common.GetIECTypeBits", "DINT" )
			else
				var len = app.CallFunction("common.GetIECTypeBits", typeIEC )
			var subindexLen =  ( len << 8 ) | subindex
			var subindexLenStr = app.CallFunction("common.sprintf", "16#%04X", subindexLen)
			
			content += "\t\t( index := " + indexStr + ", subindexLen := " + subindexLenStr + ", flags := " + flagsStr + ", databaseAddress := " + address + " )"
			if ( objnum < objarray )
				content += ",\n"
					
			objnum += 1
		}
		
		if ( objnum == objarray )
			content += "\t\t( index := 0, subindexLen := 0, flags := 0, databaseAddress := 0 )"
		
		content += "\t\t];\n"
		content += "\tEND_VAR\n\n"
		content += "\tVAR\n"
		content += "\t\tdummy : BOOL;\n"
		content += "\tEND_VAR\n\n"
		content += "\t{ CODE:ST }\n"
		if ( objtot > 0 )
			content += "\tdummy := sysSetObjectDictionary( TO_DWORD( ADR( $$ObjectDictionary ) ), " + objtot + ");\n"
		else
			content += "\tdummy := sysSetObjectDictionary( TO_DWORD( 0 ), 0 );\n"
		
		content += "\tEND_PROGRAM\n\n";
	}
	
	return content
}

// generazione configurazione per database parametri
function BuildCfg_ObjectDictionary(device, forceGeneration)
{	
	var FUNCNAME = "BuildCfg_ObjectDictionary"
	
	if ( !forceGeneration )
	{
		//	è necessario validarlo solo se il CANopen slave è abilitato su qualche porta
		var anySlave = false
		var portList = device.selectNodes( "CANopen" )
		var port
		while (port = portList.nextNode())
		{
			if (parseInt(port.getAttribute("mode")) == CAN_MODE_SLAVE)
			{
				anySlave = true
				break
			}
		}
	}
	else
	{
		anySlave = true
	}
	
	var content
	if ( !anySlave )
		content = ""
	else
		content = GenerateObjectDictionaryTable( device )
	
	//	inserimento sorgente ausiliario nel progetto PLC (pre rt code)
	var filename = "ObjectDictionary.plc"
	if (content === null)
		// errore di generazione
		throw enuLogLevels.LEV_CRITICAL
	else if (content === "")
		// nessun codice generato, rimuove il codice aux eventualmente presente
		app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename )
	else
	{
		app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content )
		app.PrintMessage( "Created LocalIO configuration", enuLogLevels.LEV_INFO )
	}
}

function AlCOPSObjDictGetParamList(excludeReadOnly, excludeTypeString, indexMin, indexMax, excludeNotMappable)
{
	var nodelist, node
	var paramDBlist = []
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	var filtersList = []
	if ( excludeReadOnly )
		filtersList.push("readonly = '0'")
		
//	if ( excludeTypeString )
//		filtersList.push("typetarg != 'STRING'")

	if ( excludeNotMappable )
		filtersList.push("pdomapping = '1'")
	
	var filter = ""
	if (filtersList.length != 0)
		filter = "[" + filtersList.join(" and ") + "]"

	// CANopen objects
	nodelist = app.SelectNodesXML("/" + targetID + "/config/CANopenObjDict/objdict" + filter)
	while (node = nodelist.nextNode())
	{
			//	non inserisce parametro nella lista
		var index = parseInt( GetNode(node, "index") )
		if ( indexMin != undefined && index < indexMin )
			continue
		if ( indexMax != undefined && index > indexMax )
			continue
		
			//	scelgo il public object corrispondente
		var paramNodeList = app.SelectNodesXML( "/" + targetID + "/config/*/param[ ipa=" + GetNode(node, "ipa") + "]" )
		if ( !paramNodeList )
			continue
		
		var paramNode = paramNodeList[0]
			
		paramDBlist.push( { 	ipa: GetNode(node, "ipa"),
								index: GetNode(node, "index"), 
								subindex: GetNode(node, "subindex"),
								type: GetNode(paramNode, "typetarg"),
								name: GetNode(paramNode, "name"),
								description: GetNode(paramNode, "description"),
								readonly: GetNode(node, "readonly"),
								nodeXML : node } )
	}

	paramDBlist.sort( ParSortFunc )

	return paramDBlist
}

function AlCOPSObjDictGetParamMap(excludeReadOnly, excludeTypeString, indexMin, indexMax, excludeNotMappable)
{
	var nodelist, node
	var paramDBmap = {}
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	var filtersList = []
	if ( excludeReadOnly )
		filtersList.push("readonly = '0'")
	
//	if ( excludeTypeString )
//		filtersList.push("typetarg != 'STRING'")
		
	if ( excludeNotMappable )
		filtersList.push("pdomapping = '1'")
	
	var filter = ""
	if (filtersList.length != 0)
		filter = "[" + filtersList.join(" and ") + "]"

		// Parameter
	nodelist = app.SelectNodesXML("/" + targetID + "/config/CANopenObjDict/objdict" + filter)
	while (node = nodelist.nextNode())
	{
			//	non inserisce parametro nella lista
		var index = parseInt( GetNode(node, "index") )
		if ( indexMin != undefined && index < indexMin )
			continue
		if ( indexMax != undefined && index > indexMax )
			continue
		
			//	scelgo il public object corrispondente
		var paramNodeList = app.SelectNodesXML( "/" + targetID + "/config/*/param[ ipa=" + GetNode(node, "ipa") + "]" )
		if ( !paramNodeList )
			continue
				
		var paramNode = paramNodeList[0]
		
		var obj = { ipa: GetNode(node, "ipa"),
					index: GetNode(node, "index"), 
					subindex: GetNode(node, "subindex"),
					type: GetNode(paramNode, "typetarg"),
					name: GetNode(paramNode, "name"),
					description: GetNode(paramNode, "description"),
					readonly: GetNode(node, "readonly"),
					nodeXML : node }
		
		var key = "0x" + parseInt(obj.index).toString(16) + "." + parseInt(obj.subindex).toString()
		paramDBmap[key] = obj
	}

	return paramDBmap
}
