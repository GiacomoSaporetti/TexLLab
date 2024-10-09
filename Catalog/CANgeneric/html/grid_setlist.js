var GRIDNAME = "CANSetCheckList"      // nome della griglia, usato in file INI
var tablePath = "CANgeneric_config[1]/SDOsetList[1]"		// path relativo della tabella
var rowTemplate = "SDOset"

var gridDatapath = ""

var columns = { label: 0, index: 1, subindex: 2, type: 3, value: 4, timeout: 5 }
var m_columnsNodes = []

function InitGrid(datapath)
{	
	for (var i in columns)
		m_columnsNodes.push(i)
	
	grid.AddColumn(300, 100, true,  false, egColumnType.egEdit,  0, "Object Name")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "Index")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "SubIndex")
	grid.AddColumn(80, 100, true,  false,  egColumnType.egEdit, 0, "Type")
	grid.AddColumn(80, 100, false, false,  egColumnType.egEdit,  0, "Value")
	grid.AddColumn(80, 100, false, false,  egColumnType.egEdit,  0, "Timeout")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	grid.UseSlowEvents = false
	
	GridLoadSettings(grid, GRIDNAME)
		
	// gestione evidenziamento errore
	SearchErrorTable(grid, gridDatapath, m_columnsNodes)

	RestoreGridSort(grid, gridDatapath)
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
	// visto che legge i valori diretti delle colonne sono già in hex
	var idx = parseInt(grid.Elem(row, columns.index), 16)
	var subidx = parseInt(grid.Elem(row, columns.subindex), 16)
	
	if (idx >= 0x1800 && idx < 0x1800+512 && (subidx == 2 || subidx == 5))
	{
		// se è stato modificato uno degli oggetti 180x.2 o 180x.5 forza la modalità PDOTx su USER DEFINED
		app.DataSet(gridDatapath + "/../PDOTxTransmission", 0, -1)
		return true
	}
	else if (idx >= 0x1400 && idx < 0x1400+512 && (subidx == 2 || subidx == 5))
	{
		// se è stato modificato uno degli oggetti 140x.2 o 140x.5 forza la modalità PDORx su USER DEFINED
		app.DataSet(gridDatapath + "/../PDORxTransmission", 0, -1)
		return true
	}
	else
		return false
}


var FLAG_NO_RO = 1
var FLAG_NO_WO = 2
var FLAG_ONLY_PDOMAPPING = 4

function CANAddRow()
{
	// estrae il nodeName del nodo attivo (quello che stiamo configurando)
	var nodes = window.external.SelectNodesXML(datapath.value.slice(0, -1))
	if (nodes && nodes.length != 0)
		var id = nodes[0].nodeName
	else
		return
	
	// lista completa di tutti gli oggetti CAN
	var devinfo = app.CallFunction("CANgeneric.GetCANgenericDeviceInfo", id)
	if (!devinfo) return
	
	app.TempVar("newVar_showSplitBits") = false
	app.OpenWindow("newVar_CAN", "Set CAN object to map", gridDatapath + "/*")	
	var item = app.TempVar("newVar_item")
	
	// aggiunge una riga singola
	if ( item != undefined )
	{
		grid_AddRowXML()
		var row = grid.NumRows() - 1
		
		SetRowValues(row, item, devinfo.granularity, false)
		grid.Update(row, -1)
	}
}

function SetRowValues(row, item)
{
	grid.Elem(row, columns.label) = item.name
	grid.Elem(row, columns.index) = item.index
	grid.Elem(row, columns.subindex) = item.subindex
	grid.Elem(row, columns.type) = item.typeIEC
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}
