var GRIDNAME = "CANSetCheckList"      // nome della griglia, usato in file INI
var tablePath = "CANcustom_config[1]/SDOsetList[1]"		// path relativo della tabella
var rowTemplate = "SDOset"

var gridDatapath = ""

var columns = { label: 0, index: 1, subindex: 2, type: 3, value: 4, timeout: 5 }
var m_columnsNodes = []

var m_parMap

function InitGrid(datapath)
{
	var hasEnum = false
	// estrae il nodeName del nodo attivo (quello che stiamo configurando)
	var nodes = window.external.SelectNodesXML(datapath.slice(0, -1))
	if (nodes && nodes.length != 0)
		var id = nodes[0].nodeName
	else
		return

	// lista completa di tutti gli oggetti CAN
	var devinfo = app.CallFunction("CANcustom.GetCANCustomDeviceInfo", id)
	// aggiungo tutte le definizioni degli enumerativi
	if (devinfo && devinfo.enumMap)
	{
		CreateGridEnums( devinfo.enumMap )
		hasEnum = true
	}

	for (var i in columns)
		m_columnsNodes.push(i)
	
	grid.AddColumn(300, 100, true,  false, egColumnType.egEdit,  0, "Object Name")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "Index")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "SubIndex")
	grid.AddColumn(80, 100, true,  false,  egColumnType.egEdit, 0, "Type")
	if ( hasEnum )
		grid.AddColumn(80, 100, false, false,  egColumnType.egMix,  0, "Value")
	else
		grid.AddColumn(80, 100, false, false,  egColumnType.egEdit,  0, "Value")
	grid.AddColumn(80, 100, false, false,  egColumnType.egEdit,  0, "Timeout")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	grid.UseSlowEvents = hasEnum // solo se ci sono gli enum da gestire usa gli slow events
	
	GridLoadSettings(grid, GRIDNAME)
		
	// gestione evidenziamento errore
	SearchErrorTable(grid, gridDatapath, m_columnsNodes)

	RestoreGridSort(grid, gridDatapath)
}

function CreateGridEnums( enums )
{
	for (var id in enums)
	{
		var curEnum = enums[id]
		var list = []

		for (var value in curEnum)
			if (value != "default")
				list.push(parseInt(value), curEnum[value])

		grid.AddEnum("enum"+id, list)

		// l'elemento speciale chiamato 'default' viene impostato come stringa di default in caso di valore numerico non presente nella lista (solo per enum)
		// se nella stringa c'√® il %i verr√† sostituito con il valore numerico
		if (curEnum["default"])
			grid.EnumSetDefault(id, curEnum["default"])
	}
}

function grid_AddRowXML()
{
	window.external.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	grid.InsertRows(1)
}

function grid_DeleteRowXML()
{
	// verifica se si sta cancellando un settaggio dei PDO transmission
	var list = VBArray(grid.GetSelections()).toArray()
	for (var i = 0; i < list.length; i++)
		if (CheckPDOTransmission(list[i]))
			break  // al primo che trova esce
	
	grid_DeleteMultiple(grid, gridDatapath)
}

function CheckPDOTransmission(row)
{
	// visto che legge i valori diretti delle colonne sono gi‡ in hex
	var idx = parseInt(grid.Elem(row, columns.index), 16)
	var subidx = parseInt(grid.Elem(row, columns.subindex), 16)
	
	if (idx >= 0x1800 && idx < 0x1800+512 && (subidx == 2 || subidx == 5))
	{
		// se Ë stato modificato uno degli oggetti 180x.2 o 180x.5 forza la modalit‡ PDOTx su USER DEFINED
		app.DataSet(gridDatapath + "/../PDOTxTransmission", 0, -1)
		return true
	}
	else if (idx >= 0x1400 && idx < 0x1400+512 && (subidx == 2 || subidx == 5))
	{
		// se Ë stato modificato uno degli oggetti 140x.2 o 140x.5 forza la modalit‡ PDORx su USER DEFINED
		app.DataSet(gridDatapath + "/../PDORxTransmission", 0, -1)
		return true
	}
	else
		return false
}


var FLAG_NO_RO = 1
var FLAG_NO_WO = 2
var FLAG_ONLY_PDOMAPPING = 4

function GetParMap()
{
	if ( !m_parMap )
	{
		// estrae il nodeName del nodo attivo (quello che stiamo configurando)
		var nodes = window.external.SelectNodesXML(datapath.value.slice(0, -1))
		if (nodes && nodes.length != 0)
			var id = nodes[0].nodeName
		else
			return
	
		// lista completa di tutti gli oggetti CAN
		var devinfo = app.CallFunction("CANcustom.GetCANCustomDeviceInfo", id)
		if (!devinfo) return
	
		// mostra il form di selezione variabile e legge il risultato tramite variabile temporanea
		m_parMap = devinfo.parMap
	}
	
	return m_parMap
}

function CANAddRow()
{
	// mostra il form di selezione variabile e legge il risultato tramite variabile temporanea
	var parMap = GetParMap()
	if (!parMap) return
	app.TempVar("varsList_parMap") = parMap
	app.TempVar("varsList_Index_path") = "index"
	app.TempVar("varsList_SubIndex_path") = "subindex"
	app.TempVar("varsList_Flags") = FLAG_NO_RO
	app.TempVar("varsList_showSplitBits") = false

	app.OpenWindow("varsList_CAN", "Variables List", "" )
	var result = app.TempVar("varsList_result")
	
	app.TempVar("varsList_parMap") = undefined
	app.TempVar("varsList_result") = undefined
	app.TempVar("varsList_Index_path") = undefined
	app.TempVar("varsList_SubIndex_path") = undefined
	app.TempVar("varsList_Flags") = undefined
	app.TempVar("varsList_showSplitBits") = undefined
	if (! result) return

	
	for (var i = 0; i < result.length; i++)
	{
		// aggiunge una riga vuota
		grid_AddRowXML()
		var row = grid.NumRows() - 1
		
		var v = parMap[result[i]]
		if (v)
		{
			SetRowValues(row, v)
			grid.Update(row, -1)
		}
	}
}



function SetRowValues(row, par)
{
	grid.Elem(row, columns.label) = par.name
	grid.Elem(row, columns.index) = par.commIndex
	grid.Elem(row, columns.subindex) = par.commSubIndex
	grid.Elem(row, columns.type) = app.CallFunction("parameters.ParTypeToIEC", par.type, par.format)
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}

function GetEnum( row )
{
	var parMap = GetParMap()
	if ( !parMap )
		return
	
	var index = app.DataGet( gridDatapath + "/*[" + (row+1) + "]/index", 0 )
	var subindex = app.DataGet( gridDatapath + "/*[" + (row+1) + "]/subindex", 0 )
	var strId = parseInt(index).toString( 16 ) + "." + parseInt(subindex).toString( 16 )
	
	var par = parMap[ strId ]
	if ( par && par.typepar.substring( 0, 4 ) == "enum" )
		return par.typepar
	
	return
}