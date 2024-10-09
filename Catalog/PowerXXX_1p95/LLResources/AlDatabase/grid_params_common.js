
var m_LogicLabTypes = app.CallFunction("script.GetLogicLabTypes")
var TYPEPAR = m_LogicLabTypes.TYPEPAR
var TYPEPAR_DESCR = m_LogicLabTypes.TYPEPAR_DESCR
var ENUM_BASE = m_LogicLabTypes.ENUM_BASE
var m_typeTargs = m_LogicLabTypes.TYPETARG
var m_isAssignButton = false

// valore dummy (che e' "improbabile" che nessuno usi come valore di un enum) da usare per gli enum, che indica nessun valore
// oltre questo valore il variant è salvato come VT_R8 ????
var ENUM_NO_DEFVAL = 0x3FFFFFFF

// crea gli enumerativi per i tipi
function CreateEnums(grid, datapath)
{
		//	Generazione enumeratore per combo del TypeTarg
	var typetargEnum = []
	for (var i in m_typeTargs)
		typetargEnum.push(m_typeTargs[i], i)
	
		//	Completamento enumeratore per combo del TypePar
	var typeparEnum = []
	for (var typeName in TYPEPAR)
		if (typeName != "__LAST")
		{
			var typeValue = TYPEPAR[typeName]
			typeparEnum.push(typeValue, TYPEPAR_DESCR[typeValue])
		}
	
	var nodes = m_parentDevice.selectNodes("config/enums/enum | config/sysenums/enum");
	var node
	while( node = nodes.nextNode() )
	{
			//	Creazione enumerativo per completamento colonna value quando il typepar è di tipo enum
		var listEnum = []
		if (!IS_PARAMS)
			listEnum.push(ENUM_NO_DEFVAL, "")   // prima voce vuota, per nessun default
			
		var listEnumValues = node.selectNodes("enum_value")
		var listEnumValue
		while( listEnumValue = listEnumValues.nextNode() )
			listEnum.push( parseInt( GetNode( listEnumValue, "value" )), GetNode( listEnumValue, "name" ) )

		if (listEnum.length != 0)
		{
			// il nome dell'enumerativo è lo stesso valore del typepar
			var id = ENUM_BASE + parseInt(node.getAttribute("id"))
			
			typeparEnum.push( id, node.getAttribute("caption") )
			typetargEnum.push( id, node.getAttribute("caption") )
			
			grid.AddEnum( id.toString(), listEnum )
		}
	}
	
	grid.AddEnum( "typetargEnum", typetargEnum )	
	grid.AddEnum( "typeparEnum", typeparEnum )
	
	// enum per booleani, per colonna defval
	if (!IS_PARAMS)
		grid.AddEnum( "BOOLenum", [ENUM_NO_DEFVAL, "", 0, "False", 1, "True"]) // prima voce vuota, per nessun default
	else
		grid.AddEnum( "BOOLenum", [0, "False", 1, "True"])
	
	// enum per booleani
	grid.AddEnum( "BOOL", [0, "False", 1, "True"])

	// enum per livelli di accesso
	grid.AddEnum( "accessLevelEnum", [
		0, app.Translate("Never visible"), 
		1, app.Translate("Expert"), 
		2, app.Translate("Supervisor"), 
		3, app.Translate("Normal")
	])
	
	// enum per valori predefiniti unità di misura
	var um = app.CallFunction(m_extName + ".GetDefaultUM")
	var list = []
	for (var i = 0; i < um.length; i++)
		list.push(i, um[i])
		
	grid.AddEnum( "unitEnum", list)	
	
	
	// enum per valori predefiniti formati per interi
	var formats = app.CallFunction(m_extName + ".GetDefaultFormats_Int")
	var list = []
	for (var i = 0; i < formats.length; i++)
		list.push(i, formats[i])
		
	grid.AddEnum("formatsEnum_Int", list)
	
	// enum per valori predefiniti formati 
	var formats = app.CallFunction(m_extName + ".GetDefaultFormats")
	var list = []
	for (var i = 0; i < formats.length; i++)
		list.push(i, formats[i])
		
	grid.AddEnum("formatsEnum", list)
}

// genera stringa per drag&drop
function CreateDataSourceString(grid)
{
	var list = []
	
	// genera lista di coppie uniqueID/ipa per generazione stringa per dragdrop
	var selections = app.CallFunction("common.GridGetSelections", grid)
	for (var i = 0; i < selections.length; i++)
	{
		var row = selections[i]
		list.push( grid.Elem(row, columns.ipa) )
	}
	
	var str = app.CallFunction("parameters.BuildDragDropParams", list)
	return str
}

// cambia l'ipa nei menuItem in seguito a una modifica dell'ipa nella griglia dei parametri
function ChangeParamIPA(oldipa, newipa)
{
	// risale a devConfig
	var devConfig     = app.SelectNodesXML(gridDatapath + "/..")[0]
	// estrae tutti i menu che hanno il parametro corrente come menuItem
	var nodelist   = devConfig.selectNodes("menus/menu/menuItems/menuItem[ipa = '" + oldipa + "']")
	var node
	while (node = nodelist.nextNode())
		// sostituisce il vecchio ipa del parametro con il nuovo
		node.selectSingleNode("ipa").text = newipa
}

function IsAlreadyManagedByResources(v)
{
	if (typeof v == "string")
	{
		// passata stringa: è il nome della variabile
		var varName = v
		
		var v = app.CallFunction("logiclab.GetGlobalVariable", varName)
		if (!v)
			return false
	}
	else if (typeof v == "object")
		// altrimenti se passato oggetto, è già la PLCvar
		var varName = v.Name
	
	// le variabili complesse specificate manualmente sono a gestione totalmente manuale
	if (app.CallFunction("script.IsComplexVar", varName))
		return false
		
	// assume nome estensione = nome target !
	var extName = app.CallFunction("logiclab.get_TargetID")
	
	// verifica se il datablock della var è uno di quelli gestiti dal framework
	// in caso contrario, è un'assegnazione 'forzata' di una var già mappata, e non deve disassegnare in automatico
	var parsedDB = app.CallFunction("common.ParseDataBlock", v.DataBlock)
	if (!parsedDB)
		return false
	if (!app.CallFunction(extName + ".IsResourceManagedDatablock", parsedDB.area, parsedDB.datablock))
		return false
		
	// chiama funzione specifica di GetPLCVariableUsages del target corrente
	var usages = app.CallFunction(extName + ".GetPLCVariableUsages", varName)
	// se la variabile specificata è usata in più di un contesto non la disassegna ora, sarà fatto all'ultima cancellazione
	if (usages && usages.length > 0)
		return true
	else
		return false
}

function ChangeParamName(oldname, newname, row)
{
	var caption = app.Translate( "Param name" )
	
	if ( oldname == newname )
		return false
	
	// risale a devConfig
	var devConfig = app.SelectNodesXML(gridDatapath + "/..")[0]
	
	if ( newname != "" )
	{	
		//	variabile già usata per i parametri
		var nodelist = devConfig.selectNodes("*/param/name[. = '" + newname + "']")	
		if ( nodelist.length != 0)
		{
			var msg = app.Translate( "Parameter name '" + newname + "' already exists in database" )
			app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION )
			return false
		}
		
		//	variabile complessa
		var isComplex = app.CallFunction("script.IsComplexVar", newname)
		if ( isComplex )
		{
			var msg = app.Translate( "Cannot specify complex variable name" )
			app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION )
			return false
		}
	
		//	variabile esistente
		var v = app.CallFunction( "logiclab.GetGlobalVariable", newname )
		var varType
		var parType
		var varDescription
		var varSize
		if ( v != null )
		{
			varType = v.Type
			varDescription = v.description
			varSize = GetPLCVarSize(v)
			
			switch ( varType )
			{
			case "USINT":
				parType = TYPEPAR[ "BYTE" ]
				break;
			case "UINT":
				parType = TYPEPAR[ "WORD" ]
				break;
			case "UDINT":
				parType = TYPEPAR[ "DWORD" ]
				break;
			default:
				parType = TYPEPAR[ varType ]
			}
				
			if ( parType === undefined )
			{
				var msg = app.Translate( "Cannot assign variable of '" + varType + "' type" )
				app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION )
				return false
			}
			
			if ( v.dataBlock != "Auto" )
			{
				//	la variabile può essere riassegnata?
				if ( IsAlreadyManagedByResources(newname) )
				{
					var msg = app.Translate( "Variable is already used in other resources configurations.\n\nCannot be used as parameter\n" )
					app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION )
					return false
				}
				
				var msg = app.Translate( "Variable is already defined into project as mapped variable.\n\nDo you want to reassign this variable and use it as parameter?\n" )
				if ( app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION | gentypes.MSGBOX.MB_YESNO ) == gentypes.MSGBOX.IDNO )
					return false
				
				// disassegna la variabile precedentemente assegnata
				app.CallFunction("script.UnassignPLCVar", newname)
				
				//	cancella la variabile che verrà ricreata come global shared
				if (app.CallFunction("logiclab.DeleteGlobalObject", newname))
				{				
					// rinfresca la griglia delle global vars se aperta
					//app.CallFunction("extfunct.ReloadGlobalVars", m_globalGroupName)
					// rinfresca l'albero delle var globali
					app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
				}
			}
			else
			{
				if ( !m_isAssignButton )
				{
					var msg = app.Translate( "Variable is already defined as automatic variable.\n\nDo you want to use this variable as parameter?\n" )
					if ( app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION | gentypes.MSGBOX.MB_YESNO ) == gentypes.MSGBOX.IDNO )
						return false
				}
				
				//	cancella la variabile che verrà ricreata come global shared
				if (app.CallFunction("logiclab.DeleteGlobalObject", newname))
				{				
					// rinfresca la griglia delle global vars se aperta
					//app.CallFunction("extfunct.ReloadGlobalVars", m_globalGroupName)
					// rinfresca l'albero delle var globali
					app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
				}
			}
		
			app.DataSet( BuildPath(row,columns.typetarg), 0, varType )
			app.DataSet( BuildPath(row,columns.typepar), 0, parType )
			app.DataSet( BuildPath(row,columns.description), 0, varDescription )
			grid.Update( row, columns.typepar )
			grid.Update( row, columns.typetarg )
			grid.Update( row, columns.description )
			
			if ( varType == "STRING" )
			{
				app.DataSet( BuildPath(row, columns.size), 0, varSize )
				grid.Update( row, columns.size )
			}
		}
	}
	
	//	Se assegnamento nome parametro (e non rinomina), non fare nulla
	if( oldname == "" )
	{
		return true
	}
	else
	{
/*
		//	ricrea variabile esistente
		var v = app.CallFunction( "logiclab.GetGlobalVariable", oldname )
		if ( v != null )
		{
			var globalVarsGroup = ""
			var varType = v.Type
			var varSize = GetPLCVarSize(v)
			
			// modifica il nome della variabile
			app.CallFunction( "logiclab.Refactor", v, "DELETEOBJECT_" + oldname )
			
			// aggiunta nuova variabile automatica al progetto
			v = app.CallFunction("logiclab.AddGlobalVariable", oldname, varType, "Auto", globalVarsGroup, varSize, null, PLCVAR_ATTR_NONE, "")
			if (!v)
			{
				app.MessageBox(genfuncs.FormatMsg(app.Translate("Error creating new automatic variable %1"), oldname), "", gentypes.MSGBOX.MB_ICONERROR)
				return false
			}
			
			// rinfresca la griglia delle global vars se aperta
			app.CallFunction("extfunct.ReloadGlobalVars", globalVarsGroup)
			// rinfresca l'albero delle var globali
			app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
		}
*/
	}

	// estrae tutti i param che hanno il parametro corrente come min o max
	var nodelist = devConfig.selectNodes("*/param/min[. = '" + oldname + "'] | */param/max[. = '" + oldname + "']")
	var node
	while (node = nodelist.nextNode())
		// sostituisce il vecchio name del parametro con il nuovo
		node.text = newname
	
	if (nodelist.length != 0)
	{
		// riaggiorna tutte le colonne min e max
		grid.Update(-1, columns.min)
		grid.Update(-1, columns.max)
	}
	
	return true
}

// cancellazione righe parametri e menuItem associati
function grid_DeleteRowXML()
{
	//	il database embedded genera aux src, non assegna ad un db !
	
	var list = app.CallFunction("common.GridGetSelections", grid)
	
	// risale a devConfig
	var devConfig = app.SelectNodesXML(gridDatapath + "/..")[0]
	var node
	
	for (var i = list.length - 1; i >= 0; i--)
	{
		var ipa = grid.Elem(list[i], columns.ipa)
		var name = grid.Elem(list[i], columns.name)
		
		// estrae tutti i menu che hanno il parametro corrente come menuItem
		var nodelist = devConfig.selectNodes("menus//menuItem[ipa = '" + ipa + "']")
		while (node = nodelist.nextNode())
			// elimina il menuItem
			node.parentNode.removeChild(node)
		
		// estrae tutti i param che hanno il parametro corrente come min o max
		var nodelist = devConfig.selectNodes("*/param/min[. = '" + name + "'] | */param/max[. = '" + name + "']")
		while (node = nodelist.nextNode())
			// elimina il limite min o max
			node.text = ""
			
		// cancella il parametro attuale
		app.DataDelete(gridDatapath + "/*[" + (list[i]+1) + "]", 0)
	}
	grid.DeleteRows(list.length)
}

// cerca il primo IPA libero
function FindFreeIPA()
{
	var used = {}	
	// scorre tutti i parametri e status vars (gridDatapath finisce con /. quindi toglie l'ultimo carattere!)
	var nodelist = app.SelectNodesXML(gridDatapath.slice(0,-1) + "..//param")
	var node
	while (node = nodelist.nextNode())
	{
		var ipa = parseInt(GetNode(node, "ipa"))
		used[ipa] = true
	}
		
	for (var i = m_ipaRange.start; i <= m_ipaRange.end; i++)
		if (!used[i])
			return i
			
	return -1
}

// cerca il primo address libero
function FindFreeAddress()
{
	var used = {}
	// scorre tutti i parametri e status vars (gridDatapath finisce con /. quindi toglie l'ultimo carattere!)
	var nodelist = app.SelectNodesXML(gridDatapath.slice(0,-1) + "..//param")
	var node
	while (node = nodelist.nextNode())
	{
		var address = parseInt(GetNode(node, "address"))
		
		var size = app.CallFunction(m_extName + ".GetParamSize", node, m_isModbusCompliantDatabase)
		if (size == 0)
			size = 1  // se parametro vuoto lo considera cmq almeno da 1 registro!

		for (var i = 0; i < size; i++)
			used[address + i] = true
	}
	
	for (var i = m_addressRange.start; i <= m_addressRange.end; i++)
		if (!used[i])
			return i
			
	return -1
}


function grid_AddRowXML(readonly)
{
	var address = FindFreeAddress()
	
	var ipa = FindFreeIPA()
	
	if (ipa == -1 || address == -1)
	{
		alert(app.Translate("Too many parameters already defined!"))
		return
	}
	
	var datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	app.DataSet(datapath + "/ipa", 0, ipa)
	app.DataSet(datapath + "/address", 0, address)
	app.DataSet(datapath + "/readonly", 0, readonly ? 1 : 0)
	// size per default a 0 in quanto per default il par è intero (nel template potrebbe essere != 0)
	app.DataSet(datapath + "/size", 0, 0)
	if (readonly)
		app.DataSet(datapath + "/value", 0, "")
	grid.InsertRows(1)
	
	grid.focus()
	grid.EditMode(true)
	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.name)
}

function grid_AddArrayElements(readonly)
{
	var list = [];
	var globalVars = app.CallFunction("logiclab.GetProjectVariables");
	
	for (var i = 0, t = globalVars.length; i < t; i++)
	{
		var v = globalVars.item(i);
		if (v.IsDataBlock && IsPLCArray(v))
		{
			var dims = genfuncs.FromSafeArray(v.Dims);
			list.push( {
				name: v.Name, 
				type: v.Type, 
				description: v.Description, 
				size: dims[0], 
				PLCVar: v 
				} );
		}
	}

	app.TempVar("VarsList_input") = list
	app.OpenWindow("PLCVarsListArray", app.Translate("Choose PLC Array"), "")
	var result = app.TempVar("VarsList_result")
	app.TempVar("VarsList_result") = undefined

	if (result === undefined)
		return
	var item = list[result.idx]
	
	var srcNode = app.GetTemplateData(rowTemplate)[0].cloneNode(true)
	srcNode.removeAttribute("template")   // toglie subito (lo fa anche la AddTemplateData)
	srcNode.removeAttribute("version")
	
	var destNode = app.SelectNodesXML(gridDatapath)[0]
	
	for (var i = result.fromElem; i <= result.toElem; i++)
	{
		var address = FindFreeAddress()
		
		var ipa = FindFreeIPA()
		
		if (ipa == -1 || address == -1)
		{
			alert(app.Translate("Too many parameters already defined!"))
			return
		}
		
		// MOLTO più veloce che fare una sequenza di AddTemplateData / DataSet
		var newNode = destNode.appendChild(srcNode.cloneNode(true))
		SetNode(newNode, "ipa", ipa)
		SetNode(newNode, "address", address)
		SetNode(newNode, "readonly", readonly ? 1 : 0)
		SetNode(newNode, "name", item.name + "[" + i + "]")
		SetNode(newNode, "typepar", TYPEPAR[item.type])
		SetNode(newNode, "typetarg", item.type)
		SetNode(newNode, "dataBlock", item.PLCVar.dataBlock)
	}
	
	grid.InsertRows(result.toElem - result.fromElem + 1)
	app.ModifiedFlag = true
	
	grid.EditMode(false)
	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.name)
}

function CheckAddressRange(address)
{
	return app.CallFunction(m_extName + ".CheckAddressRange", address, m_addressRange);
}

function CheckIPARange(ipa)
{
	if (ipa < m_ipaRange.start || ipa > m_ipaRange.end)
	{
		alert(app.Translate("Invalid IPA value! Must be in %1..%2 range").replace("%1", m_ipaRange.start).replace("%2", m_ipaRange.end))
		return false
	}
	else
		return true
}

function RecalcAddresses()
{
	if (!app.CallFunction("common.CheckGridSorting", gridDatapath))
		return
	
	var list = app.CallFunction("common.GridGetSelections", grid)
	if (list.length < 2)
	{
		alert(app.Translate("Please select at least two or more rows to recalculate"))
		return  // ha senso solo se almeno 2 righe selezionate
	}
	
	// l'indirizzo di partenza quello della prima riga selezionata
	var address = parseInt(grid.Elem(list[0], columns.address))
	
	var msg = app.Translate("Addresses of the selected rows will be recalculated, starting from %1.\nContinue?")
	if (!confirm(msg.replace("%1", address)))
		return
		
	for (var i = 0; i < list.length; i++)
	{
		grid.Elem(list[i], columns.address) = address
		
		// determina la dimensione del parametro
		var node = app.SelectNodesXML(gridDatapath + "/param[" + (list[i]+1) + "]")[0]
		var size = app.CallFunction(m_extName + ".GetParamSize", node, m_isModbusCompliantDatabase)
		
		address += size
	}
	
	grid.Update(-1, columns.address)
}

function Assign()
{
	var list = app.CallFunction("common.GridGetSelections", grid)
	if (!list || list.length != 1)
		return false
	
	var varName = grid.Elem( list[ 0 ], columns.name )
	if ( varName != "" )
	{
		var caption = app.Translate( "Unassign variable" )
		var msg = app.Translate( "Current assigned variable '" + varName + "' will be removed from project.\n\nDo you want to continue?" )
		if ( app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONINFORMATION | gentypes.MSGBOX.MB_YESNO ) == gentypes.MSGBOX.IDNO )
			return
	}

	// passa un set di indici di colonne con gli alias delle colonne locali
	var c = { label: columns.name, size: undefined, type: undefined, description: undefined }
	
	m_isAssignButton = true
	
	// nessun filtro sul tipo
	AssignPLCVar(grid, c, "", undefined, PLCVARASSIGN_ONLYSIMPLE | PLCVARASSIGN_ONLYAUTO, undefined, m_globalGroupName)
	
	m_isAssignButton = false	
}

function UnAssign()
{
	var list = app.CallFunction("common.GridGetSelections", grid)
	if (!list || list.length != 1)
		return

	var varName = grid.Elem( list[ 0 ], columns.name )
	if ( varName == "" )
		return
	
	var caption = app.Translate( "Unassign variable" )
	var msg
	msg = app.Translate( "Variable '" + varName + "' will be unassigned and removed from project.\n\nDo you want to continue?" )
	if ( app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION | gentypes.MSGBOX.MB_YESNO ) == gentypes.MSGBOX.IDNO )
		return
	
	// passa un set di indici di colonne con gli alias delle colonne locali
	var c = { label: columns.name }
	
	UnAssignPLCVars(grid, c, m_globalGroupName)
}


// dato un prefisso, cerca un nome di parametro libero del tipo prefisso2, prefisso3, ecc
function FindFreeName(prefix)
{
	if (!prefix)
		return ""
		
	// se il prefisso termina con un numero, risale all'indietro fino alla prima lettera
	var pos = prefix.length - 1
	while (prefix.charCodeAt(pos) >= 48 && prefix.charCodeAt(pos) <= 57)
		pos--
	
	if (pos < 0)
		// prefisso di soli numeri???
		return ""
	else if (pos != prefix.length - 1)
	{
		// se pos è arretrata, il contatore partirà dal suffisso numerico +1
		var i = parseInt(prefix.substr(pos+1)) + 1
		prefix = prefix.substr(0, pos+1)
	}
	else
		// per default il suffisso numerico parte da 2
		var i = 2
	
	// genera mappa con tutti i nomi di parametri correnti per ricerca veloce
	var used = {}
	var nodelist = app.SelectNodesXML(gridDatapath + "/param/name")
	var node
	while (node = nodelist.nextNode())
		used[node.text] = true
	
	while (used[prefix + i])
		i++
		
	return prefix + i
}

function isNumber(n)
{
	return !isNaN(parseFloat(n)) && isFinite(n)
}

// -------------------------------------- gestione import/export di parametri e status vars da file CSV ------------------------------------

function ExportToCSVFile(readonly)
{
	var selections = app.CallFunction("common.GridGetSelections", grid)
	if (selections.length == 0)
	{
		app.MessageBox(app.Translate("Please select at least one or more rows to export"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	var msg = app.Translate(readonly ? "Status variables" : "Parameters");

	var filename = app.CallFunction("extfunct.ShowSaveFileDlgEx", "Comma separated values file|*.CSV|", "CSV", msg);
	if (!filename)
		return false

	var fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject")

	try
	{
		var file = fso.CreateTextFile(filename, true);
		if (!file)
		{
			app.MessageBox(genfuncs.FormatMsg(app.Translate("Error creating new file %1"), filename), "", gentypes.MSGBOX.MB_ICONERROR);
			return false;
		}
	}
	catch (err)
	{
		app.MessageBox(app.Translate("Error exporting to file."), "", gentypes.MSGBOX.MB_ICONERROR);
		return false;
	}

	var headerRow = []

	// riempimento riga di intestazione con nome colonne
	var parTemplate = app.GetTemplateData(rowTemplate)[0]
	var nodelist = parTemplate.selectNodes("*")
	var node

	var nodesMap = {} // lista dei tag xml effettivamente sa salvare

	for (var i in m_columnsNodes)
	{
		var colName = m_columnsNodes[i];
		if (colName == "dataBlock")
			continue

		if (colName == "address" && !m_isModbusCompliantDatabase)
			colName = "index"

		if (colName == "subindex" && m_isModbusCompliantDatabase)
			continue

		if (colName == "addressHex")
			continue

		headerRow.push(colName)
		nodesMap[colName] = true
	}

	file.writeLine("#" + headerRow.join(','));

	var counter = 0;
	for (var i = 0; i < selections.length; i++)
	{
		var row = parseInt(selections[i])
		var parNode = app.SelectNodesXML(gridDatapath + "/param")[row]
		if (!parNode)
			continue;

		var fileRow = []
		for (var nodeName in nodesMap)
		{
			var value = GetNode(parNode, nodeName);
			if (value.indexOf(",") != -1)
				value = '"' + value + '"'

			if (nodeName == "typepar")
			{
				if (parseInt(value) >= ENUM_BASE)
				{
					var enumID = parseInt(value) - ENUM_BASE
					var nodelist = app.SelectNodesXML(gridDatapath.slice(0, -1) + "..//enums/enum[@id='" + enumID + "']")
					if (nodelist && nodelist.length == 1)
						value = nodelist[0].getAttribute("caption")
				}
				else
					value = TYPEPAR_DESCR[value]
			}


			if (nodeName == "accesslevel")
			{
				switch (value)
				{
					case "0":
						value = app.Translate("Never visible")
						break;
					case "1":
						value = app.Translate("Expert")
						break;
					case "2":
						value = app.Translate("Supervisor")
						break;
					case "3":
						value = app.Translate("Normal")
						break;
					default:
						parType = app.Translate("Normal")
				}
			}

			fileRow.push(value)
		}

		file.writeLine(fileRow.join(','));

		counter++
	}

	file.Close();

	var logmsg = genfuncs.FormatMsg("%1: %2 records exported", msg, counter);
	app.MessageBox(logmsg, "", gentypes.MSGBOX.MB_ICONINFORMATION);
	app.PrintMessage(logmsg + " to file " + filename);

}

function ImportFromCSVFile(readonly)
{
	var FUNNAME = (readonly ? app.Translate("Status variables import") : app.Translate("CSV parameters import")) + ": "

	var filename = app.CallFunction("extfunct.ShowOpenFileDlgEx", "Comma separated values file|*.CSV|", "CSV");
	if (!filename)
		return false

	var fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject")
	try
	{
		var inputFile = fso.OpenTextFile(filename, gentypes.enuOpenTextFileModes.ForReading);
	}
	catch (err)
	{
		app.MessageBox(FUNNAME + app.Translate("Error importing from file."), "", gentypes.MSGBOX.MB_ICONERROR);
		return

	}

	var fileRows = []
	while (!inputFile.AtEndOfStream)
		fileRows.push(inputFile.ReadLine())

	if (fileRows.length == 0)
	{
		app.MessageBox(FUNNAME + app.Translate("Error importing from file. Missing header?"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	// prima riga di intestazione, definisce i tag xml per le DataSet
	var fileHeader = fileRows.shift();
	var nodeNames = fileHeader.split(",");
	if (nodeNames.length == 0)
	{
		app.MessageBox(app.Translate("error importing from file.\nMissing header?"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	// rimozione #
	if (nodeNames[0].indexOf("#") != 0)
	{
		app.MessageBox(FUNNAME + app.Translate("error importing from file.\nMissing header?"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	nodeNames[0] = nodeNames[0].replace("#", "");

	// verifica correttezza importazione (status con status e parametri con parametri)	
	var importingStatus = false;
	for (var i = 0; i < nodeNames.length; i++)
	{
		if (nodeNames[i] == "readonly")
		{
			importingStatus = true;
			break;
		}
	}

	if (importingStatus && !readonly)
	{
		app.MessageBox(FUNNAME + app.Translate("error importing from file.\nCan not import status variables on parameters."), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}
	else if (!importingStatus && readonly)
	{
		app.MessageBox(FUNNAME + app.Translate("error importing from file.1nCan not import parameters on status variables."), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}


	var parTemplate = app.GetTemplateData(rowTemplate)[0]
	// controllo coerenza templatedata
	for (var i = 0; i < nodeNames.length; i++)
	{
		var parTemplateChild = parTemplate.selectNodes(nodeNames[i])[0];
		if (!parTemplateChild)
		{
			app.MessageBox(FUNNAME + app.Translate("error importing from file.\nWrong header?"), "", gentypes.MSGBOX.MB_ICONERROR);
			return
		}
	}

	var dataBlockName = app.CallFunction(m_extName + ".GetIODataBlockName", "database", false, "")
	var devConfig = app.SelectNodesXML(gridDatapath + "/..")[0]
	var counter = 0;
	var mergedCounter = 0;
	var recalcAdrCounter = 0
	var enumNotFoundCounter = 0
	var CSVMatrix = CSVToArray(fileRows.join("\n"))

	for (var i = 0; i < CSVMatrix.length; i++)
	{
		var records = CSVMatrix[i]
		if (records.length == 0)
			continue;

		var nodesMap = {}
		for (var z = 0; z < records.length; z++)
			nodesMap[nodeNames[z]] = records[z]

		// controllo duplicazione indirizzi con emissione di log
		var address = nodesMap["address"];
		var name = nodesMap["name"];

		var datapath = null
		var nodelist = app.SelectNodesXML(gridDatapath.slice(0, -1) + "..//param[address='" + address + "']")
		if (nodelist && nodelist.length > 0)
		{
			// se stesso nome e stesso indirizzo è un merge
			if (name == GetNode(nodelist[0], "name"))
			{

				datapath = app.GetDataPathFromNode(nodelist[0]);
				app.PrintMessage(FUNNAME + app.Translate("record '%1' exists, merged").replace("%1", name));
				mergedCounter++;
			}
			else
			{
				// stesso indirizzo ma con nome diverso, cerco un nuovo indirizzo
				var oldAddress = address
				address = FindFreeAddress()
				if (address == -1)
				{
					app.MessageBox(app.Translate("Too many records already defined"), "", gentypes.MSGBOX.MB_ICONERROR);
					return
				}

				app.PrintMessage(FUNNAME + app.Translate("duplicated '%1' adress value. Replaced with '%2'").replace("%1", oldAddress).replace("%2", address))
			}
		}

		// se datapath si tratta di un nuovo record da aggiungere
		if (datapath == null)
		{
			datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false);
			counter++
		}

		var ipa = FindFreeIPA();

		// aggiunta dati solo se coerenti con templatedata
		for (var nodeName in nodesMap)
		{
			var value = nodesMap[nodeName];
			if (nodeName == "typepar")
			{
				var typeparBase = false;
				for (var typeparValue in TYPEPAR_DESCR)
				{
					if (value == TYPEPAR_DESCR[typeparValue])
					{

						value = typeparValue
						typeparBase = true;
					}
				}

				// controllo se enum definito
				if (!typeparBase)
				{
					var nodelist = app.SelectNodesXML(gridDatapath.slice(0, -1) + "..//enums/enum[@caption='" + value + "']")
					if (nodelist && nodelist.length == 1)
						value = parseInt(nodelist[0].getAttribute("id")) + ENUM_BASE
					else
					{
						app.PrintMessage(FUNNAME + app.Translate("enum '%1' not found. Record type replaced with '%2'").replace("%1", value).replace("%2", TYPEPAR_DESCR[TYPEPAR.DINT]))
						value = TYPEPAR.DINT
						enumNotFoundCounter++;
					}
				}
			}

			if (nodeName == "accesslevel")
			{
				switch (value)
				{
					case app.Translate("Never visible"):
						value = 0
						break;
					case app.Translate("Expert"):
						value = 1
						break;
					case app.Translate("Supervisor"):
						value = 2
						break;
					case app.Translate("Normal"):
						value = 3
						break;
					default:
						value = 0
				}
			}

			app.DataSet(datapath + "/" + nodeName, 0, value)
		}

		app.DataSet(datapath + "/ipa", 0, parseInt(ipa))
		app.DataSet(datapath + "/address", 0, parseInt(address))
	}

	if (counter == 0 && mergedCounter == 0 && recalcAdrCounter == 0 && enumNotFoundCounter == 0)
	{
		app.MessageBox(FUNNAME + app.Translate("no records imported.\nSee logs on output window for more information"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	app.MessageBox(FUNNAME + app.Translate("operation completed.\nSee logs on output window for more information"), "", gentypes.MSGBOX.MB_ICONINFORMATION);

	var logsMsgs = []
	if (counter > 0)
	{
		grid.InsertRows(counter)
		grid.focus()

		logsMsgs.push(counter + " " + app.Translate("imported"))
	}

	if (mergedCounter > 0 || recalcAdrCounter > 0)
		grid.Update(-1, -1)

	if (mergedCounter > 0)
	{
		logsMsgs.push(mergedCounter + " " + app.Translate("merged"));
	}

	if (recalcAdrCounter > 0)
	{
		logsMsgs.push(recalcAdrCounter + " " + app.Translate("with new address"));
	}

	if (enumNotFoundCounter > 0)
	{
		logsMsgs.push(enumNotFoundCounter + " " + app.Translate("with enum not found"));
	}

	var logMsg = FUNNAME + app.Translate("result:");
	app.PrintMessage(logMsg + " " + logsMsgs.join(","));
	app.CallFunction("extfunct.SelectOutputTab", 3)
}