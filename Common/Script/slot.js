// salva il riferimento a window.external perchè altrimenti se si è in editing in una griglia e si clicca poi sull'albero cambiando pagina,
// il window.external punta poi alla NUOVA pagina e tutto ciò che viene fatto nella SetElemX fallirebbe
var winext = window.external

// restituisce il valore per la colonna objtype per le griglie delle schede
// ES: analogInput - INT
function GetColumn_ObjType(row, path)
{
	var inout = winext.DataGet(path + "/*[" + (row+1) + "]/ioObject/@inout", 0)
	var objtype = winext.DataGet(path + "/*[" + (row+1) + "]/ioObject/@objtype", 0)
	
	var s
	if (inout == "in" && objtype == "BOOL")
		s = "digitalInput"
	else if (inout == "out" && objtype == "BOOL")
		s = "digitalOutput"
	else if (inout == "in")
		s = "analogInput"
	else if (inout == "out")
		s = "analogOutput"
	
	return s + " - " + objtype
}

// colonna index del SDO, in esa
function GetColumn_objectIndex(row, path)
{
	var objectIndex = winext.DataGet(path + "/*[" + (row+1) + "]/ioObject/@objectIndex", 0)
	return parseInt(objectIndex).toString(16)
}

// colonna subindex del SDO, con in aggiunta il bit se necessario
function GetColumn_objectSubIndex(row, path)
{
	var objtype = winext.DataGet(path + "/*[" + (row+1) + "]/ioObject/@objtype", 0)
	var objectSubIndex = winext.DataGet(path + "/*[" + (row+1) + "]/ioObject/@objectSubIndex", 0)
	if (objtype == "BOOL")
		return objectSubIndex + "." + row
	else
		return objectSubIndex
}

// aggiunge colonne standard all'inizio della griglia
function AddColumns_ioObject(grid, columns, columnsNodes, datapath)
{
	// aggiunge nell'array dei nodi gli attributi dell'ioObject
	columnsNodes.push("ioObject/@name", "ioObject/@objtype")
		
	// aggiunge le altre colonne nell'array dei nodi
	for (i in columns)
		columnsNodes.push(i)

	// shifta le colonne già definite di due posti
	var i
	for (i in columns)
		columns[i] = columns[i] + 2
	
	// aggiunge alla mappa dei nomi delle colonne le nuove colonne standard
	columns.name = 0
	columns.objtype = 1

	// aggiunge tutte le colonne di default
	grid.AddColumn(80, 100, true, false, egColumnType.egEdit, 0, "Name")
	grid.AddColumn(130, 100, true, false, egColumnType.egEdit, 0, "ObjType")
}

// aggiunge colonne standard in fondo alla griglia
function AddColumns_ioObject2(grid, columns, columnsNodes, datapath, addDeadband)
{
	var node = winext.SelectNodesXML(datapath + ".")[0]
	// var features = winext.CallFunction("script.GetSlotFeatures", node)   // GF_ProjectLX
	var features = winext.CallFunction("r-gcan.GetSlotFeatures", node)      // LogicLab DEMO
	
	// aggiunta deadband se richiesto per canopen o gdnet
	if (addDeadband && features.showDeadBand)
	{
		columns.deadband = columnsNodes.length
		columnsNodes.push("deadband")
		grid.AddColumn( 80, 100, false, true, egColumnType.egEdit,  0, "DeadBand")
	}
		
	// aggiunge alla mappa dei nomi delle colonne le nuove colonne standard
	columns.comment = columnsNodes.length
	columns.modbusAddress = columnsNodes.length + 1
	columns.objectIndex = columnsNodes.length + 2
	columns.objectSubIndex = columnsNodes.length + 3
	columns.PDONumber = columnsNodes.length + 4
	columns.PDOStartBit = columnsNodes.length + 5
	columns.COBID = columnsNodes.length + 6
	
	// aggiunge nell'array dei nodi gli attributi dell'ioObject
	columnsNodes.push("ioObject/@comment", "ioObject/@modbusAddress", "ioObject/@objectIndex", "ioObject/@objectSubIndex", "ioObject/@PDONumber", "ioObject/@PDOStartBit", "ioObject/@COBID" )
	
	// aggiunge tutte le colonne di default
	grid.AddColumn(160, 100, false, false, egColumnType.egEdit, 0, "Description")
	grid.AddColumn(features.showModbus ? 60 : 0, 100, true, true, egColumnType.egEdit, 0, app.Translate("Modbus"))
	grid.AddColumn(features.showCAN ? 40 : 0, 100, true, true, egColumnType.egEdit, 0, app.Translate("Idx"))
	grid.AddColumn(features.showCAN ? 40 : 0, 100, true, true, egColumnType.egEdit, 0, app.Translate("Sub"))
	grid.AddColumn(features.showCAN ? 40 : 0, 100, true, true, egColumnType.egEdit, 0, app.Translate("PDO"))
	grid.AddColumn(features.showCAN ? 40 : 0, 100, true, true, egColumnType.egEdit, 0, app.Translate("Bit"))
	grid.AddColumn(features.showCAN ? 50 : 0, 100, true, true, egColumnType.egEdit, 0, app.Translate("COBID"))
}

function InitDataPath(parentDatapath, list)
{
	var datapath
	
	// ricava il datapath dal parametro dall'URL
	// sarà completo, del tipo /r-cpu300[1]/r-cpu300_bus[1]/r-c3[1]/
	var prefix = "?datapath="
	var pos = document.location.href.indexOf(prefix)
	if (pos > 0)
		datapath = unescape(document.location.href.substr(pos+prefix.length))

	// il parentDatapath sarà del tipo /r-cpu300[1]/r-cpu300_bus[1]
	// calcola il suffiso specifico di questa pagina e lo antepone a tutti i controlli da agganciare
	var suffix = datapath.substr(parentDatapath.length)
	
	if (list != undefined)
	{
	    // riassocia tutti gli elementi presenti in list cambiando il nome
	    var elem
	    for (var i = 0; i < list.length; i++)
	    {
		    if (typeof list[i] == "string")
			    elem = document.getElementById(list[i])
		    else
			    elem = list[i]
		
		    if (elem)
			    elem.name = ".D(" + suffix + elem.name + ")"
	    }
	
	    // riparsa la pagina dopo aver modificato i name dei controlli da associare
	    winext.ParseHTMLPage()
	}
	
	return datapath
}


// chiama una funzione custom del padre per la gestione del cambio label
function OnLabelChange(datapath, newlabel)
{
	var parentNodes = winext.SelectNodesXML(datapath + "/../ancestor::*[@insertable]")
	var parent = parentNodes[parentNodes.length-2]
	if (parent)
	{
		var func = parent.getAttribute("SlotChangeFunc")
		if (func)
			winext.CallFunction(func, parent, datapath, newlabel)
	}
}

// si salva il path dell'errore se presente, perchè verrà resettato da SearchErrorTable
var m_oldErrorPath = window.external.TempVar("ErrorPath")

function SearchErrorSlot(datapath)
{
	//var errorPath = window.external.TempVar("ErrorPath")
	var errorPath = m_oldErrorPath
	if (! errorPath) return
	
	// il path dell'errore deve cominciare con il path dello slot attuale
	if (errorPath.substr(0, datapath.length) != datapath)
		return
	
	// estrae la parte del campo di errore e cerca il tab
	var fieldPath = errorPath.substr(datapath.length)
	var tab = m_tabsMap[fieldPath]
	if (tab != undefined)
	{
		// ok trovato tab che corrisponde
		ChangeTab(tab)
		// pulisce indicativo errore
		m_oldErrorPath = undefined
	}
}

// determina se mostrare i global objects per i vali slot
function ShowGlobalObjects(datapath)
{
	var nodelist = winext.SelectNodesXML(datapath + ".")
	if (nodelist && nodelist.length != 0)
	{
		//var features = app.CallFunction("script.GetSlotFeatures", nodelist[0])    // GF_ProjectLX
		var features = app.CallFunction("r-gcan.GetSlotFeatures", nodelist[0])      // LogicLab DEMO
		return features.showGlobalObjects
	}
}


// funzione 'dummy', in GF_ProjectLX è in common.js
function ValidateColumnValue(grid, columns, row, col, value, allowDots)
{
	return true
}
